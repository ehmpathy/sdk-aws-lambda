import { isErrorLike } from '../error/isErrorLike';

/**
 * .what = casts a thrown handler fault into the envelope aws puts on the wire
 * .why = 🔴 **a THROW does not cross a wire; a payload does.** on the cloud locus
 *        aws answers `{ errorMessage, errorType, stackTrace }` and
 *        `getParsedResponse` hydrates it. the local locus runs the handler in
 *        THIS process, so without this cast its throw escapes as the handler's
 *        own class — and one malfunction arrives as two classes on the two loci,
 *        which is `at` altering the contract it exists to hold constant.
 *
 * ## 🔴 what this DROPS — the placement rule every guard owes
 *
 * ⚠️ **the CANONICAL account; three peers cite it and none restates it** — both
 *    `guard/assert*.ts` and both `runLambdaEndpoint.on*.ts` call sites. it lives
 *    here because the rule and its cause die together.
 *
 * the cast carries three fields and no `metadata`, so no `hint`. ⇒ **every guard
 * in `runLambdaEndpoint` runs AHEAD of the delegation, never inside it** — a
 * guard that fires inside `.catch(asWireFunctionErrorPayload)` answers a
 * local-locus caller with its fix demoted out of a structured field:
 *
 * | | inside the delegation | ahead of it |
 * |---|---|---|
 * | error class | unchanged | unchanged |
 * | the hint TEXT | present, buried in `stackTrace` | present |
 * | `metadata.hint` | ❌ absent | ✅ present |
 *
 * 🟡 the obvious alternative — preserve `metadata` when the error carries a hint
 *    — is what `[t4]` of `runLambdaEndpoint.onSerialized.integration.test.ts`
 *    forbids: aws sends no `metadata`, so a local locus that kept it would hand
 *    a richer error than cloud can produce. that is the divergence the fix was
 *    meant to remove, reintroduced.
 *
 * .note = a wrap-and-rethrow, never a `rule.forbid.failhide` — the fault is
 *   re-raised through the one shared hydration.
 */
export const asWireFunctionErrorPayload = (
  error: unknown,
): { errorMessage: string; errorType: string; stackTrace: string[] } => {
  /**
   * .what = reads the error by duck-type, never by `instanceof Error`
   * .why = 🔴 `instanceof` fails CROSS-REALM, and this runs where two realms
   *        meet: the local locus loads the handler through
   *        `getOneHandlerFromServerlessYml`, and jest executes each module in
   *        its own vm context.
   *
   * ⚠️ the miss is SILENT — it degrades the payload rather than throws:
   *    `errorMessage` gains an `Error: ` prefix, `errorType` collapses to
   *    `'Error'`, `stackTrace` is dropped. `getParsedResponse` hydrates from
   *    `errorType`, so a cross-realm `ConstraintError` comes back generic — a
   *    caller fault that no longer reads as one (`rule.forbid.failhide`).
   */
  if (!isErrorLike(error))
    return {
      errorMessage: String(error),
      errorType: 'Error',
      stackTrace: [],
    };

  return {
    errorMessage: error.message,
    errorType: error.constructor?.name ?? 'Error',
    // `stack` is optional on a real Error
    stackTrace: typeof error.stack === 'string' ? error.stack.split('\n') : [],
  };
};
