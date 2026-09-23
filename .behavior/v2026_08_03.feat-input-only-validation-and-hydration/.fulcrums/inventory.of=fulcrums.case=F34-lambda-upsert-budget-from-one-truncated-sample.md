# F34 — `LAMBDA_UPSERT_BUDGET_MS` is set from ONE truncated sample

| field | value |
|---|---|
| **case** | F34 |
| **title** | the `setLambda` upsert budget is a best-guess, not a measurement |
| **rework** | 🔴 **dirty** — was `clean`. the cold measurement rules the one-constant repair out; see below |
| **status** | 🔴 **MEASURED INSUFFICIENT, NOT FIXED** — the cold run this entry asked for breached it |
| **confidence** | **28%** that `180_000` is right — was 62%, before it was measured |
| **where** | `blackbox/__test_assets__/setLambdaLive.ts` — `LAMBDA_UPSERT_BUDGET_MS = 180_000` |

🟡 **read `.the cold run` below before the fork** — the fork was stated against an estimate, and
the estimate has since been replaced by an observation that eliminates the option taken.

## .the fork, stated fairly

a deployed suite's `useBeforeAll` was granted 160s and a cold run spent ~157s inside
`setLambda` alone, before either waiter. the term needs a budget. the fork is **what number**:

| option | the case for it | the case against |
|---|---|---|
| **180s** (taken) | ~15% above the observed floor | the floor is TRUNCATED — the true cost is unknown, so 15% may be under it |
| 240s+ | real headroom over an unknown worst case | pushes `deployed.codegen.refs`' upper bound past 20 minutes |
| leave 160s, add preflight only | smallest diff | **ruled out by arithmetic** — 190s < 157s upsert + 120s waiters |
| serialize the deployed suites | removes the parallel confound entirely | a jest-config change well outside this bound |

## .taken, and why at the time

**180s.** it clears the one observation with margin, and it holds the four-lambda suite's
upper bound at `30 + (30 + 180 + 120) × 4` = **22.5 min** rather than past 30.

the third row is what forced a change to `LAMBDA_DEPLOY_BUDGET_MS` rather than a pure
composition fix — the composition alone would still have failed the case that motivated it.

## .why the confidence is 62%

the number rests on **one sample**, and that sample is degraded three ways:

1. **truncated** — the 160s jest timeout cut `setLambda` off. 157s is a floor, and the
   distance to the true worst case is unmeasured
2. **a parallel confound** — jest runs the four deployed suites concurrently, so four zip
   uploads competed for the same network. a serial cold run would be faster, by an unknown factor
3. **a create, not an update** — `svc-seaturtle-prod-goSurf` did not yet exist. an update path
   is cheaper, and the budget must cover the create

⇒ the direction is certain (the old ~10s allowance was wrong by more than an order of
magnitude). the **magnitude** is a judgment.

### what the warm measurement adds, and what it cannot

the instrument now reports `setLambda` on every run. warm, across six functions:
**4384 · 4445 · 4511 · 4624 · 4677 · 4846 · 4893 ms** — so ~4.9s.

⇒ a **~32x cold/warm spread**, which confirms the budget is set almost wholly by the CREATE
path. it does **not** narrow the estimate: the warm number says where the floor is, and the
open question is the cold ceiling, which only a cold run reaches.

## 🔴 .the cold run — it happened, and the budget lost

run `2026-09-18T23-59-39Z`, `rhx git.repo.test --what acceptance --against local --env test`, a
tree whose `svc-seaturtle-prep-checkContract` code hash had moved:

```
deployed.introspection.acceptance.test.ts   7 failed
  thrown: "Exceeded timeout of 360000 ms for a hook."   ← LAMBDA_DEPLOY_HOOK_BUDGET_MS
```

**the phase that consumed it is named by what the log does NOT hold**, which is the same method
the file's own `.which term ACTUALLY squeezed` block used one level up:

| the line | present for `checkContract`? | what its absence rules out |
|---|---|---|
| `⏱ … bundle + zip took 332ms` | ✅ | — |
| `⏱ … iam role upsert took 1879ms` | ✅ | — |
| `⏱ … setLambda upsert took Nms` | 🔴 **absent** | the upsert **never returned** |
| `⏳ … iam propagation, retry` | absent | `withRetry` saw no retryable error — one attempt, not five |
| `⏳ … await State=Active...` | absent | neither waiter ran |

⇒ preflight was **2.2s**, so **≥357s** went into ONE `setLambda` attempt against a **180s**
budget — a breach by more than **2x**, and still a floor, since jest cut it off again.

🟡 **and the six peers in that same run were warm** — `4425 · 5043 · 5104 · 4608 · 4975 · 4598 ms`.
so one run holds both arms of the ~70x spread, and the warm arm is what every green run reports.

### the two controls that prove it is the budget, not the product

| control | result |
|---|---|
| the same suite alone, warm | **7 passed, 0 failed, 25s** |
| the same full suite re-run, warm | **274 passed, 0 failed, 117s** |

⇒ no assertion ever failed. the suite is correct and the budget is not.

### 🔴 why the naive raise is ruled OUT — by this entry's own arithmetic

to cover 357s puts `LAMBDA_DEPLOY_BUDGET_MS` at `30 + 357 + 120` ≈ **507s**, and
`deployed.codegen.refs`' four-lambda upper bound at `30 + 507 × 4` ≈ **34 min**.

that is past the 30-min bound this entry cited when it rejected the `240s+` row. **so the
measurement eliminated the option taken AND the option next in line**, which is why the rework
grade moved `clean` → `dirty`: what is left is the third and fourth rows, and each is a change
this bound did not open — a jest-config serialization, or a per-suite budget that admits the
four-lambda suite needs a different arithmetic from the one-lambda suites.

## .what would settle it

one **serial, cold** deploy with the `⏱` lines now in place — the instrument added by this
same change is exactly what makes the re-measurement cheap:

```sh
rhx git.repo.test --what acceptance --against cloud --env prep --mode apply --log always \
  --scope 'path://deployed.awsLambda'
rhx grepsafe --pattern 'took [0-9]+ms' --path '.log/.../<stamp>.stdout.log'
```

✅ **the instrument is complete as of this change.** a first draft of this entry noted that
`setLambdaZip` and `setLambdaRole` emitted `⏱` lines while `setLambda` did not — so the term
with the WEAKEST evidence was the one term nobody could re-measure. that line was added rather
than dreamed, since it was safe and rode the same diff
(`rule.always.fix-forward-under-scouts-honor`). all three phases now report.

⇒ so this fulcrum is settleable by **one cold run and one grep**, by whoever meets it next.

### 🔴 that run HAPPENED, and it did not settle it — it re-opened it

the instrument worked exactly as designed: the absent `⏱` line is what located the phase. but
the number it produced (**≥357s**, still a floor) falsifies the taken option rather than
confirms it, and the arithmetic above then falsifies the fallback. ⇒ **what is settleable by one
grep is no longer the open question.**

what is open now is a **design** call, and it is the wisher's:

> does a four-lambda deployed suite get a budget that admits a 34-minute worst case, or does
> the cold path get removed from the critical path instead — by a serialization, a warm-up, or
> a split of the deployed suites out of the default acceptance gate?

⚠️ **and the green runs will not raise it.** warm is ~5s, so every re-run passes and the breach
reads as a one-off. it took a full cold suite to see it once, and the tree is warm again now.

## .the verdict, once ruled

_unruled._

## .see also

- `blackbox/__test_assets__/setLambdaLive.ts` — the arithmetic and its `.measured` blocks
- `.dream/v2026_09_18.fix.the-deploy-hook-budget-loses-on-a-cold-run.md` — the work, the three
  options the measurement leaves, and why each is outside this bound
- `.behavior/…/5.3.verification.yield.md` — the acceptance row this correction rewrote; the
  suite is green **warm** and was red **cold**, and a row that said only the first would be the
  technically-true frame `rule.forbid.obfuscation` names
