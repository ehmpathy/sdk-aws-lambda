import type middy from '@middy/core';
import type { ZodSchema } from 'zod';

import { getValidatedInput } from '../../middleware/getValidatedInput';
import type {
  ApiGatewayHeadersDeclared,
  ApiGatewayRequestEventUnified,
} from '../ApiGatewayRequestEventUnified';

/**
 * .what = validates the pair a caller may constrain — `{ headers?, payload }` — against
 *         `schema.input`, then writes the validated values back into the envelope
 * .why = `headers` and `payload` are projections of the envelope's own slots, so the handler's
 *        bag and `event.headers` / `event.payload` are one object each. that holds only while
 *        this step replaces the envelope's values rather than parse beside them — a side bag
 *        would leave the envelope stale, silently (`domain.terms/headers.md`)
 *
 * .note = the pair, never the whole event: `request.event` must stay http-shaped through the
 *         chain. `@middy/http-cors` reads `request.event.headers` and derives the http method
 *         from `request.event` in its `after` hook (`@middy/http-cors/index.js:38,83,106`), so
 *         the caller's value cannot take the event's place
 *
 * .note = the constraint is sharper than "http-shaped", and the precise form is what any future
 *         input translate must honor. cors picks its method extractor by
 *         `request.event.version ?? '1.0'` (`index.js:38,106`), and
 *         `ApiGatewayRequestEventUnified` declares no `version` — so cors always falls to its v1
 *         extractor, `(event) => event.httpMethod`. that works only because the unified shape
 *         carries `httpMethod` and `headers` at its top level under v1's own names
 * .note = `httpMethod` is a compat key rather than this shape's word — the shape names the
 *         method `method`, and `httpMethod` rides beside it solely because cors reads that name
 *         verbatim. it is absent from the interface and present on the object
 *         (`asApiGatewayRequestEventUnified.ts`), so a reader who greps the interface will not
 *         find it
 */
export const genZodInputValidationMiddleware = <
  /**
   * .why bound = the write-back below spreads this value over the wire bag, so a `THeaders` that
   *        is not a record spreads as one — `{ ...'abc' }` is `{ 0: 'a', 1: 'b', 2: 'c' }`,
   *        injected into the slot `@middy/http-cors` reads
   *        (`rule.require.illegal-states-unrepresentable`)
   *
   * .why the SAME named bound as `ForApiGatewayInput` = this operation is a public export of its
   *        own (`index.ts`), so a direct consumer reaches it without `forApiGateway` at all — and
   *        `[case20]`, the clamp that proves the bound bites, enters through `forApiGateway`. a
   *        textual copy here could drift with no clamp to catch it. one named type makes that
   *        divergence a type error rather than a human obligation
   */
  THeaders extends ApiGatewayHeadersDeclared,
  TPayload,
>(input: {
  schema: ZodSchema<{ headers?: THeaders; payload: TPayload }>;
}): {
  before: middy.MiddlewareFn<any, any>;
} => {
  const before: middy.MiddlewareFn<any, any> = async (request) => {
    /**
     * .as = this middleware is typed `<any, any>`, so middy hands `request.event` over as
     *       `any`. the value IS a `ApiGatewayRequestEventUnified` by this point — the chain registers
     *       `genApiGatewayRequestEventNormalizationMiddleware` ahead of this one, and that is the
     *       middleware that writes the reconciled shape into the slot
     * .removal = drops when middy gains typed inference across `.use`, at which point this
     *            middleware's own type parameters name the slot's shape and no cast is owed
     *
     * .note = a cast to this slot owes this `.as` / `.removal` pair at both sites — here, and at
     *            `asApiGatewayRequestEventUnified`'s read one file over. a convention applied to
     *            one of two sites is a class left open (rule.require.sweep-the-defect-class)
     * .why not a shared reader = the two sites read the slot at different pipeline points, so
     *            they cast to different types — `ApiGatewayRequestEventOnwire` there, the
     *            reconciled shape here. a reader over two types at two points buys a type
     *            parameter and hides no complexity (rule.prefer.wet-over-dry)
     */
    const event = request.event as ApiGatewayRequestEventUnified;

    /**
     * the two slots a caller may constrain, read from the envelope the reconcile produced
     *
     * .note = `headers` is the WHOLE WIRE BAG, never the author's declared subset — and that
     *         asymmetry is the one footgun this design carries. the readme's phrase, "your schema
     *         governs the keys it declares", is true of the write-back below and false of this
     *         line. so a `.strict()` (or `z.strictObject`) header schema refuses every real
     *         request: api gateway always injects `host`, `x-forwarded-for`, `x-amzn-trace-id`,
     *         and cloudfront's own keys. measured — a strict bag yields `unrecognized_keys` on
     *         path `headers`, where the same schema in zod's default (strip) mode parses clean
     *
     * .why not a subset parse, which would make `.strict()` inert = the sdk cannot know which
     *         keys a schema declares without a reach into zod's internals, and that read fails
     *         open on a union, an effect, or a refinement. so the whole bag is what it can
     *         honestly hand over
     * .why the remedy sits in `getValidationError` = the failure is already loud and total, so
     *         what it lacks is the cure rather than the symptom
     *         (`rule.require.errors-name-the-fix`). clamped by `[case5]` / `[case6]` there — the
     *         second is the positive control, since `.strict()` on `payload` is correct and must
     *         not draw the hint
     */
    const inputAfter = getValidatedInput({
      schema: input.schema,
      value: { headers: event.headers, payload: event.payload },
    });

    /**
     * .note = deliberate mutation — `request` is middy's only channel to hand a value onward,
     *         and `event` is an alias of `request.event`, so these write through to the chain
     * .note = a sweep for this class must match the alias as well as the receiver
     *         (`^\s*(event|response|payload)\.\w+\s*=`); a grep anchored on `request.` alone
     *         misses these two lines
     */

    /**
     * .what = headers merge. the author's schema governs the keys it declares; every other wire
     *        key survives untouched
     * .why = zod strips unknown keys, so a schema like `headers: z.object({ authorization })`
     *        yields a bag with no `origin` — and `@middy/http-cors` reads `origin` out of this
     *        very slot in its `after` hook. a wholesale replace does not merely starve cors, it
     *        makes cors emit a wrong answer: with `origins: [a, b]` an absent origin returns
     *        `options.origins[0]` unconditionally (`@middy/http-cors/index.js:2-14`), so a caller
     *        from `b` receives `Access-Control-Allow-Origin: a` and the browser refuses a
     *        response this sdk allowlisted
     * .why a merge and not a replace = the axis is who else reads the slot
     *        (`rule.require.read-the-slot-a-dependency-reads`). cors reads `origin`
     *        (`index.js:84`) and `@middy/http-response-serializer` reads `accept`
     *        (`index.js:25`), so the wire bag is not the author's to delete from. the body has no
     *        such reader, which is why its rule below differs
     * .note = the merge also absorbs the absent key: an author who declares no `headers` gets
     *         `result.data.headers === undefined`, and a spread of `undefined` is a no-op. so one
     *         rule serves both cases, and no branch is owed
     */
    event.headers = { ...event.headers, ...inputAfter.headers };

    /**
     * .what = payload replaces. the validated value takes the slot outright
     * .why = the body is wholly the handler's — no middleware and no vendor reads it — so the
     *        schema's output is the only value that belongs here. it is also what lets
     *        `event.payload` carry the validated body, so the `invoke` hand-off owes no `as`-cast
     *        (`domain.terms/payload.md`)
     */
    event.payload = inputAfter.payload;
  };

  return { before };
};
