import type { Context } from 'aws-lambda';

import type { LambdaEndpointDialect } from '../../domain.objects/LambdaEndpointDialect';
import { asLambdaContext } from './context/asLambdaContext';
import { asLambdaEndpointDialect } from './dialect/asLambdaEndpointDialect';
import type { LambdaEndpointRunOutput } from './dialect/LambdaEndpointRunOutput';
import { assertEventIsGiven } from './guard/assertEventIsGiven';
import { assertHandlerIsRunnable } from './guard/assertHandlerIsRunnable';
import { asFramedPayload } from './serde/asFramedPayload';
import { asWireStripped } from './serde/asWireStripped';

/**
 * .what = a handler reachable by reference — the function itself, in this process
 * .why = deliberately loose: a plain lambda handler, NOT a `genLambdaEndpoint`
 *   return type. 19 of 20 repos and 314 of 318 legacy call sites still define
 *   handlers with `createStandardHandler`; bind this to `genLambdaEndpoint` and
 *   none of them can adopt the util until they finish a migration not yet started.
 */
export type LambdaEndpointHandlerReferenced<TEvent, TOutput> = (
  event: TEvent,
  context: Context,
) => Promise<TOutput> | TOutput;

/**
 * .what = runs a lambda endpoint you hold a REFERENCE to — the handler function
 *         itself, in this process
 * .why = shapes cross this boundary as live object references, so you are the
 *        endpoint's HOST rather than its caller — and a host sees what the
 *        function returned (define.lambda-endpoint-run-boundary)
 *
 * ## the error stance — a pass-through, both directions
 *
 * the handler RETURNS a constraint envelope ⇒ this returns it, stripped. the
 * handler THROWS a malfunction ⇒ this lets it throw, untouched.
 *
 * ⚠️ it does NOT convert an envelope into a throw — that is the WIRE's job
 *    (`getParsedResponse`), and it is what makes `onSerialized` throw where this
 *    returns. nor does it swallow a throw: that needs a `catch` over a server
 *    fault (rule.forbid.failhide).
 *
 * ## the fidelity guard
 *
 * the event is json-stripped inbound and the output json-stripped outbound. this
 * boundary crosses no wire, so without the strip a `Date` survives either way and
 * a test passes on a shape the wire could never deliver.
 *
 * ## 🔴 the dialect frames the INPUT too, not only the answer
 *
 * | dialect | the handler RECEIVES | it must ANSWER |
 * |---------|---------------------|----------------|
 * | `contemp` (default) | `{ event, trail }` — the wrapper IS the declaration | the nested envelope |
 * | `ancient` | the event, untouched | the flat `{ errorMessage, errorType }` |
 *
 * a `genLambdaEndpoint` handler never notices — `genTrailMiddleware` unwraps the
 * frame first. a PLAIN handler does, and the failure is QUIET: contemp-framed, it
 * reads `event.uuid` off the wrapper, finds `undefined`, and takes its own reject
 * branch — a rejection envelope on the success case, with no type error anywhere.
 *
 * ⇒ so a legacy `createStandardHandler` handler needs `struct: { payload: 'ancient' }`.
 *   the frame is DERIVED from `struct.payload`, never from `trail`, so the two
 *   cannot disagree.
 *
 * ## two gates stand between a call and an error field, in order
 *
 * the return is a UNION — `TOutput | Envelope` — because a caller fault is a
 * legitimate answer. so the union rejects every error field on either dialect;
 * narrow FIRST, and only then does the dialect decide which fields you may read.
 *
 * @example
 * ```ts
 * // success — the handler's validated output, wire-stripped
 * const out = await runLambdaEndpoint.onReferenced({ event: { uuid }, handler });
 * expect(asLambdaEndpointOutput(out).found).toEqual(true);
 *
 * // a caller fault — an envelope, RETURNED. the lambda succeeded.
 * const res = await runLambdaEndpoint.onReferenced({ event: { uuid: 'bad' }, handler });
 * expect(asLambdaEndpointErrorEnvelopeContemp(res).error.class).toEqual('ConstraintError');
 *
 * // the ancient dialect, opt-in — declared on the call, and again on the narrow
 * const old = await runLambdaEndpoint.onReferenced({
 *   event: { uuid: 'bad' }, handler, struct: { payload: 'ancient' },
 * });
 * expect(asLambdaEndpointErrorEnvelopeAncient(old).errorType).toEqual('BadRequestError');
 *
 * // a malfunction — THROWN, untouched, on either dialect
 * await expect(
 *   runLambdaEndpoint.onReferenced({ event, handler: brokenHandler }),
 * ).rejects.toThrow(MalfunctionError);
 * ```
 */
export const onReferenced = async <
  TEvent,
  TOutput,
  TDialect extends LambdaEndpointDialect = 'contemp',
>(input: {
  /**
   * the event to send, as the endpoint's own input shape
   */
  event: TEvent;

  /**
   * the handler to run — held by reference, so no slug and no `at`
   *
   * 🔴 the `any` on the EVENT slot is deliberate — every alternative was probed:
   *
   *    | event param | consumer errors | why |
   *    |---|---|---|
   *    | `unknown` | **24** | contravariant under `strictFunctionTypes`, so it demands a handler that accepts EVERY shape — it refuses every typed handler |
   *    | `never` | 0 | variance-correct, and then `handler(payload, …)` cannot compile |
   *    | `TEvent`, both slots | 0 | works, and 🔴 rejects a schema-rejection fixture (`TS2741`) and a wire-hostile `Date` (`TS2322`) |
   *    | `any` | 0 | what ships |
   *
   * 🔴 the `TEvent` row is the one to hold: a handler's event type is the
   *    POST-validation shape, so a test that proves *"the schema refuses this"*
   *    must send an event that does not fit it. to bind `TEvent` bars `[case2]`
   *    and `[case4]`, the two experiences the util was built for.
   *
   * ⇒ the looseness is caught at RUNTIME — `assertHandlerIsRunnable` below.
   */
  handler: LambdaEndpointHandlerReferenced<any, TOutput>;

  /**
   * which error dialect the endpoint answers in. contemp by default.
   */
  struct?: { payload: TDialect };

  /**
   * the trail to carry. supplies the exid only — it never selects the dialect.
   */
  trail?: { exid?: string } | null;

  /**
   * overrides for the aws lambda context the handler receives
   */
  context?: Partial<Context>;
}): Promise<LambdaEndpointRunOutput<TOutput, TDialect>> => {
  // 🔴 an ABSENT event is REFUSED, never defaulted to `{}`. the corpus settles
  //    the direction: `event: {}` is the measured convention for an endpoint
  //    that takes no input (`event: undefined` → 0 matches across `ahbode/*`).
  //
  //    ⚠️ the row the guard is owed for is a plain handler that READS rather
  //       than derefs — `(e) => e.slug` raises no error at all, so it answers a
  //       success-shaped value for work that ran on no input
  //       (`rule.forbid.failhide`).
  assertEventIsGiven({ event: input.event, metadata: null });

  // the dialect declares the frame; an unknown value is REFUSED, never fallen
  // through — see `asLambdaEndpointDialect` for why
  const dialect: LambdaEndpointDialect = asLambdaEndpointDialect({
    declared: input.struct?.payload,
  });

  // strip inbound, so no live object reaches the handler that the wire could not deliver
  // `of: 'event'` — a refusal here is the CALLER's payload, so it raises a ConstraintError
  const eventStripped = asWireStripped({ value: input.event, of: 'event' });

  // frame the payload, so the endpoint reads the dialect the caller declared
  const payload = asFramedPayload({
    event: eventStripped,
    trail: input.trail ?? null,
    dialect,
  });

  const context = asLambdaContext(input.context);

  // shared with the serialized boundary, which needs it ahead of its delegation
  assertHandlerIsRunnable({ handler: input.handler });

  // run it. a throw crosses untouched — this util adds no catch, and the absence
  // is clamped for both actors (`[case3][t0]/[t1]`, `[case7][t2]`).
  const output = await input.handler(payload, context);

  // strip outbound, so no live object reaches the author that the wire would flatten
  // `of: 'output'` — a refusal here is the HANDLER's return ⇒ MalfunctionError
  //
  // .as = a checker limit, never a shapefit dodge. `LambdaEndpointRunOutput` is a
  //   CONDITIONAL on an unresolved `TDialect`, which typescript cannot reduce
  //   inside a generic body; it resolves at every call site.
  return asWireStripped({
    value: output,
    of: 'output',
  }) as LambdaEndpointRunOutput<TOutput, TDialect>;
};
