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
   * .what = labels the payload exactly as the aws node runtime labels it, read by duck-type
   * .why = 🔴 the cloud wire is the truth this cast must reproduce. the runtime's
   *        `toRapidResponse` (`aws-lambda-nodejs-runtime-interface-client`,
   *        `src/Errors.js`) writes `errorType: error.name` for an error, and
   *        `errorType: typeof error` for any other thrown value. a read of
   *        `constructor.name` instead labels a helpful-errors `ConstraintError`
   *        (whose `.name` is the inherited `'Error'`) as a caller fault locally
   *        while the cloud labels it a server fault — a green local run over a
   *        red prod (sdk-aws-lambda#73). `genLambdaEndpoint` names a throw from
   *        its class before it escapes (`genErrorNameMiddleware`); a handler
   *        built without it reads here exactly as it reads on the cloud.
   * .note = never `instanceof Error`: it fails across realms, and this runs where
   *         two meet (the local locus loads the handler through
   *         `getOneHandlerFromServerlessYml`; jest gives each module its own vm
   *         context). the reason lives at `isErrorLike`
   * .note = the LABEL mirror is exact, the lossy parts included: `errorType`
   *         may be any `typeof` (`'object'`, `'undefined'`, `'symbol'`, …), and a
   *         thrown object with no message reads `errorMessage: '[object Object]'`,
   *         as the runtime's own `${error}` writes it. a local cast that read
   *         better than prod would hide what prod shows; to carry a cause, throw
   *         an `Error`. an error-like value that fails `_isError` keeps its
   *         message and stack here — the label, which decides the fault side,
   *         is the field held to the cloud's bytes
   */
  if (!isErrorLike(error))
    return {
      errorMessage: String(error),
      errorType: typeof error,
      stackTrace: [],
    };

  return {
    errorMessage: error.message,
    errorType: asErrorTypeOfErrorLike({ error }),
    // `stack` is optional on a real Error
    stackTrace: typeof error.stack === 'string' ? error.stack.split('\n') : [],
  };
};

/**
 * .what = the wire label of an error-like value, as the runtime writes it
 * .why = the runtime's `_isError` labels by `.name` only an object whose `name`,
 *        `message` and `stack` are all strings; any other value it labels
 *        `typeof error`. a `{ name, message }` bag with no `stack` is `'object'` on
 *        the cloud, so it must be `'object'` here too, or a caller fault flips side
 */
const asErrorTypeOfErrorLike = (input: {
  error: { name?: unknown; message?: unknown; stack?: unknown };
}): string =>
  typeof input.error === 'object' &&
  typeof input.error.name === 'string' &&
  typeof input.error.message === 'string' &&
  typeof input.error.stack === 'string'
    ? input.error.name
    : typeof input.error;
