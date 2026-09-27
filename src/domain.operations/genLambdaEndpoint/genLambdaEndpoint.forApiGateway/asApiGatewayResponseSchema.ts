import { type ZodSchema, z } from 'zod';

import type { ApiGatewayResponse } from '../../../domain.objects/ApiGatewayResponse';

/**
 * .what = lifts a payload schema into the response-envelope schema
 * .why = `schema.output` describes the whole response (`outputBefore`), never the payload
 *        inside it — so a reader can line the schema up against the pipeline. this keeps
 *        the common case a one-liner instead of a hand-written envelope per call site
 *
 * .note = `payload` is named rather than positional because the envelope holds three fields, so
 *         the argument must say which one it supplies. it is the same word `ApiGatewayResponse`
 *         uses, deliberately — an argument that named the key `body` would reintroduce the one
 *         synonym this contract retires
 *
 * .note = every field is optional in the schema, since `PickAny` lets a handler supply any
 *         non-empty subset. the at-least-one rule is held by the type at compile time; this
 *         schema guards the field types
 *
 * .note for a BODY-LESS response = `z.undefined()`, `z.void()` and `z.never()` are now
 *         EQUIVALENT, and each publishes honestly. all three accept `{ status: 204 }`, all
 *         three refuse an accidental `{ body: 'oops' }`, and all three serialize to
 *         `{ "not": {} }` — "no body is ever carried". there is no introspection penalty
 *         for any of them
 *
 *         ⇒ **`z.undefined()` is the named idiom** — the readme states it, this spec's
 *         cases declare it, and it names what the value IS: the `body` key is absent, and
 *         `undefined` is the js word for absent. `z.never()` is a type-theory bottom type,
 *         which claims more than the domain means
 *
 *         what to AVOID is `z.any()` / `z.unknown()`, which publish `{}` — a rubber-stamp
 *         that tells a caller ANY body may arrive, the one your handler never sends as well
 *
 * ⚠️ .this was NOT always so = `z.undefined()` and `z.void()` used to throw
 *         `Undefined cannot be represented in JSON Schema`, and the throw took down
 *         `getAllLambdaContracts` for the WHOLE service once `{ introspect: 'schema' }`
 *         arrived in `prep`. it was position-INDEPENDENT, so the `.optional()` this function
 *         adds was no shelter. `getJsonSchemaFromZod` now renders both shapes via an
 *         `override`, so the hazard is closed at the one door rather than dodged per schema
 *   .measured = `[case17]` of the peer spec drives all three candidates through a REAL
 *               introspection request and grades each. `[t1]` goes red if the render
 *               regresses to a throw
 *
 * .as = zod cannot express "at least one key present", so it infers `{ status?, headers?,
 *       payload? }` — a superset of `PickAny` by exactly one member, `{}` — and no structural
 *       assignment relates the two
 * .note for a direct consumer = this schema is publicly exported, and on its own it accepts
 *         `{}`. inside `forApiGateway` that is unreachable — `isApiGatewayResponse.assure`
 *         refuses an empty response before this schema is ever reached — but a consumer who
 *         validates against this schema directly inherits no such guard. so pair it with the
 *         `ApiGatewayResponse` type (which refuses `{}` at compile time) rather than treat a
 *         parse as the whole check
 *
 * .removal = drops when zod can express an at-least-one-key refinement that still narrows the
 *            inferred type (a `.refine` narrows values, never the type). until then the
 *            compile-time guarantee lives in `ApiGatewayResponse` and the runtime guarantee
 *            lives here, and this cast is the seam between them
 */
export const asApiGatewayResponseSchema = <TPayload>(input: {
  payload: ZodSchema<TPayload>;
}): ZodSchema<ApiGatewayResponse<TPayload>> =>
  z.object({
    status: z.number().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    payload: input.payload.optional(),
  }) as unknown as ZodSchema<ApiGatewayResponse<TPayload>>;
