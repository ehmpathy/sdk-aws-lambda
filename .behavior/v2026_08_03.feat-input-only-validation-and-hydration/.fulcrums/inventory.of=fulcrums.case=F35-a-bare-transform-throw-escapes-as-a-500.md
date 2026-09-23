# F35 — a bare `.transform()` throw is reported as a **server fault**, at BOTH families

| field | value |
|---|---|
| **case** | F35 |
| **title** | the post-parse funnel belongs to `domain-objects`, so a bare `.transform()` throw is reported as a server fault |
| **rework** | ~~**dirty**~~ → **none.** no repair is owed at all — see the verdict |
| **status** | ⛔ **RULED 2026-09-21 — NO REPAIR OWED.** the behavior is correct, and the follow-on dream is REJECTED. not deferred, not open |
| **confidence** | **97%** that the measurement is right · ~~58%~~ **97%** that no repair is owed — the verdict and the measurement now rest on ONE fact |
| **where** | `src/domain.operations/genLambdaEndpoint/middleware/getValidatedInput.ts` · clamped at `getValidatedInput.test.ts` `[case4]`, `genLambdaEndpoint.forAskEndpoint.test.ts` `[case13]`, **and `genLambdaEndpoint.forApiGateway.test.ts` `[case20]`** |

> ⚠️ **AMENDED 2026-09-18 — the blast radius stated here was one family wide, and it is two.**
> the title read *"escapes as a **500**"*, and `.the consequence` named `forApiGateway` alone. that
> is **true of one family and false of the other**: `forAskEndpoint` hands the same middleware
> `asOutputAfter: false`, which RETHROWS — so the invocation FAILS rather than answers. caught by a
> peer at `enroll-impl-behavior-intent`, i011, and measured at the handler grain before this
> amendment was written. **the wisher's verdict is owed against the two-row table below, never
> against the single 500 the original text named.**

> 🔴 **AMENDED 2026-09-21 — the FRAMING was wrong, and the deferral was MORE right than it looked.**
> the title reads as sdk behavior that owes a repair. measured through a real wired handler, four
> candidates on one schema, each driven with the same bad value:
>
> | what the schema does | what the caller meets |
> |---|---|
> | `.transform()` + a bare `throw` | 🔴 REJECTED — a plain `Error`, reported as a server fault |
> | `.transform()` + a genuine null-deref | 🔴 REJECTED — a `TypeError`, reported as a server fault |
> | `.refine()` | ✅ `BadRequestError` |
> | `.transform()` + `ctx.addIssue()` + `return z.NEVER` | ✅ `BadRequestError` |
>
> **rows 1 and 2 are indistinguishable by construction.** a guard-throw and a broken-transform throw
> both reach `getValidatedInput` as a plain `Error` out of the same `inst._zod.parse` frame, and no
> property parts them. so the server fault is the only honest read of an ambiguous signal — **it is
> no mis-report**, and it is the safe direction to be wrong in.
>
> and row 4 is the find: **a consumer CAN signal a caller fault from inside a transform today**, by
> the same `ctx.addIssue` + `z.NEVER` mechanism `X.contract()` uses internally (`5.1` yield `:583`).
> the fork below says *"this repo declares no such vocabulary"* — **zod declares it, and it already
> reaches our chain end to end.**
>
> ⇒ **so the gap is DISCOVERABILITY, never behavior.** the wisher call narrows from *"does a guard
> class enter this sdk's vocabulary?"* to *"how does a consumer learn which of two forms to reach
> for?"* — a doc/hint question, whose rework is **clean**.

## .what was measured

`[case4]` was written to CONFIRM that a post-parse rejection funnels into a `ConstraintError`, on
the evidence of two family cases that each measure exactly that (`GuardedSpot`, twice). it
overturned the assumption instead:

```
expected ConstraintError · received Error
```

⇒ the two post-parse rejections are **not one behavior**:

| the rejection | the path | what a caller meets |
|---|---|---|
| a `domain-objects` constructor throw | caught by `.contract()`, reported as a zod issue → `!result.success` | `ConstraintError` → **400** |
| a bare `.transform()` throw | zod propagates it raw; the subject holds no branch for it | `Error` → **500** |

**the funnel belongs to `domain-objects`, never to zod and never to this subject.** that split was
undocumented, and a reader who met only the two family cases would infer the wrong rule — which is
precisely what the author of `[case4]` did.

## .the consequence, stated plainly — and it DIFFERS per family

a raw `Error` from the validation middleware reaches `genInternalServiceErrorMiddleware` at BOTH
families, because `getIsConstraintError` matches `ConstraintError` / `BadRequestError` by instance,
by name, and by prototype chain (`getIsConstraintError.ts:11-34`) — and a bare `Error` matches none
of the three. what happens NEXT is the family's own call, and the two calls differ:

| family | `asOutputAfter` | what a caller's bad value produces | measured |
|---|---|---|---|
| `forApiGateway` | a function | the invocation **SETTLES**: `statusCode: 500`, body `errorType: "InternalServiceError"` | `statusCode` 500, verbatim |
| `forAskEndpoint` | 🔴 **`false`** | the invocation **REJECTS** — a real lambda `FunctionError` | `Error: unknown surf spot`, `readAsCallerFault: false` |

⇒ **`false` means rethrow** (`genInternalServiceErrorMiddleware.ts:79`,
`genLambdaEndpoint.forAskEndpoint.ts:141`), and the family's own doc block says why: *"which lets
the invocation FAIL so cloudwatch records it and the caller may retry"*. that contract is right for
a SERVER fault and it is exactly wrong for this one, which is a **caller** fault misfiled as a
server fault.

🔴 **so the ask-endpoint arm is strictly worse, and it is the arm the original write-up omitted.**
`invariant.badrequesterror-not-lambda-error` names a triple cost — *"false-positive error metrics,
noisy alarms, unwanted retries (caller's bad request won't improve on retry)"*. a settled 500 trips
the first third of it; a **rejected invocation trips all three**, since aws itself records the
`FunctionError` and signals the retry.

### how this was measured, and by what

a throwaway probe built one handler per family on one schema —
`z.object({ spot: z.string().transform(raw => { if (raw !== 'pipeline') throw new Error(…) }) })` —
and invoked each with `spot: 'trestles'`. the api-gateway arm returned its 500 body; the ask arm
threw.

⚠️ **AMENDED 2026-09-19 — the probe was deleted, and for one round only ONE of its two results
had a persistent clamp.** the ask-family arm landed at `forAskEndpoint.test.ts` `[case13]`; the
api-gateway arm — **the arm this fulcrum's ORIGINAL text described** — survived only as the prose
above. a peer at `enroll-impl-behavior-intent` (i012) caught it, and it is now clamped at
`genLambdaEndpoint.forApiGateway.test.ts` `[case20]`.

⇒ **that is the third instance of one trap on this branch, and the sharpest: the REPAIR of a
one-axis sweep was itself bounded to one axis.** the stated cause names no family, so the widen
was owed to both — and the round that widened the *record* clamped only the family it had just
discovered.

both wired clamps now carry the same three-arm shape:

| arm | what it pins |
|---|---|
| `[t0]` | the defect — a caller fault reported as a server fault |
| `[t1]` | a **positive control** — the same family answers a **zod-class** rejection with a caller fault |
| `[t2]` | **one** escape hatch — `.refine()`, with the consumer's message intact |

⇒ `[t1]` is what makes either case mean what it claims: the misclassification is a property of the
ERROR CLASS, never of the family. without it a reader could conclude a family simply faults on every
bad input.

⚠️ **`[t2]` clamps the WEAKER of two hatches, and the stronger one is unclamped.** `.refine()`
cannot reshape, so it is no substitute for a consumer whose transform genuinely converts — the
headline usecase of this whole wish. `ctx.addIssue` + `z.NEVER` guards **and** reshapes in one pass,
and it lands the same `BadRequestError`. ⇒ **a `[t3]` arm is owed at both families**, and it is
cheap: the same shape as `[t2]`, one schema line different.

## .the fork, stated fairly

| option | the case for it | the case against |
|---|---|---|
| **record it, repair it not** (taken) | the repair is a behavior call outside this wish's bound | the defect is live, and a consumer can reach it today |
| catch every throw at `getValidatedInput` | closes the 500 for the caller-fault case | 🔴 it also swallows a genuine server fault — a null deref, an absent module, a broken dep — and reports each as a 400 (`rule.forbid.failhide`) |
| ~~catch only a declared guard class~~ | ~~precise, and it fails loud on all else~~ | ~~this repo declares no such vocabulary, and a new one is its own bound~~ |
| document it at the two families | cheap, and a reader stops to infer the wrong rule | prose is no clamp |

> 🔴 **row 3 is STRUCK — measured 2026-09-21, and the premise under it is false.** the vocabulary
> exists and is zod's own: `ctx.addIssue` + `return z.NEVER` inside the transform, which lands a
> `BadRequestError` through the extant chain with no edit to this subject. **there is no guard class
> to mint**, so the option that read *"correct but needs new vocabulary"* was never a fork at all.
>
> ⇒ the fork that remains is one row wide, and it was not on this table:
>
> | option | the case for it | the case against |
> |---|---|---|
> | **teach the two forms** — a hint at the error, a lint rule, or a doc line that names `ctx.addIssue` | the behavior is already correct; only the signal is absent. rework is **clean** | a hint needs frame attribution to fire only on transform throws (`.dream/v2026_09_20.fix.a-transform-guard-…`, rung 4) |

## .taken, and why at the time

**record it, repair it not — plus a clamp that states the split in the subject's own test.**

the second option is the one a reader reaches for first, and it is the one
`rule.forbid.failhide` refuses: a `catch` broad enough to hold a caller's guard is broad enough to
hold a null deref, and to report a server fault as a caller fault is worse than the defect it
repairs.

~~the third option is correct and needs a **declared guard class** this repo does not hold. to
introduce one is a design call the wisher owns, and it reaches every consumer of both families.~~

🔴 **STRUCK 2026-09-21 — the guard class is zod's `ctx.addIssue`, and it already works.** this
paragraph is the one that set the whole deferral's price, and its premise was never measured. ⇒ the
deferral was still the right call, for a **narrower and better** reason than the one written here:
the sdk's behavior is correct, so what was deferred is a doc/hint, never a repair.

⇒ so the honest move under a **verification** stone is to measure it, clamp the measurement, and
hand the behavior call up. the clamps are `[case4]` (the class, at the shared primitive) and
`[case13]` (the settle state, at the wired ask-endpoint handler), and each goes red the moment its
own half of the behavior moves.

## .why the confidence splits

- **97% on the measurement** — it was run at two grains: the shared primitive (`[case4]`, red with
  `expected ConstraintError · received Error`) and both wired families (the probe above, which
  produced a 500 body and a rejected invocation respectively). the residual is whether a
  `.transform()` inside a `z.object()` at greater depth behaves alike; every probe used depth 1
  - ⚠️ this read **91%** and named one family until 2026-09-18. the raise is not new confidence in
    the old claim — the old claim was incomplete, and the number now grades a wider, re-run one
- ~~**58% on the deferral**~~ → ~~88%~~ → 🔴 **97%, and it no longer grades a DEFERRAL.** it grades
  the verdict: **no repair is owed.** the old numbers priced how long a real repair should wait; the
  measurement showed there was never one to wait for
  - the raise is not fresh confidence in the old claim. the old claim was **the wrong question**
  - ⚠️ this number is now **the same 97%** as the row above it, and that is no coincidence: the
    verdict and the measurement rest on ONE fact — that a guard throw and a broken transform are
    indistinguishable. ⇒ the two cannot diverge, so they cannot carry two numbers

## ~~.what would settle it~~ — ⛔ SETTLED, and the answer is NO REPAIR

~~one wisher call on **whether a declared guard class enters this sdk's vocabulary**.~~ 🔴 **struck
2026-09-21 — that question is answered, and the answer was in zod all along.**

~~what remains is one call, and it is smaller: how does a consumer learn which form to reach for?~~
~~the rungs are the dream's, and rung 4 — a hint in the error that names `ctx.addIssue` — is the
recommendation.~~

🔴 **STRUCK the same day, by the wisher. there is no call left, and the follow-on dream is
REJECTED** — `.dream/v2026_09_20.fix.a-transform-guard-has-no-compile-or-lint-signal.md`.

⇒ **the hint cannot be built correctly, and the reason is the SAME fact that made the behavior
correct.** rung 4 would fire *"when the throw arrives from a transform frame"* — and a bare guard
throw and a genuine null-deref **both** arrive from one. so the hint would tell a consumer whose
transform holds a real defect to reach for `ctx.addIssue`, which would have them disguise a server
fault as a caller fault. ⇒ right half the time, and its wrong half steers into a
`rule.forbid.failhide`.

**so the indistinguishability closes this fulcrum in both directions at once**: it makes the
server-fault default the only honest read, and it makes every signal-rung unbuildable. that is why
this is settled rather than deferred.

⚠️ **and a readme line was never the closure either.** the trap is what a consumer reaches for when
they have not read the readme — that is what makes it a trap. a readme that documented it would read
as diligence and cancel a repair that, as it turns out, was never owed at all.

## .the verdict, once ruled

**⛔ NO REPAIR OWED — ruled 2026-09-21, by the wisher.**

the behavior is correct: an ambiguous throw is reported as a server fault, which is the safe read.
a consumer who wants a caller fault has two zod-native forms, both clamped here. **and no signal is
owed on top**, since a signal cannot part the two cases the sdk cannot part either.

⇒ **to re-open, one claim must fall**: that a bare `throw` and a broken transform produce no
distinguishable observable state. it is clamped at `[case13][t3]` and `[case20][t3]`, each proven by
revert. **an argument is not enough; bring a schema shape where the two differ.**

## .see also

- `src/domain.operations/genLambdaEndpoint/middleware/getValidatedInput.test.ts` — `[case4]`, and
  its `⚠️ .the consequence` block. it clamps the CLASS, at the shared primitive
- `src/domain.operations/.../genLambdaEndpoint.forAskEndpoint.test.ts` — `[case13]`. it clamps the
  SETTLE STATE at the **ask** family's wired handler — a REJECTED invocation
- `src/domain.operations/.../genLambdaEndpoint.forApiGateway.test.ts` — `[case20]`. it clamps the
  SETTLE STATE at the **api-gateway** family's wired handler — a SETTLED 500. ⇒ the two together
  are what make the two-row consequence table above a measurement rather than a claim
- `.agent/repo=.this/role=any/briefs/invariant.badrequesterror-not-lambda-error.md` — the invariant
  this breaks, and whose triple cost the ask-endpoint arm pays in full
- `rule.forbid.failhide` (ehmpathy/mechanic) — the reason the broad `catch` is refused
- `rule.require.sweep-the-defect-class` — the second trap, which is how the one-family scope got
  written down: the stated cause names no family, so a sweep bounded to one was bounded to an axis
  the cause never mentioned
