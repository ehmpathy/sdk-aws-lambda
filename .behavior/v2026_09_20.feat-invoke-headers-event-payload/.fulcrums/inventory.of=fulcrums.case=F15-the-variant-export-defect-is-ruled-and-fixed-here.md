# F15 — the variant-export defect is RULED, and fixed in this release

⛔ ~~*the variant-export defect is DEFERRED, not fixed in this release*~~ — the title this entry
carried until 2026-09-23, struck and kept, because the reversal is the point. **each section below
is the PRE-RULING record**; the verdict is at the foot.

- **rework**: dirty
- **status**: ✅ 🔴 **RULED by the wisher, 2026-09-23 — option C, which neither fork arm held.**
  landed, verified, enruled, enbriefed. see `.the verdict`
- **confidence**: ⛔ ~~79%~~ → ⛔ ~~the fork is no longer balanced; option B's rationale measured
  FALSE~~ → 🔴 **both fork arms were wrong, and so was my recommendation**
- **where**: `src/index.ts:56,95`; found in self-review 4/8 (`has-consistent-conventions`),
  re-raised by peer lane `r1 repo-rules` at 5.3.verification (blocker.1) — **five raises** in all

## .the fork, stated fairly

`src/index.ts` breaks `rule.forbid.unqualified-variant-exports`, and the brief names **this exact
file** as its worked example:

| line | export | defect |
|---|---|---|
| `:56` | `forApiGateway` | a bare, preposition-led export; `for` is not a verb |
| `:95` | `genLambdaEndpoint`, from `genLambdaEndpoint.forAskEndpoint.ts` | a VARIANT under the FAMILY's name — the cause of `:56` |

the fork:

| | |
|---|---|
| **A — fix it now** | this release is already a hard cutover (F07). a consumer who must migrate anyway pays nearly zero for a second, mechanical rename. and `forApiGateway`'s 78 call sites are already edited in this release, so a later fix edits them **twice** |
| **B — defer it** | the fix renames the TWIN's export, and the twin's consumer (`ahbode/svc-home-services`) was measured by the vision as **outside this break's surface** |

## .taken: B — defer. and why, at the time

🔴 **the vision's scope claim carries weight, and A would falsify it.**

the vision measured two consumer repos and recorded:

> | `ahbode/svc-home-services` | `genLambdaEndpoint` ×4, `askLambdaEndpoint` ×1 | ⛔ **no** — outside the surface entirely |

and called it *"the first cross-repo positive control for the wish's central claim: the break
reaches the envelope readers and no further, measured against a real external consumer the break
must not disturb, and does not."*

⇒ option A pulls that repo into the break. the claim then reads *"2 repos, 2 affected"*, the
positive control is spent, and the wish's bounded-scope argument loses the one measurement behind it.

⚠️ **I am not confident this is the right call**, hence 79% — see below.

## .why the rework is DIRTY

`rule.always.fix-forward-under-scouts-honor` grades the FIX, not the ask:

| | |
|---|---|
| **SAFE?** | ✅ mechanical, compiler-guided, break already priced by F07 |
| **CLEAN?** | 🔴 **no** — it ripples into a second repo, and into a vision claim |

dirt here is not *"it touches many files"* — 78 files is fine, the route already does that. it is
that the fix **changes what the vision measured**, so the artifact and the code would disagree.

## 🔴 .why the confidence is only 79%

three reasons the deferral could be wrong, each stated rather than hidden:

1. **the cost inverts with time.** `forApiGateway`'s 78 sites migrate in this release regardless. a
   later fix migrates them a *second* time — so B is the option that costs more in total, and the
   whole of A's case is that this is the cheap moment.
2. **the protected claim is about the WISH, not about a consumer's safety.** no consumer is harmed
   by A; what is harmed is the tidiness of a measurement in a yield. that is a weak claim to protect
   a real defect behind.
3. **it is the wisher's call, and I did not ask.** F07 shows the wisher rules cutover scope
   deliberately (*"yeah we want a hard cutover … that's on purpose"*), against a known 78-file base.
   a wisher who ruled that may well rule this the same way.

⇒ **so this fulcrum's real content is a question for the council**, never a settled position:

> **is the vision's "2 repos, 1 affected" measurement worth more than a defect the rule set names
> this file as the example of?**

if not — fold it in now, while the 78 sites are open.

## .the record

- the work: `.dream/v2026_09_22.fix.index-exports-a-variant-under-the-family-name.md` (symlinked at
  `dreams/`), with the fix shape and the per-consumer migration
- the find: self-review 4/8, find 9
- ⚠️ the brief's own line citations (45, 56) are **stale**; the live lines are **56 and 95**

🔴 **and this entry's own citation went stale too** — it read `:70` for the `genLambdaEndpoint`
export until self-review 7/8 re-measured it. ⇒ the warn one line up was written **by the same hand
that then broke it**, which is why a `file:line` is verified against the tree rather than against a
prior draft (`rule.require.trust-but-verify`). the repair:

```
$ rhx grepsafe --pattern "^export \{ (forApiGateway|genLambdaEndpoint) \}" --path src/index.ts
   │  56:export { forApiGateway } from './…/genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway';
   │  95:export { genLambdaEndpoint } from './…/genLambdaEndpoint.forAskEndpoint/genLambdaEndpoint.forAskEndpoint';
```

---

# 🔴 .the escalation — 2026-09-23, after the third raise

peer lane `r1 repo-rules` raised this as **blocker.1** at 5.3.verification. that is the **third**
raise (self-review 4/8, self-review 7/8, now a peer), and my answer each time was an **argument**
rather than a change. ⇒ `rule.always.reread-the-subject-a-repeated-find-names` fires: *"treat the
argument as the suspect. go re-read the subject it defends."*

i re-read it, and took a second opinion from an **architect** peer first
(`rule.always.get-a-second-opinion-before-foreman`). the re-read found a fact **neither side of the
fork had measured**.

## 🔴 .the decisive measurement — both consumers PIN EXACTLY

```
$ rhx git.repo.get lines --in ahbode/svc-gateway       --paths 'package.json' --words 'sdk-aws-lambda'
   │  85:     "sdk-aws-lambda": "0.4.1",
$ rhx git.repo.get lines --in ahbode/svc-home-services --paths 'package.json' --words 'sdk-aws-lambda'
   │  76:     "sdk-aws-lambda": "0.3.0",
```

**neither is a caret range** (this org mandates exact pins — `rule.require.pinned-versions`). so no
release reaches either repo automatically. each crosses every break in between via **one deliberate,
human-authored upgrade pr**.

⇒ 🔴 **option B's entire rationale collapses on that fact:**

| | B saves `svc-home-services`… | B costs `svc-gateway`… |
|---|---|---|
| the claim | *"it stays outside the break"* | *(unstated)* |
| 🔴 the measurement | **zero.** it sits at `0.3.0`, **three minors** behind the `0.6.0` target, so it absorbs this rename in the same single upgrade pr whether it ships in `0.6.0` or later | **a second 78-file pass.** its `0.4.1 → 0.6.0` pr already opens every one of those files, and they will not be open again |

and the twin's real migration is **4 lines in 4 files** — the import line does not even move, because
the family export keeps the name `genLambdaEndpoint`:

```ts
// ahbode/svc-home-services/src/contract/handlers/public/*.ts   (×4)
import { genLambdaEndpoint } from 'sdk-aws-lambda';   // UNCHANGED
export const handler = genLambdaEndpoint({ … });      // + `.forAskEndpoint`
```

⚠️ **and the instrument is the defect class this route has now caught six times.** the vision called
`svc-home-services` *"the first cross-repo positive control"* — a claim about consumer blast radius,
argued from an **import graph** where the fact that carries the weight is the **pin**
(`rule.require.measure-the-value-you-emit`). the vision's consumer table owes a pin column whatever
is ruled.

## .two corrections to the fork's own cost figures

| the figure | the correction |
|---|---|
| *"plus deployed handler assets under `provision/`"* | 🔴 **there is NO deployed-asset cost.** both `provision/` hits are comments; the handlers are deliberately standalone with no sdk imports. that removes a cost item from **B's** side |
| *"~117 in-repo call sites"* | ~111 call-shaped occurrences across 16 files, plus 15 readme mentions. the large majority are **this repo's own tests** — a `sedreplace` pass with a red build if incomplete |

## ⛔ ~~.the trap to kill on sight, before it becomes a fulcrum~~ → 🔴 **STRUCK. THIS IS WHAT THE WISHER CHOSE.**

⚠️ **read the block below as the record of a wrong call, kept rather than deleted.** it is the
option the wisher ruled, argued against here in the strongest terms i had.

> ~~a **callable namespace** — `Object.assign(forAskEndpointFn, { forApiGateway, forAskEndpoint })` —
> appears to buy A's benefit at B's price: `forApiGateway` gains its family prefix while
> `genLambdaEndpoint({ … })` still resolves.~~
>
> ~~🔴 **reject it.** it puts **two valid spellings for one variant** on a public surface — precisely
> what **F07** rejected for `rawEvent` (*a both-fields release*), and what
> `rule.require.widen-before-parallel` and `rule.forbid.defended-exceptions` each forbid.~~

⇒ the refutation is in `.the verdict` below. **all three rule citations were misapplied**, and the
F07 analogy inverts on the one axis that decides it.

## .the driver's recommendation — **A, land it now**

the strongest reason: **the two halves are not separable.** to free the family name for
`genLambdaEndpoint.forApiGateway`, the ask variant must give it up. so *"defer"* does not defer the
twin's half — it defers the **`forApiGateway`** half too, the one whose 78 consumer call sites are
open on a desk right now.

and the wish's own argument for the rename applies verbatim to the export name:

> *"the honest rename is cheap now and expensive later, once consumers multiply."*

⇒ to accept that for `rawEvent` and reject it for `forApiGateway`, in one release, is internally
inconsistent. **if the wisher declines A, the yield owes a sentence on why the same argument stops
at the field boundary.**

### ⚠️ the strongest reason AGAINST my own recommendation, stated

**the wish's bound is explicit and procedural**, and A presses through it:

> *"this task changes `invoke`'s INPUT SHAPE only"* … a proposal that grows beyond it *"must **stop
> and re-scope** rather than press on."*

an export rename is growth on a **different axis** than the one the wish authorized, and the
instruction for that case is not *"fold it in when it is cheap"* — it is **stop**. ⇒ that sentence is
why this is escalated rather than simply done.

a second real cost B avoids: a `0.6.0` upgrade pr in `svc-gateway` would **confound two independent
breaks** in one diff and one changelog entry. if that 78-file migration goes wrong, the input-shape
change and the export rename are entangled, and to bisect them is harder.

## 🔴 .why this is the WISHER's call, and not mine

1. the wish's own instruction on growth is **"stop and re-scope"** — it says where to send the
   question, rather than how to answer it
2. **F07 is exact precedent.** the same class of question — how much break does one release carry,
   against a known consumer base — went to the wisher and came back in one sentence
   (*"yeah we want a hard cutover … that's on purpose"*). the ask cost nearly zero and settled it
3. this entry said so itself at 79%: *"it is the wisher's call, and I did not ask."* ⇒ **that
   confidence gap was never analytic uncertainty. it was an unasked question dressed as a percentage**

⚠️ and what must **not** happen is a silent deferral. a deferral recorded as *"out of scope"* rather
than as *"escalated and ruled"* is itself the defect
(`rule.always.fix-forward-under-scouts-honor` — *scope is the excuse a deferral hides behind*).

---

# 🔴 .the verdict — RULED by the wisher, 2026-09-23. **neither A nor B.**

> *"absolutely not. enrule and enbrief that the only acceptable `genLambdaEndpoint` shape is the one
> that has `genLambdaEndpoint.{forApiGateway,forAskEndpoint,etc}` that rides on it. `forApiGateway`
> should never be directly exported"*
> *"`forAskEndpoint` is acceptable as the default `genLambdaEndpoint`"*
> *"but `genLambdaEndpoint.forApiGateway` MUST be accessible"*
> *"both must be as leafs"*
> *"`genLambdaEndpoint = forAskEndpoint & { forAskEndpoint, forApiGateway }`"*
> *"default = `forAskEndpoint`, but exposes the others"*

```ts
export const genLambdaEndpoint = Object.assign(forAskEndpoint, {
  forAskEndpoint,   // 🔴 the default rides too — a leaf like every peer
  forApiGateway,
});
```

⇒ **option C, and it is the option this entry told the council to kill on sight.**

## 🔴 .my own position was OVERRULED, and the argument was wrong three ways

the struck section rested on one claim — *"two valid call forms for one variant on a public
surface"* — plus three rule citations. the claim is **true**. the citations are **each misapplied**,
and it is worth the record because all three misfire the same way: they were applied to a *surface
count* when each governs a *semantic* property.

| the citation | what it actually forbids | why it does not fire here |
|---|---|---|
| **F07** — *a both-fields release* | `event` **and** `rawEvent` on one bag, **two slots with two senses**. a caller must learn which is which, and can take the wrong one | 🔴 **it inverts.** here there is **one function** reachable two ways. no caller can take the wrong thing, because there is no second thing |
| `rule.require.widen-before-parallel` | a **peer export added beside** an extant one | 🔴 **backwards.** the callable default **collapses two exports into one**. that rule's whole demand is *widen rather than add a peer* — which is exactly what was done |
| `rule.forbid.defended-exceptions` | an exception held in place by **prose with no axis** | it fires only with **no axis**. there is one: *has this family shipped a bare name?* — a property of the family that no edit can remove, so this is a **second case** rather than an excuse |

🔴 **and the load-bearing error was a cost i never measured.** my recommendation (A) priced the
alternative at zero for the twin's consumer. it is not zero:

| | option A — a plain object | 🔴 option C — the ruled shape |
|---|---|---|
| `ahbode/svc-gateway` (78 files) | migrates | migrates — **identical** |
| `ahbode/svc-home-services` (4 call sites) | 🔴 **migrates**, for a rename it gains naught from | ✅ **untouched.** `genLambdaEndpoint({ … })` still resolves |
| the family name | ✅ repaired | ✅ repaired |
| the bare `forApiGateway` export | ✅ gone | ✅ gone |

⇒ **C achieves every outcome A does, and costs one consumer repo strictly less.** i argued against
it on a rule-citation basis while the measurable difference pointed the other way — which is this
drive's own defect class, one more time: *a claim stated in the register of a measurement, with no
observation behind it* (`rule.require.measure-the-value-you-emit`).

⚠️ **and the pin table i had already written was the evidence.** i measured *"both consumers pin
exactly"* to refute option B, and then did not re-read it against option A. a repo three minors
behind absorbs whatever ships — so a rename A imposes on `svc-home-services` is a real cost in its
next upgrade pr, and C is what removes it. **the measurement was on the page and i applied it to one
fork arm only.**

## .the two live costs, kept honest

the struck section named a real cost and mis-argued it. stated correctly:

| the cost | its status |
|---|---|
| two call forms for one variant, permanently | ✅ **real**, accepted, and recorded at the declaration with its **axis** — so it is a second case rather than a defended exception |
| the `0.6.0` pr in `svc-gateway` confounds two independent breaks | ✅ **real**, and unchanged by C. the input-shape change and the export rename land in one diff either way |

## .what shipped

| # | | |
|---|---|---|
| 1 | **the leaf, renamed off the family name** | `genLambdaEndpoint.forAskEndpoint.ts` now exports `forAskEndpoint`, with a `⚠️ .renamed` note that states this declaration held the family's name until 2026-09-23 and **that is what left its peer with none** |
| 2 | **the family object** | `domain.operations/genLambdaEndpoint/genLambdaEndpoint.ts` — new file, one `Object.assign`, the trade and its axis in the doc-comment |
| 3 | **`src/index.ts`** | the bare `forApiGateway` export **deleted**; the family export repointed at the new file. one line for the whole family, no variant beside it |
| 4 | 🔴 **the clamp** | `blackbox/local.sdkContract.acceptance.test.ts` — three `then`s on the family's shape, **plus a new `[t1]` that reads the module's whole key set** and refuses any bare `for*` peer. the three shape assertions all stay green with a bare peer re-added; only `[t1]` goes red, and the bare peer is the **cause** |
| 5 | **every in-repo call site** | 19 blackbox + 12 unit + 2 fixture + 1 cross-variant, and 2 deep imports repointed at `../src/index` |
| 6 | **the readme** | 2 import lines + 7 call sites. ⚠️ `:322` and `:351–353` needed **no** edit — they already read as the ruled shape, because the family IS callable |
| 7 | **the enrule** | `rule.forbid.unqualified-variant-exports` — the ruled shape, the axis, the new/extant split, the key-set clamp, and two of its own stale claims struck |
| 8 | **the enbrief** | `domain.terms/genLambdaEndpoint.md` — etymology, the reversal, rejected alternatives, the member set, invariants. plus row 6 in `domain.terms/.readme.md` |

## .the verification

| gate | |
|---|---|
| types | ✅ |
| format | ✅ |
| lint | ✅ — one `organizeImports` fix on `src/index.ts`, applied |
| unit | ✅ **641** passed |
| integration | ✅ **75** passed |
| acceptance | ✅ **253** passed |

**969 total**, up exactly **+2** from 967 — which reconciles to the clamp: 2 `then` blocks → 3, plus
the new `[t1]`.

⚠️ **9 snapshots were written** on the first unit run, from the `describe` rename. each new
`forAskEndpoint given: [caseN]…` entry was verified **byte-identical** to its obsolete
`genLambdaEndpoint given: [caseN]…` twin before the prune — the rename moved a key and not one byte
of any value. a clean run after the prune writes zero.

## ⚠️ .two `origin/main`-only gates still go red on the rebase

neither is on this branch, and this change makes the first **certain**:

| | |
|---|---|
| `src/index.test.ts [t4]` | an exhaustive export list. `forApiGateway` left it and `genLambdaEndpoint` changed identity |
| `advertisedExamples.coverage.integration.test.ts [case2][t0]` | regex-reads the readme section this change rewrote |

## .the status

🔴 **RULED — option C, by the wisher, 2026-09-23. landed, verified, enruled, enbriefed.**

⛔ ~~escalated, awaits the wisher~~ · ⛔ ~~unruled — open for the fulcrum council~~ — both struck.

✅ **the escalation was the right move and the recommendation was the wrong one.** those are separate
verdicts and the entry records both: `rule.always.raise-a-blocker-a-taken-cannot-close` asked for the
question, and the answer came back as a shape neither fork arm held.
