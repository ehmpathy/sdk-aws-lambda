import { isErrorLike } from '../error/isErrorLike';
import { asErrorTypeOfErrorLike } from './asErrorTypeOfErrorLike';

/**
 * .what = the message the aws node runtime writes when its own reads of a thrown value throw
 * .why = `toRapidResponse`'s catch arm answers `errorType: 'handled'` with this fixed text and
 *        no trace (`aws-lambda-nodejs-runtime-interface-client`, `src/Errors.js`), so a local
 *        run shows the caller the same words the cloud does
 */
const RUNTIME_HANDLED_MESSAGE =
  'callback called with Error argument, but there was a problem while retrieving one or more of its message, name, and stack';

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
   *        red prod (sdk-aws-lambda#73). so a throw reads here exactly as it
   *        reads on the cloud, whatever its `.name`.
   * .note = never `instanceof Error`: it fails across realms, and this runs where
   *         two meet (the local locus loads the handler through
   *         `getOneHandlerFromServerlessYml`; jest gives each module its own vm
   *         context). the reason lives at `isErrorLike`
   * .note = the LABEL mirror is exact, the lossy parts included: `errorType`
   *         may be any `typeof` (`'object'`, `'symbol'`, …) or the runtime's own
   *         `'handled'` (a stackless native error), which carries the runtime's
   *         one fixed message and no trace. a thrown `null` or `undefined` never
   *         reaches `toRapidResponse`: the runtime's `CallbackContext.fail` swaps
   *         it for the string `'handled'` first, so the wire reads
   *         `errorType: 'string'`, `errorMessage: 'handled'` (measured by
   *         `blackbox/deployed.faultLabel.acceptance.test.ts`). and a
   *         thrown object with no message reads `errorMessage: '[object Object]'`,
   *         as the runtime's own `${error}` writes it. a local cast that read
   *         better than prod would hide what prod shows; to carry a cause, throw
   *         an `Error`. an error-like value that fails `_isError` keeps its
   *         message and stack here — the label, which decides the fault side,
   *         is the field held to the cloud's bytes
   */
  // the runtime's fail arm swaps a null or undefined rejection for the string 'handled'
  const thrown = error === null || error === undefined ? 'handled' : error;

  // the runtime's catch arm writes one fixed message and no trace, whatever was thrown
  const errorType = asErrorTypeOfErrorLike({ error: thrown });
  if (errorType === 'handled')
    return {
      errorMessage: RUNTIME_HANDLED_MESSAGE,
      errorType,
      stackTrace: [],
    };

  if (!isErrorLike(thrown))
    return {
      errorMessage: String(thrown),
      errorType,
      stackTrace: [],
    };

  return {
    errorMessage: thrown.message,
    errorType,
    // `stack` is optional on a real Error
    stackTrace:
      typeof thrown.stack === 'string' ? thrown.stack.split('\n') : [],
  };
};
