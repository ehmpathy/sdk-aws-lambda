/**
 * .what = upsert a lambda, then block until the code a caller would invoke is the code
 *         this call just uploaded
 * .why = every deployed suite's next act is an INVOKE or an INTROSPECT, and either one
 *        against stale code is a flake that reads as a product defect. four suites each
 *        rewrote this sequence, and it drifted: the `waitUntilFunctionUpdatedV2` step was
 *        added to `deployed.codegen` first and hand-copied into three peers afterward
 *
 * .note = `set` in the get/set/gen/del sense — an upsert that converges, so a re-run
 *         re-uploads and re-waits rather than leaves a duplicate behind
 *         (rule.require.idempotent-procedures)
 */
import {
  LambdaClient,
  waitUntilFunctionActiveV2,
  waitUntilFunctionUpdatedV2,
} from '@aws-sdk/client-lambda';
import { DeclaredAwsLambda, setLambda } from 'declastruct-aws';
import { MalfunctionError } from 'helpful-errors';

import { withRetry } from './withRetry';

/**
 * .what = the seconds each aws waiter is allowed to block
 * .why = one home for the wait budget, so the arithmetic below stays checkable
 */
const WAITER_MAX_WAIT_SECONDS = 60;

/** .what = how many times the upsert is re-driven while iam propagates */
const IAM_PROPAGATION_MAX_ATTEMPTS = 5;

/**
 * .what = how many of those attempts are RETRIES — the first is the attempt itself
 * .why = the progress line reads `retry N/M`, and M is the retry count rather than the
 *        attempt count. inline, the reader must simulate the subtraction to learn which
 *        of the two the denominator names (rule.forbid.inline-decode-friction)
 */
const IAM_PROPAGATION_RETRY_COUNT = IAM_PROPAGATION_MAX_ATTEMPTS - 1;

/** .what = the base backoff, multiplied by the attempt number */
const IAM_PROPAGATION_BACKOFF_MS = 3000;

/**
 * .what = `1 + 2 + … + upTo`, in closed form
 * .why = `withRetry` below sleeps `backoffMs * n` on retry n, so the TOTAL sleep is `backoffMs`
 *        times this sum. a name is what lets the term below read in one pass
 *        (rule.require.named-transformers)
 *
 * ⚠️ .what it REPLACES = an inline `Array.from({ length }, …).reduce(…)` fold. a reader had to
 *    simulate it — build `[3000, 6000, 9000, 12000]`, then add — and the tell was that the doc
 *    beside it restated the result in prose (`3s + 6s + 9s + 12s = 30s`), which is the code
 *    explained by a comment rather than by a name (`rule.forbid.inline-decode-friction`).
 *    four review lanes across two rounds named it before it was repaired
 */
const getSumOfFirstIntegers = (input: { upTo: number }): number =>
  (input.upTo * (input.upTo + 1)) / 2;

/**
 * .what = the total milliseconds the iam-propagation retry can sleep, across every backoff
 * .why = it is one term of `LAMBDA_DEPLOY_BUDGET_MS` below. the prior form of that budget
 *        stated this term as the literal `30s` inside a prose arithmetic, so a change to
 *        either constant above would have left the budget silently wrong
 *
 * .the arithmetic = 3000ms × (1+2+3+4) = 3000 × 10 = 30s at the values above
 */
const IAM_PROPAGATION_TOTAL_BACKOFF_MS =
  IAM_PROPAGATION_BACKOFF_MS *
  getSumOfFirstIntegers({ upTo: IAM_PROPAGATION_RETRY_COUNT });

/**
 * .what = how many aws waiters `setLambdaLive` blocks on, each for `WAITER_MAX_WAIT_SECONDS`
 * .why = the two are not interchangeable — one covers the CREATE path and one the UPDATE path
 *        (the `.why BOTH waiters` note further down says which). so the budget's worst case
 *        spends BOTH, and the count belongs beside the seconds it multiplies
 */
const WAITER_COUNT = 2;

/** .what = the milliseconds in one second, so the budget arithmetic below reads in one unit */
const MS_PER_SECOND = 1000;

/**
 * .what = the milliseconds the `setLambda` upsert itself can take — the phase that uploads
 *         the zip and creates or updates the function, BEFORE either waiter below is reached
 *
 * ⚠️ .why it is a NAMED term = a prior draft of the budget below folded this into "rounded up
 *         for the upload itself", which granted it ~10s of the 160s total. measured, the cold
 *         CREATE path takes more than fifteen times that — so the one term that was estimated
 *         rather than derived is the term that blew the budget
 *
 * .measured = `deployed.awsLambda.acceptance.test.ts`, cold, `svc-seaturtle-prod-goSurf`:
 *             the log's last deploy line is `deploy lambda...` followed by `setLambda.js.input`,
 *             and NEITHER `⏳ … await State=Active...` NOR `⏳ … iam propagation, retry` ever
 *             printed. ⇒ the hook died INSIDE `setLambda`, before the retry and before both
 *             waiters, with ~157s spent there
 *
 * .measured, WARM, for contrast = one full acceptance run, all six deployed functions:
 *             4384ms · 4445ms · 4511ms · 4624ms · 4677ms · 4846ms · 4893ms
 *           ⇒ ~4.9s warm against ≥157s cold — a ~32x spread. so the budget is set almost
 *             entirely by the CREATE path, and the warm path never approaches it
 *
 * 🔴 .STATUS = THIS VALUE IS MEASURED INSUFFICIENT, AND IS NOT REPAIRED HERE.
 *         a later, wider run put **≥357s** in one `setLambda` attempt — about twice this
 *         number. so the budget below does NOT cover the cold path, and a cold suite fails
 *         with a hook timeout that names no product defect
 *
 *    .proof it is live = `deployed.introspection.acceptance.test.ts`, widened past the
 *         `--changedSince=origin/main` default, cold: 7 failed with `Exceeded timeout of
 *         360000 ms for a hook`. the same suite warm is 7 passed in 25s, so no assertion is
 *         at fault. the phase is located by an ABSENT log line — no `⏱ … setLambda upsert
 *         took Nms` for `svc-seaturtle-prep-checkContract`, and preflight was 2.2s
 *
 *    .why the value is UNCHANGED rather than raised = the obvious bump is ruled out by
 *         arithmetic. to cover 357s puts `LAMBDA_DEPLOY_BUDGET_MS` at `30 + 357 + 120` ≈
 *         507s, and `deployed.codegen.refs`' four-lambda bound at `30 + 507 × 4` ≈ 34 min —
 *         past the 30-min bound that already rejected a 240s raise. ⇒ the open question is
 *         no longer a number; it is *which population the acceptance gate serves*, which is
 *         a wisher call, so a raise here would trade a known-wrong budget for a second one
 *
 *    ⚠️ .and the NEXT number must not come from a third truncated sample = both 157s and
 *         357s are FLOORS, cut off by their own timeouts. whoever takes this should measure
 *         with a budget large enough to let `setLambda` COMPLETE, so the run yields a real
 *         upper bound (rule.require.measure-the-value-you-emit)
 *
 *    ⇒ the fix options, the arithmetic, and the CI exposure:
 *      `.dream/v2026_09_18.fix.the-deploy-hook-budget-loses-on-a-cold-run.md`
 *      the decision record, `dirty` at 28%:
 *      `.behavior/…/.fulcrums/inventory.of=fulcrums.case=F34-lambda-upsert-budget-from-one-truncated-sample.md`
 *
 * .the 157s sample above is HISTORY, and it is kept = it is what raised this term from an
 *         estimated ~10s to a named constant, and its two confounds still apply (jest runs
 *         the deployed suites in PARALLEL, so four uploads compete; and it was a CREATE
 *         rather than an update). what it can no longer support is a claim of headroom
 */
export const LAMBDA_UPSERT_BUDGET_MS = 180_000;

/**
 * .what = the milliseconds ONE `setLambdaLive` call can take in its worst case
 * .why = a suite's `useBeforeAll` deploy hook must outlast this, or a cold deploy
 *        reads as a test failure rather than as latency. jest's global acceptance
 *        timeout is 90s (`jest.acceptance.env.ts`), set for "tests call downstream
 *        apis" — and a deploy is not that
 *
 * .the arithmetic = the iam-propagation retry (4 backoffs of 3s, 6s, 9s, 12s = 30s)
 *                   + the `setLambda` upsert above (180s)
 *                   + `waitUntilFunctionActiveV2` (60s) + `waitUntilFunctionUpdatedV2` (60s)
 *
 * ⚠️ .why every term is now NAMED and summed = this constant was a literal `160_000` whose
 *         doc claimed the same four terms, three of them derived and one "rounded up". a
 *         literal cannot be audited against its own arithmetic, so the one estimated term
 *         drifted an order of magnitude from reality with no reader able to see it. the sum
 *         below is checkable by inspection (rule.require.measure-the-value-you-emit)
 *
 * .why HERE and not in `jest.acceptance.env.ts` = every term of that arithmetic is a
 *      constant of THIS file. hold the budget away from the numbers it is derived from
 *      and the two drift with nobody the wiser — which is the exact defect measured
 *      below: the 90s global lives away from the arithmetic that determines it, and it
 *      was wrong for every deploy suite with not one reader to notice
 *
 * .measured = a re-bundle of `refTrophyHandlers.ts` forced a code upload, and all 9
 *             tests of `deployed.codegen.refs` failed with
 *             `Exceeded timeout of 90000 ms for a hook`. the same suite, re-run once
 *             the function was warm, passed 9/9 in 52s. so the defect was the budget,
 *             never the deploy
 */
export const LAMBDA_DEPLOY_BUDGET_MS =
  IAM_PROPAGATION_TOTAL_BACKOFF_MS +
  LAMBDA_UPSERT_BUDGET_MS +
  WAITER_MAX_WAIT_SECONDS * MS_PER_SECOND * WAITER_COUNT;

/**
 * .what = the milliseconds a deploy hook's PREFLIGHT takes — the three phases every
 *         `useBeforeAll` runs BEFORE it reaches the `setLambdaLive` budgeted above:
 *         `setLambdaZip` (esbuild bundle + zip), `getOneDeployContext` (keyrack + sts),
 *         and `setLambdaRole` (the iam upsert)
 *
 * ⚠️ .why it is MEASURED and not derived = neither preflight phase holds a waiter constant,
 *         so there is no arithmetic to sum the way the budget above sums two 60s waiters.
 *         both phases therefore emit an `⏱ … took Nms` line, so this number stays checkable
 *         by whoever next reads a deploy log (rule.require.measure-the-value-you-emit)
 *
 * .measured = one full acceptance run, all four deployed suites, WARM:
 *               bundle + zip     177ms · 190ms · 191ms · 349ms
 *               iam role upsert  1801ms · 1939ms · 1962ms · 2220ms
 *             ⇒ a warm preflight is ~2.6s at its worst. the value below is an order of
 *               magnitude above that, because the COLD path CREATES the iam role rather than
 *               finds it, and that create is the one term here nobody has yet measured
 *
 * .the asymmetry that sets the headroom = a budget set too HIGH costs a slow failure; one set
 *              too LOW costs a suite that fails on latency and reads as a product defect. so
 *              the headroom is deliberate, and the `⏱` lines are what keep it honest rather
 *              than arbitrary — a later reader can narrow it against a cold log
 */
export const LAMBDA_DEPLOY_PREFLIGHT_BUDGET_MS = 30_000;

/**
 * .what = the whole-hook budget a deployed suite's `useBeforeAll` must be given when it
 *         deploys ONE lambda — the preflight, plus the one `setLambdaLive` that follows it
 *
 * ⚠️ .why this exists, and the defect it repairs = all four deployed suites passed
 *         `LAMBDA_DEPLOY_BUDGET_MS` to `jest.setTimeout`, which budgets the WHOLE hook at
 *         what ONE of its four phases needs. the label is what caused it: read alone,
 *         `LAMBDA_DEPLOY_BUDGET_MS` reads as "the budget for a deploy", and a hook IS a
 *         deploy — so four independent call sites took the same wrong sense, and the
 *         doc-comment that says "ONE `setLambdaLive` call" never reached any of them
 *         (rule.forbid.ambiguous-labels — a label that reads two ways is the defect)
 *
 * .measured = `deployed.awsLambda.acceptance.test.ts`, cold: all 9 tests failed with
 *             `Exceeded timeout of 160000 ms for a hook`. the same suite re-run once warm
 *             passed 9/9 in 21s. ⇒ the defect was the budget, never the deploy
 *
 * ⚠️ .which term ACTUALLY squeezed, and the two wrong answers a log-read ruled out = the
 *    preflight is NOT the dominant cost, and a first draft of this note implied it was.
 *    measured warm, the preflight is ~2.6s. nor did the hook die in its waiters, which a
 *    second draft asserted from the `deploy lambda...` last line alone. the log settles it:
 *      · no `⏳ … await State=Active...` line for that function  ⇒ the waiters never ran
 *      · no `⏳ … iam propagation, retry` line                   ⇒ the retry never fired
 *    ⇒ the ~157s went into `setLambda` itself — the ONE term the old arithmetic estimated
 *      rather than derived, at ~10s. it is now `LAMBDA_UPSERT_BUDGET_MS`, named and summed
 *
 * .why the composition ALONE was insufficient = 30s of preflight over the old 160s gives a
 *      190s hook, and the observed cold upsert (≥157s) plus its two waiters (120s) already
 *      exceeds that. so this repair is BOTH — a budget scoped to the whole hook, and an
 *      arithmetic whose estimated term is replaced by a measured one
 *
 * ⚠️ .the sweep, and the axis the PRIOR round left unswept = this is the SECOND instance of
 *    one cause — "a deploy hook is granted less time than its phases need". the prior round
 *    swept the axis *"the 90s global in `jest.acceptance.env.ts` is too small"* and landed
 *    this per-file budget. it did not sweep *"and is the per-file budget itself scoped to the
 *    whole hook, or to one phase of it?"* — so the repair carried the identical defect one
 *    level in, and shipped green because a warm deploy hides it
 *    (rule.require.sweep-the-defect-class — sweep every axis the stated cause leaves unstated)
 *
 * .note = a suite that deploys N lambdas does NOT multiply this — the preflight runs once
 *         per hook, never once per lambda. it composes
 *         `LAMBDA_DEPLOY_PREFLIGHT_BUDGET_MS + LAMBDA_DEPLOY_BUDGET_MS * N` instead, which
 *         is what `deployed.codegen.refs` does
 */
export const LAMBDA_DEPLOY_HOOK_BUDGET_MS =
  LAMBDA_DEPLOY_PREFLIGHT_BUDGET_MS + LAMBDA_DEPLOY_BUDGET_MS;

/**
 * .what = whether a `setLambda` failure is the iam-propagation race rather than a real one
 * .why = a freshly-upserted iam role is not yet assumable when `setLambda` first asks, and
 *        aws reports that as a message rather than as a typed error. the match is a set of
 *        message fragments because the text varies by api path — narrow it and a retryable
 *        failure reads as terminal; widen it and a real defect gets re-driven 5 times
 *
 * ⚠️ .why NOT a bare `role` substring = the prior form's third clause was
 *         `message.includes('role')`, which matches any message that merely CONTAINS the
 *         word. so a TERMINAL fault that happens to name a role — an `AccessDenied`, a
 *         malformed policy, a region mismatch that echoes the role arn — was re-driven 4
 *         times and cost 30s of backoff before its real cause surfaced. the retry is
 *         bounded, so the cause was never hidden; it was made SLOW, and dressed up as
 *         eventual consistency (rule.forbid.maintenance-hazards)
 *
 * .the anchor = the two IAM-specific literals stay verbatim, because they are precise. only
 *               the broad clause is narrowed: a bare `role` must now co-occur with a FAILURE
 *               token. that keeps every message aws emits on this race and drops the ones
 *               that merely mention a role
 *
 * .note = private, and its one caller is below. a named predicate is what the retry body
 *         owes a reader (rule.require.named-transformers); an exported one would be a
 *         speculative lift (rule.prefer.most-common-denominator)
 */
const isIamPropagationRetryable = (error: Error): boolean =>
  error.message.includes('AssumeRole') ||
  error.message.includes('cannot be assumed') ||
  (/\brole\b/i.test(error.message) &&
    /\b(cannot|could not|unable|not authorized|does not exist|invalid)\b/i.test(
      error.message,
    ));

/**
 * ⚠️ .where `withRetry` went = `./withRetry.ts`, with its own test beside it. it held no
 *    subject — no lambda, no iam, no aws — so it mixed a generic retry primitive into a file
 *    whose other three grains are all lambda-deploy specific
 *    (rule.require.single-responsibility)
 *
 * .why `isIamPropagationRetryable` STAYED = it is the opposite case. it names one aws race by
 *      its message text, and it is meaningful only beside the deploy that provokes that race.
 *      to move it with the retry would be to lift a subject-bound predicate into a generic
 *      home — the very mix the move above undoes (rule.prefer.most-common-denominator)
 */

/**
 * .why BOTH waiters = they block on different fields, and neither covers the other:
 *   - `waitUntilFunctionActiveV2` blocks on `State`, which an EXTANT function already
 *     reports as `Active` throughout an update — so on the update path it returns at
 *     once, and it proves only that the function exists
 *   - `waitUntilFunctionUpdatedV2` blocks on `LastUpdateStatus: Successful`, which is
 *     the field that actually moves on an update (`InProgress` → `Successful`)
 *   ⇒ the first covers the CREATE path, the second covers the UPDATE path. a suite
 *     that ran only the first captured the prior schema when a fixture's shape changed
 *     — a real flake, observed
 */
export const setLambdaLive = async (
  input: {
    lambda: DeclaredAwsLambda;
    /** the region the waiters poll; must match the region the lambda was declared into */
    region: string;
  },
  context: Parameters<typeof setLambda>[1],
): Promise<Awaited<ReturnType<typeof setLambda>>> => {
  // ⚠️ .why the WRAP = `withRetry` rethrows the aws sdk's error untouched once the attempts
  //         run out, and that message names the fault without naming the SUBJECT — which
  //         lambda, which role, which region. a maintainer who meets a red `deployed.*`
  //         suite then re-derives all three from the test. the wrap lands here rather than
  //         inside `withRetry` because this is the frame that HOLDS them
  //         (rule.require.failloud)
  // ⚠️ .why the ELAPSED line below = this is the term `LAMBDA_UPSERT_BUDGET_MS` budgets, and
  //         that budget rests on ONE truncated sample (F34). it is also the only phase here
  //         that carried no duration on the wire, so the term with the WEAKEST evidence was
  //         the term nobody could re-measure — the two preflight assets each already emit one
  //         (rule.require.measure-the-value-you-emit)
  const upsertStartedAt = Date.now();

  const lambdaDeployed = await MalfunctionError.wrap(
    () =>
      withRetry(() => setLambda({ upsert: input.lambda }, context), {
        maxAttempts: IAM_PROPAGATION_MAX_ATTEMPTS,
        backoffMs: IAM_PROPAGATION_BACKOFF_MS,
        shouldRetry: isIamPropagationRetryable,
        onRetry: ({ attempt, waitMs }) =>
          console.log(
            `⏳ ${input.lambda.name}: iam propagation, retry ${attempt}/${IAM_PROPAGATION_RETRY_COUNT} in ${waitMs / 1000}s...`,
          ),
      }),
    {
      message: 'setLambdaLive: the lambda upsert did not converge',
      metadata: {
        lambda: input.lambda.name,
        role: input.lambda.role,
        region: input.region,
        maxAttempts: IAM_PROPAGATION_MAX_ATTEMPTS,
      },
    },
  )();

  console.log(
    `⏱ ${input.lambda.name}: setLambda upsert took ${Date.now() - upsertStartedAt}ms`,
  );

  const sdkLambda = new LambdaClient({ region: input.region });

  // ⚠️ .why these log lines = each waiter blocks up to 60s, and the `deployed.codegen.refs`
  //         suite runs this per function — so a cold deploy can sit for minutes with no
  //         output, which reads as a HUNG suite rather than as latency. the line names WHICH
  //         phase is active, so a watcher can tell progress from a stall
  //         (rule.require.status-feedback)
  //
  // ⚠️ .the SWEEP, and why a prior round's was incomplete = the cause is "a phase of this
  //    function that blocks for tens of seconds emits no output". that sentence names no
  //    phase, so the family is EVERY phase here that blocks — three, not two:
  //      1. the iam-propagation retry   (up to 30s)  ⛔ was silent; announced via `onRetry`
  //      2. waitUntilFunctionActiveV2   (up to 60s)  ✅ announced below
  //      3. waitUntilFunctionUpdatedV2  (up to 60s)  ✅ announced below
  //    ⇒ the prior round covered the two phases that are WAITERS and read as complete, because
  //      the fix and its note both spoke of "waiters". a reviewer found the third. the retry is
  //      the FIRST phase to run and the one a cold deploy meets first, so it was the worst of
  //      the three to leave silent (rule.require.sweep-the-defect-class — sweep every axis the
  //      stated cause leaves unstated)
  console.log(`⏳ ${input.lambda.name}: await State=Active...`);
  await waitUntilFunctionActiveV2(
    { client: sdkLambda, maxWaitTime: WAITER_MAX_WAIT_SECONDS },
    { FunctionName: input.lambda.name },
  );
  console.log(`⏳ ${input.lambda.name}: await LastUpdateStatus=Successful...`);
  await waitUntilFunctionUpdatedV2(
    { client: sdkLambda, maxWaitTime: WAITER_MAX_WAIT_SECONDS },
    { FunctionName: input.lambda.name },
  );

  return lambdaDeployed;
};
