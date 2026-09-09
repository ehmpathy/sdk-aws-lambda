# seed: the four `deployed.*` acceptance suites flake on a fixed 90s hook budget

## .what

`jest.acceptance.env.ts` sets one repo-wide `jest.setTimeout(90000)`. the four `deployed.*`
acceptance suites do their whole real-aws scene setup inside a `useBeforeAll` hook governed by that
budget. the slowest of them, `deployed.codegen.refs`, needs **~55s** on a good day — so it carries
about **35s of headroom**, and a slow aws day consumes it.

**observed: 2 failures in 11 consecutive runs**, at the `v2026_08_03.feat-apigateway-wire-response`
verification gate. the second recurrence is the stronger evidence, because it arrived with a clean
isolation control — see `.the second occurrence` below.

## .why it matters

when the hook times out, **one** root failure is reported as **nine** — one per test that depended on
the scene. so the signal a reader meets is *"9 tests failed"*, which reads as a real regression and
costs a full diagnosis pass to dismiss. it also has the wrong shape for triage: not one assertion
disagreed with the code.

on CI this is worse than locally, because CI has no isolated re-run to hand and the natural response
to a red build is a retry — which is exactly what `cicd.deflake` forbids.

## .the measurement

| what | command | result |
|---|---|---|
| the failure | `rhx git.repo.test --what acceptance --against local --env test --mode apply` | ⛔ **241 passed, 9 failed**, 151s |
| the root | (from the log) | `thrown: "Exceeded timeout of 90000 ms for a hook."` at `deployed.codegen.refs.acceptance.test.ts:116` — `const scene = useBeforeAll(…)` |
| in isolation | `... --scope 'path://deployed.codegen.refs'` | ✅ **9 passed, 0 failed, 55s** |
| the budget | `grepsafe 'Timeout' --path jest.acceptance.env.ts` | `jest.setTimeout(90000); // tests call downstream apis` |
| the branch's involvement | `git diff --numstat origin/main -- <the file>` | **empty** — the suite is untouched |

the full-run wall time on the failure was **151s** against **109–121s** on six other runs — a ~30%
slowdown that maps cleanly onto external aws latency.

## .the second occurrence — measured back-to-back, which pins the cause

it recurred after the l3 ladder closed, and this time the isolated re-run happened **minutes** after
the failure, on the same machine, against the same aws account — so the two numbers differ in one
variable only: whether 11 other suites ran beside it.

| # | command | suite wall time | result |
|---|---|---|---|
| 1 | `--what acceptance … --mode apply` (12 suites, parallel) | **94.9s** | ⛔ 242 passed, **9 failed** — every one `Exceeded timeout of 90000 ms for a hook` |
| 2 | `… --scope 'path://deployed.codegen.refs'` (1 suite, alone) | **53s** | ✅ **9 passed**, 0 failed |
| 3 | `--what acceptance … --mode apply` (12 suites, parallel) | 109s total | ✅ **251 passed**, 0 failed |

**the same 9 tests**, the same code, ~3 minutes apart. 53s alone against a 90s budget is 37s of
headroom; 94.9s under load is 4.9s past it. so the budget is crossed by **contention**, and by no
assertion.

⚠️ **the edits in flight when it failed were two doc-comments and a markdown section** — zero code
paths, which rules the branch out as a cause a second time.

**note the count moved: 241 → 242 passed.** the failed-suite total tracks how many of its own tests
had already settled before the hook budget expired, so it varies run to run. a reader who diffs the
two failures should not read that delta as a change in coverage.

## .the family — all four, not just the one that failed

the cause is *"a real-aws scene in a `useBeforeAll` hook, under a fixed 90s repo-wide budget"*. that
is true of every `deployed.*` suite:

- `blackbox/deployed.awsLambda.acceptance.test.ts`
- `blackbox/deployed.introspection.acceptance.test.ts`
- `blackbox/deployed.codegen.acceptance.test.ts`
- `blackbox/deployed.codegen.refs.acceptance.test.ts` ← the slowest, so the first to cross

`.refs` is where it surfaced; a fix that touches only `.refs` leaves the class open.

## .candidate fixes — for whoever takes this

1. **a per-suite timeout on the deployed suites** — `jest.setTimeout(…)` inside each `deployed.*`
   file, or a `testTimeout` on a dedicated jest project. keeps the 90s default honest for the 8
   suites that do not touch the network.
2. **move the scene behind the suite's own retry loop.** `deployed.codegen.refs.acceptance.test.ts:58`
   already has a backoff helper; the scene setup does not use it.
3. **raise the repo-wide budget** — the cheapest, and the worst: it slows every real failure's
   feedback and masks genuine slowness in the 8 other suites.

⚠️ **prefer 1 or 2.** a repo-wide raise trades one flake for a slower signal everywhere.

## .why it was not fixed in the wire-response wish

`jest.acceptance.env.ts` is shared, repo-wide, and declapract-template-owned. the flake is in a suite
the wish does not touch, under a budget the wish does not set, for a defect the wish did not
introduce. to fix it there would widen that wish's bound and raise the timeout for 11 unrelated
suites.

so it was measured, diagnosed, swept to its family, and recorded — the same treatment F32's
header-order defect received on the same branch.

## .sources

- `.behavior/v2026_08_03.feat-apigateway-wire-response/review/self/for.5.3.verification._.r3.has-all-tests-passed.md`
  — the full 7-run tally and the diagnosis, as recorded at the time
- `.log/role=mechanic/skill=git.repo.test/what=acceptance/2026-08-13T18-48-07Z.stderr.log` — the raw
  failure output
