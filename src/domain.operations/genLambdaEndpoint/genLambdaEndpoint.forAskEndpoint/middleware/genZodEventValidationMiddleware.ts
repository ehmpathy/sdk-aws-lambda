import type middy from '@middy/core';
import type { ZodSchema } from 'zod';

import { getValidationError } from '../../middleware/getValidationError';

/**
 * .what = validates the entire event against a zod schema
 * .why = the ask-endpoint family reaches this step with the caller's value AT `request.event`,
 *        so the whole event is what the schema describes
 *
 * .note = its api-gateway peer, `genZodBodyValidationMiddleware`, validates `event.body`
 *         instead, because that chain must keep `request.event` http-shaped. the two collapse
 *         into one validator at the common ancestor the moment `inputAfter` has ONE home
 *         across both chains — see the 🚧 note in
 *         `.behavior/v2026_08_03.feat-apigateway-wire-response/5.1.execution.from_vision.yield.md`.
 *         this stays at the leaf until then, because a lift with one consumer is speculative
 *         (rule.prefer.most-common-denominator)
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
    // .note = DELIBERATE MUTATION — `request` is middy's only channel to hand a value onward
    request.event = result.data;
  };

  return { before };
};
