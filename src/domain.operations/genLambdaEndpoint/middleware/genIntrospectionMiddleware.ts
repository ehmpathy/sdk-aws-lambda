import type middy from '@middy/core';
import { ConstraintError } from 'helpful-errors';
import type { ZodType } from 'zod';

import type { EnvConfig } from '../../../domain.objects/ContextAwsLambdaServer';
import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import type { ApiGatewayResponse } from './genConstraintErrorMiddleware';
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
  apiGateway?: boolean;
}): {
  before: middy.MiddlewareFn<any, any>;
} => {
  const before: middy.MiddlewareFn<any, any> = async (request) => {
    // extract payload - for API Gateway, body is already parsed by httpJsonBodyParser
    const payload = opts.apiGateway ? request.event?.body : request.event;

    // check if introspection request
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

    // set response to short-circuit middleware chain
    if (opts.apiGateway) {
      request.response = {
        statusCode: 200,
        body: JSON.stringify(schema),
        headers: { 'Content-Type': 'application/json' },
      } as ApiGatewayResponse;
      return request.response;
    }

    request.response = schema;
    return request.response;
  };

  return { before };
};
