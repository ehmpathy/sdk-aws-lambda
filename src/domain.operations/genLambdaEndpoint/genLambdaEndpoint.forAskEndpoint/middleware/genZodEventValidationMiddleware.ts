import type middy from '@middy/core';
import type { ZodSchema } from 'zod';

import { getValidationError } from '../../middleware/getValidationError';

/**
 * .what = validates entire event against zod schema
 * .why = askLambdaEndpoint sends unwrapped payload, validate full event
 */
export const genZodEventValidationMiddleware = <TInput>(input: {
  schema: ZodSchema<TInput>;
}): {
  before: middy.MiddlewareFn<any, any>;
} => {
  const before: middy.MiddlewareFn<any, any> = async (request) => {
    const result = input.schema.safeParse(request.event);
    if (!result.success) {
      throw getValidationError({ error: result.error });
    }
    // replace event with parsed (transformed) result
    request.event = result.data;
  };

  return { before };
};
