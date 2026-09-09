import type middy from '@middy/core';
import type { ZodSchema } from 'zod';

import { getValidatedOutput } from './getValidatedOutput';

/**
 * .what = middleware that validates handler output against a zod schema
 * .why = ensures type-safe output before the response is returned
 *
 * ⚠️ .note = WHICH SHAPE THIS VALIDATES DEPENDS ON WHERE YOU REGISTER IT.
 *
 *         it reads `request.response`, and on the api-gateway path that slot holds a different
 *         type at different points in the chain:
 *
 *           before the output translator -> `ApiGatewayResponse<TBody>`   (the handler's shape)
 *           after  the output translator -> `ApiGatewayResponsePayload`   (the wire form, body
 *                                                                         already a string)
 *
 *         a schema written for one refuses the other, so a caller who composes this into a
 *         custom chain validates whichever shape their registration order produces. the
 *         signature cannot warn them — `request.response` is `unknown` to middy, so both bind.
 *
 * .note = UNRESOLVED, NOT A DEFECT — this export carries two contracts with no discriminant.
 *         tracked as **F33** in `1.vision.yield.md`'s fulcrum table, where the three options
 *         (deprecate, add a `point` discriminant, accept) are spelled out.
 *
 *         no shipped chain registers it — both families validate inline instead, because each
 *         knows which of the two shapes it holds at that moment and this middleware cannot. so
 *         the open question is one of surface area, never of a live defect.
 *
 * .note = the validation itself is delegated to `getValidatedOutput`, as both input-side peers
 *         delegate to `getValidationError` — one guarantee, one implementation
 *         (rule.forbid.parallel-codepaths)
 */
export const genZodOutputValidationMiddleware = <TOutput>(input: {
  schema: ZodSchema<TOutput>;
}): middy.MiddlewareObj<unknown, unknown> => {
  return {
    after: async (request) => {
      // replace response with validated data (defaults + transforms applied)
      // .note = DELIBERATE MUTATION — `request` is middy's only channel to hand a value onward
      request.response = getValidatedOutput({
        response: request.response,
        schema: input.schema,
      });
    },
  };
};
