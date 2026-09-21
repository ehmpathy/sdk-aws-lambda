import { ConstraintError } from 'helpful-errors';

import type { LambdaEndpointDialect } from '../../../domain.objects/LambdaEndpointDialect';
import { isLambdaEndpointErrorEnvelopeAnyDialect } from './isLambdaEndpointErrorEnvelope';
import type { LambdaEndpointErrorEnvelope } from './LambdaEndpointRunOutput';

/**
 * .what = the predicate half of the narrow below
 * .why = `asLambdaEndpointOutput` needs a type guard to return from. a consumer
 *        needs the assert form only — a bare boolean read on this union serves
 *        naught that `!isLambdaEndpointErrorEnvelopeAnyDialect(x)` does not already.
 *
 * 🔴 **it subtracts BOTH dialects' envelopes**, because the success arm is what
 *    remains once every constraint envelope is removed — and a run's dialect is
 *    not known here (the value carries no dialect; the caller declared one on the
 *    call). so it reads the any-dialect guard, which is contemp-tag OR
 *    ancient-shape. F22 split the two public narrows by dialect; this private one
 *    stays over both, because that is the honest complement of "the output".
 *
 * 🔴 **it is private, so every fact a CONSUMER must hold belongs on the export
 *    below.** typescript emits a `.d.ts` entry only for what is exported, and a
 *    comment travels with the declaration it annotates — probed against the
 *    emitted `.d.ts`, a note parked here reaches no consumer at all.
 */
const isLambdaEndpointOutput = <TRun>(
  output: TRun,
): output is Exclude<
  TRun,
  LambdaEndpointErrorEnvelope<LambdaEndpointDialect>
> => !isLambdaEndpointErrorEnvelopeAnyDialect(output);

/**
 * .what = asserts a run output IS the handler's output, and narrows it
 * .why = the union refuses a field read on EITHER arm, so the SUCCESS path needs
 *        a narrow exactly as the error path does.
 *
 * 🔴 **the SUCCESS arm is not privileged, and it is the majority case.** a reader
 *    who knows the error arm needs `asLambdaEndpointErrorEnvelopeContemp` will
 *    assume a bare `res.field` works on the other side. it does not — typescript
 *    refuses a field that is not on every arm:
 *
 *      TS2339: Property 'scheduledAt' does not exist on type
 *              'LambdaEndpointRunOutput<{ scheduledAt: string; }, "contemp">'.
 *        Property 'scheduledAt' does not exist on type
 *              'LambdaEndpointErrorResponseBodyContemp'.
 *
 * ⚠️ **and this repo's own suite cannot catch its absence, by construction.** every
 *    test here asserts with a WHOLE-OBJECT `toEqual({ … })`, which takes `unknown`
 *    and so exercises no field read at all. ⇒ a green suite is no evidence that
 *    this narrow exists or works; only a sample run through the type gate is.
 *
 * .note = the dialect needs no declaration here, unlike its error-side twin.
 *   `Exclude` distributes over the union and subtracts the envelope arm, so
 *   `TRun` survives inference. the asymmetry is a property of `Exclude`, never a
 *   design preference — the NAME pair stays symmetric.
 *
 * ✅ **the narrowed type states the outbound strip — fulcrum F13, closed.**
 *    `TOutput` is the type the HANDLER declares, and the util JSON-strips what
 *    it returns, so the two disagree. `LambdaEndpointRunOutput` carries
 *    `WireStripped<TOutput>` rather than `TOutput`, and the narrow inherits it:
 *    a handler typed `{ scheduledAt: Date }` narrows to `{ scheduledAt: string }`.
 *
 *      const out = asLambdaEndpointOutput(res);
 *      out.scheduledAt.toISOString();   // 💥 no longer compiles — TS2339
 *
 *    clamped in `advertisedExamples.test.ts` `[case8][t2]` and in
 *    `LambdaEndpointRunOutput.test.ts`, which asserts the `Date` → `string`
 *    map directly rather than through a run.
 *
 * @example
 * ```ts
 * const res = await runLambdaEndpoint.onReferenced({ event, handler });
 * expect(asLambdaEndpointOutput(res).scheduledAt).toEqual('2026-09-03T14:00:00.000Z');
 * ```
 */
export const asLambdaEndpointOutput = <TRun>(
  output: TRun,
): Exclude<TRun, LambdaEndpointErrorEnvelope<LambdaEndpointDialect>> => {
  if (isLambdaEndpointOutput(output)) return output;

  // 🟡 the hint names the LIKELY cause AND the one case where it is wrong.
  //
  //  🔴 this narrow cannot know the run's declared dialect, so it reads the
  //     ANY-dialect guard — `contemp-tag OR ancient-shape`. the ancient arm (a
  //     flat `{ errorMessage, errorType }` pair) therefore runs on every call,
  //     and a handler whose legitimate SUCCESS output carries those two string
  //     keys reads as an envelope on EITHER dialect.
  //
  //  ⇒ a confident wrong *"the handler rejected this event"* sends an author to
  //    search for a rejection that never happened, so the hint states the
  //    ambiguity (`rule.require.errors-name-the-fix`).
  throw new ConstraintError(
    'the endpoint answered with a constraint envelope, never an output',
    {
      output,
      hint: 'the handler rejected this event. assert on the envelope via asLambdaEndpointErrorEnvelopeContemp (or …Ancient if you declared the ancient dialect), or send an event the schema accepts. — on EITHER dialect, one other cause is possible: this success narrow subtracts both envelope shapes, so the flat { errorMessage: string, errorType: string } pair reads as an envelope even under contemp. if that is your success output shape, read it directly rather than through this narrow.',
    },
  );
};
