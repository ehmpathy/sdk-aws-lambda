import { HelpfulError } from 'helpful-errors';

import { LambdaCredentialsAbsentError } from '../../../domain.objects/LambdaCredentialsAbsentError';

/**
 * .what = decide whether an error is an aws sdk credentials failure, ANYWHERE in
 *         its cause chain
 * .why = a creds failure is caller-must-fix (unlock + retry) at every boundary a
 *        DEVELOPER drives, so it is worth a named error rather than aws's own
 *
 * 🔴 the CHAIN WALK removes a dependency on a peer file's message format. the
 *    invoke path wraps first (`executeLambdaInvocation.ts:63`), so the top-level
 *    name is `LambdaEndpointError` and the only thing that carries *"credentials"*
 *    up to it is an interpolated `${error.message}` — a format choice a reasonable
 *    edit would quietly end.
 *
 *    ⚠️ probed: a detector reduced to a top-level read leaves `[case12]` GREEN, so
 *      the walk is not what makes the invoke path work today. `[case2]` of this
 *      file's unit suite is what bites.
 *
 *    ⇒ a belt-and-braces guard on a live coupling, worth its four lines because a
 *      dead detector fails QUIET — it returns `false`, the error rethrows, and the
 *      developer is back to aws's own string with no test red.
 */
export const getIsCredentialsError = (
  error: unknown,
  // 🔴 a SET, never a `cause === error` self-compare — that catches a one-step
  //    cycle and recurses to `RangeError` on a two-step one (`A→B→A`). a stack
  //    overflow REPLACES the real error with a crash that names neither the fault
  //    nor the fix, which is worse than the quiet failure above.
  seen: Set<unknown> = new Set(),
): boolean => {
  // 🔴 `instanceof Error`, NOT the shared `isErrorLike` duck-type: the line below
  //    reads `error.name`, which a `.message`-only shape check does not guarantee.
  //    the cross-realm risk is bounded here — both callers raise the aws sdk error
  //    in-realm, so a realm-foreign `Error` cannot reach this gate.
  if (!(error instanceof Error)) return false;
  if (seen.has(error)) return false;
  seen.add(error);

  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();

  /**
   * 🔴 the MESSAGE arm reads AWS's vocabulary, so it applies only to an error aws
   *    raised. a `HelpfulError`'s `.message` at these boundaries is most often the
   *    HANDLER's own text — `getParsedResponse` hydrates a caller fault into a
   *    bare `ConstraintError` that carries whatever the endpoint rejected with.
   *
   *    ⇒ so an endpoint whose DOMAIN is credentials rejects with *"credential is
   *      invalid for this surfer"*, and an unguarded match would send the
   *      developer to unlock a credential that was never absent — a hint that is
   *      confident and wrong, which is worse than none.
   *
   * ✅ it costs no reach: a genuine aws fault wrapped by a `HelpfulError` is still
   *    found through `metadata.cause`, where both arms apply.
   *
   * 🟡 the NAME arm is left unguarded — a class name does not survive the wire.
   */
  const isAwsRaised = !(error instanceof HelpfulError);
  const isMatchHere =
    name.includes('credential') ||
    (isAwsRaised &&
      (message.includes('credential') ||
        (message.includes('security token') && message.includes('expired'))));
  if (isMatchHere) return true;

  // walk the cause, so a wrap at any depth cannot hide the fault. `cause` is
  // read off both the standard `Error.cause` and `helpful-errors`' metadata,
  // which is where this repo's own wrappers put it.
  const cause =
    (error as { cause?: unknown }).cause ??
    (error as { metadata?: { cause?: unknown } }).metadata?.cause;
  if (cause === undefined) return false;
  return getIsCredentialsError(cause, seen);
};

/**
 * .what = maps an aws credentials failure to a hinted `LambdaCredentialsAbsentError`;
 *         rethrows every other error unchanged
 * .why = an absent credential is the one aws fault a developer fixes in ONE
 *   command, and aws's *"Could not load credentials from any providers"* says
 *   naught about which env, which owner, or what to run.
 *
 * 🔴 the boundary this must NOT be wired into: `askLambdaEndpoint`, a RUNTIME
 *    caller. same aws error, opposite diagnosis —
 *
 *    | boundary | who meets it | an absent credential is |
 *    |---|---|---|
 *    | `getAllLambdaContracts`, `onSerialized({ at: 'cloud' })` | a developer, at a terminal | an expired sso session |
 *    | `askLambdaEndpoint` | a deployed lambda, in prod | a broken execution role |
 *
 *    `LambdaCredentialsAbsentError extends ConstraintError` ⇒ caller fault, no
 *    retry, NO ALARM (invariant.badrequesterror-not-lambda-error). to map it on
 *    the runtime path would suppress the prod alarm that names a broken role.
 *
 *    ⚠️ so the runtime path's lack of this mapper is a DESIGN, not a gap.
 */
export const throwIfCredentialsError = (input: {
  error: unknown;
  message: string;

  /**
   * .what = the env the caller addressed, so the hint names THEIR env
   * .why = a hardcoded `--env prep` names the WRONG env for a `prod` caller, and
   *   a wrong hint is worse than none — it reads authoritative and sends the
   *   developer to unlock a credential that was never the one absent.
   */
  access: string;

  metadata: Record<string, unknown>;
}): never => {
  if (!getIsCredentialsError(input.error)) throw input.error;
  throw new LambdaCredentialsAbsentError(input.message, {
    ...input.metadata,
    hint: `unlock aws creds (e.g. \`rhx keyrack unlock --owner ehmpath --env ${input.access}\`), then re-run`,
    cause: input.error instanceof Error ? input.error : undefined,
  });
};
