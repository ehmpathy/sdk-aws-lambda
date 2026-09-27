import type middy from '@middy/core';
import { ConstraintError } from 'helpful-errors';
import type { ZodType } from 'zod';

import type { EnvConfig } from '../../../domain.objects/ContextAwsLambdaServer';
import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { getJsonSchemaFromZod } from './genIntrospectionMiddleware.getJsonSchemaFromZod';
import { isIntrospectionInput } from './genIntrospectionMiddleware.isIntrospectionInput';

/**
 * .what = middleware that intercepts introspection requests
 * .why = enables runtime schema discovery for sdk generation
 *
 * behavior:
 *   - if `inputAfter` is { introspect: 'schema' } and env.access === 'prep': return schema
 *   - if `inputAfter` is { introspect: 'schema' } and env.access !== 'prep': fail fast
 *   - otherwise: pass through to handler
 *
 * .why `inputAfter` and not `payload` = this middleware serves both families, and they keep the
 *        caller's value in different places — `event.payload` for api-gateway, `event` itself
 *        for ask-endpoint. `inputAfter` is the position both share; `payload` is one family's
 *        word for a body (`domain.terms/payload.md`)
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
   *        `event.payload`, while the ask-endpoint family carries it at `event` itself
   */
  asInputAfter: (request: any) => unknown;

  /**
   * .what = renders the schema as this family's `outputAfter`, per family
   * .why = the short-circuit writes STRAIGHT to the wire, so the shape is the family's own:
   *        api-gateway owes an `ApiGatewayResponseOnwire`, while an ask-endpoint response goes
   *        to the wire as it stands
   */
  asOutputAfter: (schema: LambdaEndpointSchema) => unknown;
}): {
  before: middy.MiddlewareFn<any, any>;
} => {
  const before: middy.MiddlewareFn<any, any> = async (request) => {
    /**
     * .what = read `inputAfter` from wherever this family keeps it
     * .why the name = `inputAfter` is a POSITION, and it is true of BOTH families. a local
     *        named `payload` would be the api-gateway family's own word (`event.payload`) put
     *        on a value that for the ask-endpoint family is the WHOLE event — one word, two
     *        senses, at a seam that serves two callers (`domain.terms/payload.md`)
     */
    const inputAfter = opts.asInputAfter(request);

    if (!isIntrospectionInput(inputAfter)) return;

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
