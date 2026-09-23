/**
 * .what = refuse a deploy with no aws credentials, then assemble the declastruct context
 *         every `deployed.*.acceptance.test.ts` suite passes to its aws operations
 * .why = all four deployed suites opened with the identical 8 lines — the same two env
 *        probes, the same `ConstraintError` message, the same hint, the same provider
 *        call. that is rule.prefer.wet-over-dry's threshold, doubled
 *
 * ⚠️ .why the guard and the provider are ONE operation = `getDeclastructAwsProvider` with
 *         no credentials fails deep in the aws sdk with a message that names no fix. the
 *         guard exists to fail FIRST, with the unlock command a human can run
 *         (rule.require.failfast, rule.require.errors-name-the-fix). so the two are one
 *         narrative — "hand me a context I can deploy with, or tell me how to get one" —
 *         rather than two concerns that happen to sit together
 *
 * ⚠️ .why there are TWO failure answers below, not one = the credential question has two arms,
 *         and the guard reaches only the first. ABSENT is a caller constraint the guard can
 *         name outright; PRESENT-BUT-REFUSED is a class we cannot classify from here, so it is
 *         wrapped rather than pre-judged. for two rounds this file carried only the guard and
 *         recorded the second arm as covered — see the correction in `setLambdaRole.ts`'s sweep
 *
 * ⚠️ .why the hint names `--env test`, where prod code nearby names `prep` = a keyrack grant
 *         is keyed on `(org, env, key)`, and every caller of this operation is a
 *         `deployed.*.acceptance.test.ts` suite whose env file sources
 *         `keyrack.source({ env: 'test', owner: 'ehmpath' })`
 *         (`jest.acceptance.env.ts:89`). so an unlock at `--env prep` grants
 *         `ehmpathy.prep.AWS_PROFILE`, which a `test`-scoped source cannot read — the human
 *         runs the command, it reports success, and the suite fails again with THIS message.
 *         a hint that sends the reader in a circle is worse than none
 *         (rule.require.errors-name-the-fix)
 *
 *         `.agent/keyrack.yml` places `AWS_PROFILE` under `env.all`, so the `test` tier
 *         does carry it. and the repo's other unlock hints already say `--env test`, which
 *         agrees with `jest.integration.env.ts`'s own `env: 'test'`
 *
 * ⚠️ .why the credential probe below is NOT extracted to join the two `jest.*.env.ts` guards =
 *         the family reads as three and is two-plus-one, on two axes:
 *
 *         1. the QUESTION differs. the env guards ask *"is any credential HINT present?"*
 *            (`AWS_PROFILE || AWS_ACCESS_KEY_ID`). this asks *"is a COMPLETE credential
 *            present?"* — a static key is only usable with its secret, so this demands both.
 *            a box that exports `AWS_ACCESS_KEY_ID` alone passes the env guard and is refused
 *            here, which is the correct split: the env guard gates the whole SUITE, this gates
 *            a DEPLOY
 *         2. the two env guards are jest BOOT files, and `jest.acceptance.env.ts:36-40`
 *            already settles the shape for this repo — a boot-file guard's correctness is a
 *            property of WHERE THE LINE SITS, so an extraction moves it into the module graph
 *            and buys an import-time side effect. three reviewers named that hazard on the
 *            IMDS assignment and the verdict was the same: the reasoning lives once, the line
 *            stays at each site
 *
 *         so the shared part is three lines, and what varies is the strictness, the error
 *         class, the message, the hint, and the `requiresAwsAuth` gate. that is under
 *         rule.prefer.wet-over-dry's bar, not over it
 *
 * .note = a `get` of the assemble subtype: it composes a value from sources and mutates
 *         no state (rule.require.get-set-gen-verbs)
 */
import type { getDeclastructAwsProvider } from 'declastruct-aws';
import { ConstraintError, MalfunctionError } from 'helpful-errors';

/**
 * .what = the fix half of each of the two refusals below, hoisted to a name
 * .why = these two strings ARE this operation's value to a human — they are what an
 *        engineer reads when a deploy suite cannot run. the tier in each is the one
 *        character a careless edit would change, and it was the root cause of two prior
 *        multi-round failures on this branch (rule.require.errors-name-the-fix)
 *
 * ⚠️ .why EXPORTED rather than inline = the REFUSED arm fires only when a live aws says no,
 *    which is a remote boundary a unit test may not cross
 *    (`rule.forbid.unit.remote-boundaries`). so while it sat inline, its text was
 *    unreachable by any clamp that does not mock — and a mock would clamp the mock
 *    ⇒ a name makes the STRING testable without the CALL. the arm's behavior stays
 *      uncovered and stated; the text it would emit no longer is
 */
export const DEPLOY_CREDENTIAL_HINT_ABSENT =
  'run: rhx keyrack unlock --owner ehmpath --env test';

export const DEPLOY_CREDENTIAL_HINT_REFUSED =
  'a credential WAS present, so it is stale or scoped wrong rather than absent. re-run: rhx keyrack unlock --owner ehmpath --env test';

/**
 * .what = the WHOLE surface the refused arm emits — its message and its metadata, which
 *         `helpful-errors` serializes INTO that message
 * .why = ⚠️ the hint alone was hoisted first, and a reviewer raised across three rounds that
 *        a hint is a FRAGMENT: the surface a human meets is the wrap message plus the facts
 *        beside it, and the prior clamp graded one string out of that whole
 *        (`i003.r002.nitpick.3`, `i004.r002.nitpick.1`, `i004.r004.nitpick.2`)
 *
 *        for two of those rounds the answer was a deferral to the credential gate. that was
 *        HALF right, and the half it got wrong is the same half the hints got wrong before
 *        they were named: the arm's BEHAVIOR needs a live aws, and its TEXT never did
 *        ⇒ so the frame is a value this subject owns, and a name makes it assertable with no
 *          call at all — the identical move, one level up
 *
 * .why a getter rather than a constant = `profile` reads the ambient env, so it must be read
 *      at the moment of the refusal rather than at module load
 *
 * .note = a `get` of the assemble subtype: it composes a value from sources and mutates no
 *         state (rule.require.get-set-gen-verbs)
 */
export const getOneDeployCredentialRefusal = (): {
  message: string;
  metadata: { profile: string | null; viaStaticKeys: boolean; hint: string };
} => ({
  message: 'getOneDeployContext: aws refused the credential that was present',
  metadata: {
    profile: process.env.AWS_PROFILE ?? null,
    viaStaticKeys: !process.env.AWS_PROFILE,
    hint: DEPLOY_CREDENTIAL_HINT_REFUSED,
  },
});

export const getOneDeployContext = async (): Promise<{
  context: Awaited<ReturnType<typeof getDeclastructAwsProvider>>['context'];
}> => {
  // refuse early, with the fix, rather than deep in the aws sdk with a bare message
  const hasProfile = !!process.env.AWS_PROFILE;
  const hasKeys =
    !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
  if (!hasProfile && !hasKeys)
    throw new ConstraintError('AWS credentials required for e2e test', {
      hint: DEPLOY_CREDENTIAL_HINT_ABSENT,
    });

  /**
   * ⚠️ .why the sdk is imported HERE rather than at the top of the file = a top-level
   *         `import { getDeclastructAwsProvider }` loads the whole `declastruct-aws` graph the
   *         instant this module is required — and that graph reaches `@noble/hashes`, which
   *         ships ESM only. MEASURED: a test file that imports this operation fails to load at
   *         all under the unit transform, with `SyntaxError: Cannot use import statement
   *         outside a module`, BEFORE any case runs
   *
   *         ⇒ so the guard above — which is pure env logic and crosses no boundary — was
   *           unreachable by a unit test purely because of an import its refusal path never
   *           uses. the type-only import keeps the return type honest and emits no require
   *
   * ⇒ and the second reason is the better one: a caller with NO credential now pays no sdk
   *   load at all. the refusal was always the fast path; until this line it was the slow one
   */
  const { getDeclastructAwsProvider } = await import('declastruct-aws');

  /**
   * ⚠️ .why the WRAP, where the guard above already refuses = the guard covers ONE arm. it
   *         asks whether a credential is PRESENT; it cannot ask whether the present one still
   *         WORKS. an expired sso token, a wrong-account identity, a revoked permission chain
   *         each sail past it and fail deep in the aws sdk with a message that names neither
   *         the operation nor a fix
   *
   *         ⇒ this frame is now the ONE shared answer for all four `deployed.*` suites, so the
   *           consolidation RAISED the cost of a bare call: one contextless failure now serves
   *           four consumers (rule.require.failloud)
   *
   * .why MalfunctionError rather than ConstraintError = we cannot tell the two apart from here.
   *      a stale credential is the human's to fix, an aws outage is not, and the sdk error is
   *      what distinguishes them — so the wrap preserves that cause rather than asserts a
   *      class, and the hint names the likeliest first move without a claim that it is the only
   *      one (invariant.badrequesterror-not-lambda-error)
   */
  const provider = await MalfunctionError.wrap(
    () => getDeclastructAwsProvider({}, { log: console }),
    getOneDeployCredentialRefusal(),
  )();
  return { context: provider.context };
};
