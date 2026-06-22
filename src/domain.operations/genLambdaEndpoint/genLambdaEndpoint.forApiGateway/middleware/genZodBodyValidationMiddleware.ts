import type middy from '@middy/core';
import type { ZodSchema } from 'zod';

import { getValidationError } from '../../middleware/getValidationError';
import type { UnifiedApiGatewayEvent } from './genApiGatewayEventNormalizationMiddleware';

/**
 * .what = validates event.body against zod schema for API Gateway
 * .why = API Gateway events have body as separate property, validate just the body
 */
export const genZodBodyValidationMiddleware = <TInput>(input: {
  schema: ZodSchema<TInput>;
}): {
  before: middy.MiddlewareFn<any, any>;
} => {
  const before: middy.MiddlewareFn<any, any> = async (request) => {
    const event = request.event as UnifiedApiGatewayEvent;
    const result = input.schema.safeParse(event.body);
    if (!result.success) {
      throw getValidationError({ error: result.error });
    }
    // replace body with parsed (transformed) result
    event.body = result.data as unknown as typeof event.body;
  };

  return { before };
};
