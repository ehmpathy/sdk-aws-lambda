# `F37` — the `env.access` tier check is recorded, never restored

> raised 2026-09-20, at stone `5.3.verification`, from review `i010` lane `r011`
> (`enroll-verif-test-intent`, 1 blocker).

| field | value |
|---|---|
| **rework** | dirty |
| **status** | open |
| **confidence** | 74% |
| **where** | `src/domain.operations/asLambdaEndpoint/asLambdaEndpoint.ts` · `askLambdaEndpoint.ts:68` · `getOneLambdaContract.ts:59` · `getAllLambdaContracts.ts:99` |
| **the work** | `.dream/v2026_09_20.fix.env-access-reaches-a-lambda-slug-with-no-tier-check.md` |

---

## .the fork, stated fairly

a reviewer found that `env.access` reaches a lambda slug with **no runtime tier check**, so an
absent value builds `svc-invoice-undefined-getInvoice` and surfaces as an opaque AWS
`ResourceNotFoundException` rather than a loud, actionable throw. this repo's own
`rule.require.env-access-in-context` grades that a **blocker**.

the reviewer's find is **correct about the code**. its stated premise — that *this branch* deleted
the guard — is **false**, and measured so. so the fork is not *"is it real?"* but *"is it MINE?"*

| option | what it costs |
|---|---|
| **A — restore the guard now**, at the common ancestor, with tests | opens a subsystem with 34 call sites across 9 files, **zero of them in this branch's diff**; one member is credential-gated and cannot be proven |
| **B — record it, fulcrum it, hand it up** | the defect stays live one more merge; a reviewer may re-raise it; the next traveler inherits a measured find rather than a fixed one |
| **C — restore it at ONE site** (`askLambdaEndpoint` only) | cheapest, and **forbidden**: `rule.require.sweep-the-defect-class` grades a fix that repairs the instance and leaves the class a blocker |

## .taken, and why at the time

**B.** two measurements decided it, and neither is a scope argument —
`rule.always.fix-forward-under-scouts-honor` is explicit that *"scope is not one of the two
questions"*, so the grade rests on the fix itself:

**1. the count.** `asLambdaEndpoint(` has **34 call sites across 9 files**, and:

```sh
git diff --stat origin/main -- src/domain.operations/askLambdaEndpoint/ \
                               src/domain.operations/asLambdaEndpoint/ \
                               src/domain.objects/LambdaEndpoint.ts
#   (empty)
```

⇒ the repair lands entirely **outside the diff this branch already has**, which is the literal text
of the CLEAN question: *"does it ripple into files, contracts, and callers this change never
intended to open?"*

**2. one member cannot be proven.** `getAllLambdaContracts.ts:99` takes `access` from a **parsed
real AWS function name** — observed data, not handed config. a live account that still carries a
legacy segment (`svc-x-demo-y`) would throw under a naive guard and break **enumeration of the
whole account**, a wider outage than the defect. that path runs only under credentials I do not
hold, so the fix's riskiest half would ship unmeasured.

⇒ `safe ✅ / clean 🔴` → **defer, and raise a fulcrum.** this is that fulcrum.

## .rework, and why

**dirty.** the guard is not a rename or a swapped default. it forces a real design call:

> **do form 1 and form 2 take the same strictness?**

form 1 receives **handed config** (`context.env.access`) — a bad value there is a caller defect and
should fail loud. form 2 receives **observed data** (a slug AWS returned) — a bad value there may
be a legacy deployment, and to throw is to refuse the whole account.

`rule.forbid.parallel-codepaths` draws exactly that line — *"fork on data you observe ✅ legitimate ·
fork on config you were handed ⛔ collapse"* — and it argues that the two forms **should** differ.
but the two live in one function today, so a split is a contract change, and
`LambdaEndpoint.access: string` would want to narrow to `EnvironmentAccessTier` on the form-1 side
alone.

⇒ that is a boundary later work builds on, not a rework a reviewer waves through.

## .confidence, and why it is not higher — 74%

**what holds at high confidence** is every measurement: the deletion commit (`71136ae`, `#8`), the
empty diff, the 34 sites, the three family members, the incidental catch at
`getOneLambdaContract.ts:68`. each was run, and the commands are in the dream.

**what sits at 74% is the CALL** — that a record beats a repair here. the honest counter, stated
plainly:

- ⚠️ **this stone's buttonup mandate reads *"if you detect it, you fix it. no exceptions."*** a
  mandate with the words *no exceptions* in it does not obviously yield to a CLEAN grade, and a
  reader who weights that phrase over the scouts-honor table would rule **A**
- a narrower repair than I modelled may exist — a guard on form 1 only, with form 2 left explicitly
  and documentedly loose, might be clean enough to ride along. I graded the **class** fix, and
  `rule.require.sweep-the-defect-class` is what forbids the one-site version — but the line between
  *"one site"* and *"form 1, both its callers, with form 2 named as out of family"* is a judgment I
  made alone
- the defect is **live in a published SDK** right now, and each round it stays on record is a round
  a consumer can meet it

⇒ so this is the row to overrule if any row here is overruled. **the work is fully shaped in the
dream** — a wisher who says *"fix it"* gets a repair that needs no re-derivation, only the
form-2 decision above.

## .the verdict, once ruled

_(unrecorded — awaits the fulcrum council)_
