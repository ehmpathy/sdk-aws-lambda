import { type ZodSchema, z } from 'zod';

import type { ApiGatewayResponse } from '../../../domain.objects/ApiGatewayResponse';

/**
 * .what = lifts a body schema into the response-envelope schema
 * .why = `schema.output` describes the whole response (`outputBefore`), never the body
 *        inside it — so a reader can line the schema up against the pipeline. this keeps
 *        the common case a one-liner instead of a hand-written envelope per call site
 *
 * .note = `body` is NAMED rather than positional because the envelope holds three fields, so
 *         the argument must say which one it supplies
 *
 * .note = every field is optional in the schema, since `PickAny` lets a handler supply
 *         any non-empty subset. the at-least-one rule is held by the TYPE at compile
 *         time; this schema guards the field types
 *
 * .as = zod cannot express "at least one key present", so it infers `{ status?, headers?,
 *       body? }` — a superset of `PickAny` by exactly one member, `{}` — and no structural
 *       assignment relates the two
 * ⚠️ .note for a DIRECT consumer = this schema is publicly exported, and on its own it ACCEPTS
 *         `{}`. inside `forApiGateway` that is unreachable — `isApiGatewayResponse.assure`
 *         refuses an empty response before this schema is ever reached — but a consumer who
 *         validates against this schema DIRECTLY inherits no such guard. so pair it with the
 *         `ApiGatewayResponse` type (which refuses `{}` at compile time) rather than treat a
 *         parse as the whole check
 *
 * .removal = drops when zod can express an at-least-one-key refinement that still narrows the
 *            inferred type (a `.refine` narrows values, never the type). until then the
 *            compile-time guarantee lives in `ApiGatewayResponse` and the runtime guarantee
 *            lives here, and this cast is the seam between them
 */
export const asApiGatewayResponseSchema = <TBody>(input: {
  body: ZodSchema<TBody>;
}): ZodSchema<ApiGatewayResponse<TBody>> =>
  z.object({
    status: z.number().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: input.body.optional(),
  }) as unknown as ZodSchema<ApiGatewayResponse<TBody>>;
