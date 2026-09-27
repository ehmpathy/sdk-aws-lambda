import type middy from '@middy/core';
import type { ZodSchema } from 'zod';

import { getValidatedOutput } from './getValidatedOutput';

/**
 * .what = middleware that validates handler output against a zod schema
 * .why = ensures type-safe output before the response is returned
 *
 * .note = which shape this validates depends on where you register it. it reads
 *         `request.response`, and on the api-gateway path that slot holds a different type at
 *         different points in the chain:
 *
 *           before the output translator -> `ApiGatewayResponse<TBody>`  (the handler's shape)
 *           after  the output translator -> `ApiGatewayResponseOnwire`   (the wire form, body
 *                                                                        already a string)
 *
 *         a schema written for one refuses the other, so a caller who composes this into a
 *         custom chain validates whichever shape their registration order produces. the
 *         signature cannot warn them — `request.response` is `unknown` to middy, so both bind
 *
 * .note = unresolved, not a defect — this export carries two contracts with no discriminant.
 *         tracked as F33 in the fulcrum table of
 *         `.behavior/v2026_08_03.feat-apigateway-wire-response/1.vision.yield.md`, where the
 *         three options (deprecate, add a `point` discriminant, accept) are spelled out. the
 *         route is named in full on purpose: a later route adds its own `1.vision.yield.md`,
 *         and a bare filename then resolves to a table with no F33 in it.
 *
 *         no shipped chain registers it — both families validate inline instead, because each
 *         knows which of the two shapes it holds at that moment and this middleware cannot. so
 *         the open question is one of surface area, never of a live defect
 *
 * .note = the validation itself is delegated to `getValidatedOutput`, exactly as both input-side
 *         peers delegate to `getValidatedInput` — one guarantee, one implementation, per border
 *         (rule.forbid.parallel-codepaths)
 *
 *         the two root primitives are peers rather than one, because they make DIFFERENT
 *         guarantees: a bad input is the caller's fault and raises a `ConstraintError`, while a
 *         bad output is the server's fault and raises a `MalfunctionError`
 *         (rule.require.failloud). to merge them would need an error-class argument, which is a
 *         fork on handed config — the shape that rule forbids
 */
export const genZodOutputValidationMiddleware = <TOutput>(input: {
  schema: ZodSchema<TOutput>;
}): middy.MiddlewareObj<unknown, unknown> => {
  return {
    after: async (request) => {
      // replace response with validated data (defaults + transforms applied)
      // .note = deliberate mutation — `request` is middy's only channel to hand a value onward
      request.response = getValidatedOutput({
        response: request.response,
        schema: input.schema,
      });
    },
  };
};
