fixes #73

## ⚠️ .behavior change — read first

- **a caller fault on sqs is now deleted, never dead-lettered.** a message the schema refuses, or one a `perRecord` handler refuses with a `ConstraintError` / `BadRequestError`, is logged and acknowledged: sqs deletes it once the invoke succeeds, with no dead-letter entry. before, it redrove until it dead-lettered. one exception: in `perBatch`, a handler throw fails the invoke, so a refused record redrives with its batch and is refused again on the next receive
- **the log name changed for the common case.** on main, `perBatch` logged every schema refusal as `sqs.record.invalid`. a caller fault now logs `sqs.record.refused` (warn). `sqs.record.invalid` (error) now marks only a schema callback that threw a fault of ours. **an alarm keyed on `sqs.record.invalid` goes quiet for a producer outage — move it to `sqs.record.refused`**
- **the class is the verdict.** a downstream `ConstraintError` a `perRecord` handler lets escape (a 429, say) deletes the message too. to retry a transient fault, throw a `MalfunctionError`
- **a local test of a raw handler may go red on upgrade.** the local locus now labels an escaped throw by `.name`, as the cloud does. on helpful-errors 1.7.3 a `ConstraintError` reads `.name === 'Error'`, so a raw handler (one no `genLambdaEndpoint` family wraps) that throws one hydrates locally as a server fault — as it already did on the cloud. a test that asserted a caller fault there was green over a red prod. the cure is helpful-errors#47. a `forAsk` or `forApiGateway` endpoint is unchanged: it answers a `ConstraintError` by class, as a response body, so its caller still reads a caller fault on both loci. the label itself moves for every family: a server fault's `error.metadata.errorType` now reads `.name`, so every helpful-errors 1.7.3 class (a `MalfunctionError` included) reads `'Error'` there locally, as on the cloud
- **a test of an sqs refusal asserts the trace, not a throw.** the invoke succeeds with no answer, so assert the handler did not run and spy `console.warn` for `sqs.record.refused`
- **the dead-letter queue no longer catches a schema bug of ours.** a tightened schema deletes the in-flight messages it refuses. alarm on the volume of `sqs.record.refused`

ships as a patch, per the human ("its gonna be a patch still").

## ❓ .questions for the commander

### 1. is a schema refusal on sqs acknowledged too (F7)?

the human ruled: "a ConstraintError on sqs is logged and acknowledged". a message the schema refuses also raises a `ConstraintError` (`getValidatedInput`), so this pr acknowledges it too. F7 was ratified by the director, not by the human, and it reverses main's design note that a swallowed validation failure is a failhide.

- **a. acknowledge it (the lean, as built).** one rule by class: a caller fault never redrives, whatever raised it. the `sqs.record.refused` line is its trace; the dlq no longer holds poison pills
- **b. redrive a schema refusal, acknowledge only a handler's `ConstraintError`.** the dlq keeps poison pills for inspection; nine flipped tests flip back, and the rule splits by source rather than class

lean: **a** — the human's words name the class, and the class is what the schema raises.

### 2. does wish done #3 ask for a helpful-errors pin in this pr?** the wish: "if the clamps need the new helpful-errors before it releases, pin it via a pnpm link or `pnpm patch`".

- **a. no pin (the lean, as built).** no clamp of the label mirror needs the new helpful-errors; each sets `.name` by hand. four tests assert what prod reads on 1.7.3 (a raw `ConstraintError` labelled `'Error'`), and `[case22][t5]` proves the caller fault once `.name` is set. the helpful-errors bump flips the four in its own pr
- **b. `pnpm patch` helpful-errors now.** serde `[case1][t0]` keeps its old `'ConstraintError'`, and wish outcome 2 holds in this tree. but ci then reads a helpful-errors no consumer installs, and the patch must come out on release
- **c. hold this pr for the helpful-errors release.** no patch, no flip later; the p0 waits on helpful-errors#47

lean: **a** — the wish's own condition does not hold, and the clamps then describe the prod a caller meets today (F24).

## .what

- **the local locus labels a throw as the aws node runtime does** (`toRapidResponse`, `aws-lambda-nodejs-runtime-interface-client` `src/Errors.js`): `.name` for a native error or a value its `_isError` accepts (a truthy string `name`, `message`, `stack`), `typeof error` otherwise, and `'handled'` — with the runtime's own fixed message and no trace — wherever the runtime's reads throw (a stackless native error). a thrown `null` or `undefined` reads `errorType: 'string'`, `errorMessage: 'handled'`, since the runtime swaps it for that string first (measured on the deployed runtime). it read `constructor.name`, so a local run named a `ConstraintError` a caller fault while the cloud named it `Error` — a green pr gate over a red prep (svc-quotes run 38852404042)
- **`forSqs.perRecord`** acknowledges a caller fault: logged as `sqs.record.refused`, then the invoke returns. every other fault rethrows and redrives
- **`forSqs.perBatch`**:
  - a schema refusal is logged and its id left out of `batchItemFailures`, so sqs deletes it
  - a schema callback that throws a server fault is logged `sqs.record.invalid` and that record alone is retried
  - a handler throw is forwarded whatever its class, so the whole batch redrives — a throw names no record, so to acknowledge the batch would delete records of unknown outcome
- detection is in-process, via `getIsConstraintError` (`instanceof`, the error's own `.name`, then the prototype chain), never the wire label. the invoke freeze's own `ConstraintError` is a handler defect and redrives
- new brief: `invariant.constraint-errors-never-redrive-sqs`

## .caveats

- **no helpful-errors pin; the clamps pin the shipped 1.7.3.** the label mirror's own clamps read a hand-set `.name`, so they hold for any helpful-errors. four tests hydrate a real 1.7.3 `ConstraintError` and assert its inherited `'Error'`: serde `[case1][t0]`, integration `[case22][t1]`–`[t3]`, and the deployed label suite's `constraint` row. they describe what prod reads today, and a bump to a helpful-errors with #47 turns them red on purpose, to be flipped to the caller fault in that bump. integration `[case22][t5]` is that future state now: a raw `ConstraintError` with `.name` set reaches the caller as a caller fault (F24)
- **local-to-cloud label parity is measured on the real runtime.** `blackbox/deployed.faultLabel.acceptance.test.ts` deploys one raw handler, throws seven values (one per `toRapidResponse` branch), and asserts the cloud label and the local label of the same bundle agree
- **the sqs disposition is pinned in-process, not yet on a real queue.** the clamps assert what this sdk returns to sqs: perRecord's invoke success, perBatch's `batchItemFailures`. that is all sqs reads. the redrive itself is aws's. a deployed suite that watches a real queue is built and parked in `.dream/2026_10_22.demo-infra-sqs-endpoint-for-cloud-disposition.dream.md`, until the demo roles gain sqs rights (the demo sso role answers `sqs:createqueue` AccessDenied)
- **a `ConstraintError` a `perBatch` handler throws redrives with no sdk `handler.error` line** — the error middleware passes a caller fault by, which is right where a family answers it, and true on main too (F19)
- **the refusal line carries the full message as delivered** — `message` is the untouched `SQSRecord` (body, typed `messageAttributes`, fifo ids, `eventSourceARN`), read from `record._.raw` since validation writes parsed values back into the decoded record. so an operator can requeue a deleted message from its log line (clamps: `logSqsRecordRefused.test.ts` round-trips the line through json; perRecord `[case10][t1]` proves the logged message equals the wire record after validation ran)
- **one field still differs by locus**: the runtime emits the stack as `trace`, the local locus as `stackTrace`. it shapes diagnosis, never classification — caught as `.dream/2026_10_22.fix-local-locus-stack-field-trace-vs-stacktrace.dream.md`
- **beside the fix, in scope by order:**
  - rhachet pinned at `1.50.1` exact (ktlo: "build against rhachet 1.50.1")
  - `modulePathIgnorePatterns: ['<rootDir>/.agent/', '<rootDir>/.log/']` in all three jest configs. jest's obsolete-snapshot check walks the haste map, which `testMatch` does not limit, so a `.snap` file in the in-repo trash failed the run
  - two readme words: "client" → "caller" / "sdk" (`rule.forbid.term-client`)
  - the test harness's failed-sso-export error names the paved fix, `rhx keyrack unlock --owner <owner> --env <env>`, with `aws sso login` kept as a last-resort hint (`src/__test_assets__/useKeyrack.ts`; clamp `useKeyrack.test.ts`, red with the old message, green with the new). the raw cli in the headline read as a human-only login and halted a driver that needed none

## .fulcrums

| case | call | rework | status |
|---|---|---|---|
| F7 | a schema refusal on sqs is a caller fault, so it is acknowledged too | clean | ruled — ktlo |
| F8 | a `perBatch` handler throw is forwarded, whatever its class | clean | ruled — the human |
| F9 | a refusal leaves a warn log as its only trace; no explicit dead-letter send | clean | ruled — ktlo |
| F10 | ships as a `fix`, not a `break` | clean | ruled — the human |
| F11 | the shared refusal log is named `logSqsRecordRefused` | clean | best-guessed, 85% |
| F12 | the cloud half of the sqs disposition is deferred | clean | ruled — the director: ships without an iam grant it does not need; the suite is parked with its dream |
| F13 | a perBatch schema server fault retries that record alone, logged loud — not rethrown | clean | best-guessed, 88% |
| F14 | the refusal log calls the typed logger unguarded | clean | best-guessed, 90% |
| F15 | a record's retry is the default, never a list the validator returns | clean | best-guessed, 88% |
| F16 | the caller-fault gate keeps `instanceof Error` | clean | best-guessed, 93% |
| F17 | the refusal line is pinned by an exact `toEqual`, never a snapshot | clean | best-guessed, 90% |
| F18 | a refusal `origin` field (schema vs handler) is deferred to a dream | dirty | best-guessed, 85% |
| F19 | a `perBatch` handler's forwarded `ConstraintError` log, and two name-polish asks, are deferred | clean | best-guessed, 85% |
| F20 | five review polish asks held to the wish's scope | clean | best-guessed, 85% |
| F21 | the case-list unit tests keep the `TEST_CASES.map(test)` shape | clean | best-guessed, 88% |
| F22 | the bundle's `ConstraintError2` suffix is masked in the deployed snapshot; the helpful-errors dedupe is dreamed | clean | best-guessed, 85% |
| F23 | a contract snapshot is kept beside an exact `toEqual` of the same value | clean | best-guessed, 85% |
| F24 | no helpful-errors pin; the clamps read the shipped 1.7.3 | clean | asked above, 80% |
| F25 | snapshots keep a hydrated error's undefined keys; the unchanged redrive log gets no new snapshot | clean | best-guessed, 85% |

F1–F6 are retired: they ruled the `.name` guard middleware, which the human dropped.

## .tests whose expectation flipped — each by a recorded verdict

| test | on main | now | the verdict |
|---|---|---|---|
| perRecord `[case4]` `[case9]` `[case15]`, the strict-headers and mismatch cases | a schema refusal fails the invoke | the invoke succeeds; the refusal is logged | the human: "a ConstraintError on sqs is logged and acknowledged"; F7 (ktlo) — a schema refusal is a caller fault |
| perBatch `[case2]` `[case3]` `[case5]` `[case13]`; acceptance `[case3]` | a refused id is in `batchItemFailures` | a refused id is left out, so sqs deletes it | F7 |
| `asWireFunctionErrorPayload` `[case1][t0]`, `[case2]`, `[case3][t0]` | the label reads `constructor.name`; a bare throw reads `'Error'` | the label reads `.name`, then `typeof`, then `'handled'` | the wish: the local locus reads `error.name`, as the runtime does |
| `genLambdaEndpoint.forAsk` snapshot | `errorName: MalfunctionError` | the `.name` guard and its snapshot are gone | the human dropped the guard |

## .tests

types · lint · format · unit · integration · acceptance (local and deployed) green. each pure leaf has its own case-list test. the delete arms and the redrive arms are both pinned through the public export (`blackbox/local.sqsQueue.acceptance.test.ts` `[case3]` `[case6]` `[case7]`). bite: with perRecord's catch forced to rethrow and perBatch's refusal branch disabled, 15 of 144 go red; the serde fix reverted turns 3 of 12 red.
