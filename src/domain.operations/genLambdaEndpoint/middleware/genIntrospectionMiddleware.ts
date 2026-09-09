import type middy from '@middy/core';
import { ConstraintError } from 'helpful-errors';
import type { ZodType } from 'zod';

import type { EnvConfig } from '../../../domain.objects/ContextAwsLambdaServer';
import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { getJsonSchemaFromZod } from './genIntrospectionMiddleware.getJsonSchemaFromZod';
import { isIntrospectionPayload } from './genIntrospectionMiddleware.isIntrospectionPayload';

/**
 * .what = middleware that intercepts introspection requests
 * .why = enables runtime schema discovery for sdk generation
 *
 * behavior:
 *   - if payload is { introspect: 'schema' } and env.access === 'prep': return schema
 *   - if payload is { introspect: 'schema' } and env.access !== 'prep': fail fast
 *   - otherwise: pass through to handler
 */
export const genIntrospectionMiddleware = <TInput, TOutput>(opts: {
  schema: {
    input: ZodType<TInput>;
    output: ZodType<TOutput>;
  };
  env?: EnvConfig;

  /**
   * .what = reads `inputAfter` out of the middy request, per family
   * .why = each family keeps the caller's value in a DIFFERENT place, and only the family
   *        knows which. the api-gateway chain must keep `request.event` HTTP-SHAPED, since
   *        `@middy/http-cors` reads `request.event.headers` and derives the http method from
   *        `request.event` in its `after` hook — so that family carries the value at
   *        `event.body`, while the ask-endpoint family carries it at `event` itself
   */
  asInputAfter: (request: any) => unknown;

  /**
   * .what = renders the schema as this family's `outputAfter`, per family
   * .why = the short-circuit writes STRAIGHT to the wire, so the shape is the family's own:
   *        api-gateway owes a wire payload, while an ask-endpoint response IS its payload
   */
  asOutputAfter: (schema: LambdaEndpointSchema) => unknown;
}): {
  before: middy.MiddlewareFn<any, any>;
} => {
  const before: middy.MiddlewareFn<any, any> = async (request) => {
    // read inputAfter from wherever this family keeps it
    const payload = opts.asInputAfter(request);

    if (!isIntrospectionPayload(payload)) return;

    // extract env from config
    const env = typeof opts.env === 'function' ? await opts.env() : opts.env;

    // fail fast if env not provided
    if (!env) {
      throw new ConstraintError(
        'introspection requires env.access context but env was not provided to handler',
        { hint: 'pass env config to genLambdaEndpoint' },
      );
    }

    // fail fast if not prep
    if (env.access !== 'prep') {
      throw new ConstraintError(
        `introspection is only available in prep environment, current: ${env.access}`,
        { env, access: env.access },
      );
    }

    // build schema response
    const schema: LambdaEndpointSchema = {
      input: getJsonSchemaFromZod(opts.schema.input),
      output: getJsonSchemaFromZod(opts.schema.output),
    };

    /**
     * .what = short-circuit the chain with this family's own wire shape
     * .note = DELIBERATE MUTATION. middy's `before` contract is that a hook short-circuits by
     *         assignment to `request.response`; there is no immutable form of that signal
     *         (rule.require.immutable-vars, the annotated-exception clause)
     */
    request.response = opts.asOutputAfter(schema);
    return request.response;
  };

  return { before };
};
