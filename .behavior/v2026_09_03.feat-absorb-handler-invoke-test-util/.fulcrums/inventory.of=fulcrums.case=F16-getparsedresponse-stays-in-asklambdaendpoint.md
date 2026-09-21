# F16 — `getParsedResponse` stays where it is, and `runLambdaEndpoint` reaches for it

> added at peer review r005 (`arch-smell-scopeleaks`), which raised the reach-in as a **blocker**.
> it exists because the blocker has **two halves with opposite rework grades**, and a single
> verdict on it would have been wrong either way.

## the fork, stated fairly

r005 charged that `runLambdaEndpoint` imports two files that are private internals of peer
operations:

| # | the reach-in | what it is |
|---|---|---|
| 1 | `../../genLambdaEndpoint/middleware/getErrorResponseBody` | the two envelope **types** |
| 2 | `../askLambdaEndpoint/serde/getParsedResponse` | the wire **hydration** |

**the charge is correct on both, and the repo's own rule says so more plainly than the reviewer
did.** `rule.prefer.most-common-denominator`: *"when another domain reuses an operation, lift it to
their common ancestor … 2+ usages across sibling domains → proven need, lift now."*

so the fork is not *whether* the reach-ins are real. it is **whether each lift is affordable in this
drive.**

## taken, and why at the time

**split — half repaired, half deferred**, because the two halves measure differently:

| half | rework | verdict |
|---|---|---|
| the envelope **types** | **clean** — 2 interfaces, no logic, no deps, 3 files | ✅ **lifted** to `domain.objects/LambdaEndpointErrorResponseBody.ts` |
| **`getParsedResponse`** | 🔴 **dirty** — see below | deferred, and recorded here |

### the measurement that graded the second half dirty

`rule.always.fix-forward-under-scouts-honor` asks two questions, and only the second fails:

- **SAFE?** ✅ a move plus import updates; `tsc` catches every miss
- **CLEAN?** 🔴 **no.** `getParsedResponse.ts:1-13` sits atop **six** modules inside
  `askLambdaEndpoint/`:

```
../error/getIsLambdaErrorResponse   (2 symbols)
../error/getLambdaErrorMetadata
../error/getStackTraceString
./asUnprefixedErrorMessage
./getDecodedPayload
./getParsedJson
```

⇒ **to lift the leaf is to lift the subtree**, or to leave the leaf that reaches back into the
folder it just left — which is the same defect, pointed the other way. plus its own test file and a
snapshot.

🟡 **and the ripple estimate is a CLAIM, so it is stated as one.** i did not run the move; i counted
its edges. this drive has been wrong three times about a deferral's cost (F13, F14, F8), always in
the direction of *over*-estimation. the honest read is: **6 edges is evidence of dirt, never proof
of it**, and one `tsc` run after a real move would settle it.

## 🔴 why the deferral is defensible on scope, not merely on cost

the wish scopes this drive to the **successor utils**. `askLambdaEndpoint` is a **production
caller** that predates this drive and is untouched by it.

⇒ so to restructure its serde subtree is to deliver past the wish — which is
`rule.forbid.scope-leaks`, the **same rule r005 cited**, applied in the other direction.

⚠️ **that symmetry is the honest core of this entry, and it does not settle itself.** one read of
the rule says *"do not reach into a peer's internals"*; the other says *"do not restructure a peer
you were not asked to touch"*. **both are this rule, and they point opposite ways here.** a council
that takes the first as primary should rule this repaired rather than deferred.

## the counterargument this fulcrum exists to record

🔴 **the dependency is on a PUBLIC surface, and that is worse than an ordinary reach-in.**

`onSerialized`'s local locus returns whatever `getParsedResponse` returns. so a change to
`askLambdaEndpoint`'s private serde does not merely ripple into `runLambdaEndpoint`'s
implementation — it changes **what a consumer of the published sdk receives**.

⇒ the type half had exactly this shape and was lifted for exactly this reason. **the argument that
justified a repair on half applies unchanged to the half deferred.** the only thing that differs is
the price.

🟡 and the mitigation is thin: `onSerialized`'s docblock states *"one hydration, shared with the
wire — so the two loci cannot disagree"*, which documents the dependency without a cure for it.

## rework, and why clean

**clean, and purely mechanical.** the lift is a file move plus ~5 import updates, every one of them
`tsc`-verified. no caller of `onSerialized` changes, no assertion is invalidated, no return type
moves.

⇒ so a council that rules against this deferral pays a refactor, never a redesign. **that is what
makes the deferral affordable to be wrong about** — and it is the reason this is a fulcrum rather
than a block.

## confidence, and why 72%

the lowest on the board, and it displaces F8.

- the **charge** is not in doubt — the reach-in is real, and the repo's own rule names the fix
- the **28%** is entirely about the deferral: two reads of one rule point opposite ways, and i
  chose the one that keeps my diff smaller

🔴 **that is a suspicious tiebreak, and i record it rather than hide it.** *"the fix is out of
scope"* is the most self-serving sentence a driver can write, and it is exactly the sentence
`rule.always.fix-forward-under-scouts-honor` warns is not one of the two questions.

## 🔴 a THIRD option, raised at i004 r011 — and the dichotomy above was false

r011 (`enroll-impl-arch-defects`) read this entry and rejected how it framed the fork:

> *"**That's a false dichotomy — there's a third, near-zero-cost option that mirrors the fix already
> applied to the type half.** You don't need to move `getParsedResponse` or its 6 dependencies
> anywhere. You only need to make it a *declared* export of the domain that already owns it."*

```ts
// askLambdaEndpoint.ts — add one line
export { getParsedResponse } from './serde/getParsedResponse';
```
```ts
// onSerialized.ts — change the import source, and no more
import { askLambdaEndpoint, getParsedResponse } from '../askLambdaEndpoint/askLambdaEndpoint';
```

**the charge lands, and the entry above earns it.** this fulcrum measured *"lift"* against *"leave"*
and never asked whether the reach-in could be made **declared** with no move at all. r011 names the
conflation precisely: *"The SAFE/CLEAN measurement in F16 conflated 'lift' with 'declare'."*

### verified, rather than taken on report

| r011's claim | checked |
|---|---|
| `onSerialized.ts` already imports from `askLambdaEndpoint.ts` | ✅ `:5` — so the edge is **not new** |
| the re-export introduces no cycle | ✅ `getParsedResponse.ts:1-13` imports no `askLambdaEndpoint.ts` |
| it touches none of the 6 leaf modules | ✅ the diff is 2 lines |

### 🔴 and it collides with a repo rule the reviewer could not see

`rule.forbid.barrel-exports` (ehmpathy/mechanic) closes with three words: **"no export forwarders."**

⇒ walked the tree before this was asserted: **every** `export { x } from './y'` in `src/` — 30+ of
them — lives in `src/index.ts`, the public package barrel that `rule.forbid.index-ts` expressly
permits. **there is not one export forwarder in a non-barrel file in this repo.**

so r011's two-line fix would be the first, and the rule's stated reasons bite at least twice:
*"increase codepath variants"* (two import paths for one symbol) and *"increase cyclical import
chances"* (none today, and the new edge is what makes one possible later).

🟡 **this does not refute the option — it prices it.** the rule's banned examples are all `index.ts`
barrels, so a council could read *"no export forwarders"* as scoped to barrels and take r011's fix
at its stated cost. that read is available and it is **not mine to make**, which is why this is
recorded rather than acted on.

### 🟡 and one correction to r011's statement of the harm

r011 prices the reach-in as a hazard where a future `askLambdaEndpoint` maintainer renames or moves
`serde/getParsedResponse.ts` and never learns they broke `onSerialized`'s public output.

**a rename does not break silently — `tsc` fails on the unresolved import, at once.** so the harm is
not a quiet break; it is that the dependency is **undeclared**, so the maintainer meets it as a
compile error in a peer domain rather than as a contract they knew they owed.

⇒ that is a real harm and a smaller one than stated, and it argues for a cheaper remedy rather than
a more urgent one.

## the three options, priced

| # | option | diff | cost |
|---|---|---|---|
| 1 | **leave it** — the status quo this entry records | 0 | an undeclared dependency on a public return surface |
| 2 | **declare it** — r011's re-export | 2 lines | the first non-barrel export forwarder in the repo (`rule.forbid.barrel-exports`) |
| 3 | **lift it** — move the leaf to a common ancestor | a 6-module subtree | `rule.prefer.most-common-denominator`'s own prescription; graded dirty above |

## 🔴 r011 RULED at i006 — **lift**, on a precedent this entry never weighed

the same lane that raised the third option two rounds earlier came back and struck it:

> *"The drive already set the precedent for exactly this shape: `LambdaEndpointErrorResponseBody`
> was lifted out of `genLambdaEndpoint/middleware` into `domain.objects/` on the strength of
> `rule.prefer.most-common-denominator` ('2+ usages across sibling domains → proven need, lift
> now'). `getParsedResponse` now meets the identical test. I'd rule: **lift**, not
> leave/declare — move `getParsedResponse` and its true dependency subtree to a shared home
> (e.g. `domain.operations/lambdaEndpointSerde/`), as a pure file-move + import-repoint with no
> behavior change, landed as its own small commit so it's reviewable in isolation."*

**the precedent is real and this entry never cited it**, which is the substantive gap. the type
half of this very drive already ran the lift the rule prescribes, on the same rule, for the same
reason — so option 3 is not a hypothetical prescription here, it is **the move this drive already
made once**.

⇒ that shifts what option 3 costs to argue for. a council that weighs *"lift is dirty"* against
*"lift is what the rule says"* now also weighs *"and we already did it, in this diff, and it was
clean."*

### what the call closes, and what it does not

| option | r011's verdict at i006 |
|---|---|
| 1 — leave it | rejected: the reach-in meets the rule's own 2+ test |
| 2 — declare it (its OWN i004 proposal) | **"correctly dead"** — the barrel-export collision stands |
| 3 — lift it | 🔴 **ruled** — precedent, pure move, own commit |

🟡 **a reviewer that overturns its own earlier proposal on a fact the driver supplied is the
convergence loop at work**, not a reviewer that merely changed its mind. i004's re-export was
proposed without sight of `rule.forbid.barrel-exports`; the walk in this entry supplied it, and
r011 took it.

⚠️ **it stays unruled by ME.** r011 says *"I'd rule"*, and a reviewer's preference is evidence for
the council rather than a verdict from it — a lift is a subtree move on a shipped public return
surface, which is the exact shape `rule.always.defer-fulcrums-to-last` reserves. the difference
after i006 is that the fork is no longer three-wide: **option 2 is dead by the reviewer's own hand**,
and the council chooses between leave and lift.

## where

- `runLambdaEndpoint.onSerialized.ts:6` — the import
- `askLambdaEndpoint/serde/` — the subtree a lift would move
- `rule.forbid.barrel-exports` — the rule option 2 collides with
- the dream: `.dream/v2026_09_09.repair.lift-the-wire-serde-to-a-common-ancestor.md`

## 🔴 RULED by the wisher, 2026-09-10 — **lift**, and it shipped in the same round

> *"lift; │ lift │ move the leaf + its 6-module subtree to a shared ancestor. pure file-move,
> tsc-verified, no behavior change │"*

the wisher took option 3, and quoted back the row's own price as the reason. **that price was the
argument against the lift, and the wisher read it as the argument for it** — a move whose worst case
is a `tsc` error is not a fork worth a council's time.

### what shipped

```
src/domain.operations/askLambdaEndpoint/serde/getParsedResponse.ts   →  lambdaEndpointWire/getParsedResponse.ts
src/domain.operations/askLambdaEndpoint/error/getIsLambdaErrorResponse.ts →  lambdaEndpointWire/error/…
src/domain.operations/askLambdaEndpoint/error/getLambdaErrorMetadata.ts   →  lambdaEndpointWire/error/…
src/domain.operations/askLambdaEndpoint/error/getStackTraceString.ts      →  lambdaEndpointWire/error/…
src/domain.operations/askLambdaEndpoint/serde/asUnprefixedErrorMessage.ts →  lambdaEndpointWire/serde/…
src/domain.operations/askLambdaEndpoint/serde/getDecodedPayload.ts        →  lambdaEndpointWire/serde/…
src/domain.operations/askLambdaEndpoint/serde/getParsedJson.ts            →  lambdaEndpointWire/serde/…
```

plus 7 test files and 1 snapshot. four import sites repointed:

| site | why it holds the edge |
|---|---|
| `askLambdaEndpoint/invoke/executeLambdaInvocation.ts` | the wire caller — the original owner |
| `runLambdaEndpoint/runLambdaEndpoint.onSerialized.ts` | 🔴 **the reach-in this lift repairs** |
| `__test_assets__/askLambdaEndpointAncient.ts` | a second reach-in nobody had flagged |
| `lambdaEndpointWire/getParsedResponse.test.ts` | travels with its subject |

⇒ **the third importer is the find.** a test asset was reaching into the same private serde and no
lane caught it, because every lane read the diff and that file predates the diff. **the lift closed
a defect the review never saw**, which is the case `rule.prefer.most-common-denominator` exists for.

### 🔴 the entry's own price was wrong, and the pattern is now three-for-three

| the entry claimed | measured |
|---|---|
| *"six modules"* | **7 modules**, 7 tests, 1 snapshot — an UNDER-estimate of the count |
| CLEAN? 🔴 **no** | `tsc --noEmit` **passed on the first run**, no manual fixups |
| *"to lift the leaf is to lift the subtree"* | correct, and the subtree is closed — only `getLambdaErrorMetadata` imports a sibling, and it travels along |
| *"or to leave the leaf that reaches back"* | did not occur. `getStatusCodeHint` + `getLambdaPayload` stay behind and neither is reached from the moved set |

⇒ **this drive has now over-priced three deferrals in the same direction: F13, F14, and F16.** each
named its own cheap settler; none ran it. the entry above even states the rule —

> *"6 edges is evidence of dirt, never proof of it, and one `tsc` run after a real move would settle
> it."*

🔴 **and the honest read of the 28% is that it was pointed at the right thing.** the confidence line
said the doubt was *"entirely about the deferral: two reads of one rule point opposite ways, and i
chose the one that keeps my diff smaller."* it also called that tiebreak *"a suspicious tiebreak, and
i record it rather than hide it."* ⇒ the record is what let a council overturn it in one line.

### what the name settles that the fork did not

r011 proposed `domain.operations/lambdaEndpointSerde/`. it shipped as **`lambdaEndpointWire/`**,
because `serde` is what the subtree's *files* do and **wire** is what the subtree is *for* — the
hydration both loci share so they cannot disagree. the two `serde/` and `error/` folders survive
inside it, so the leaf names did not move at all.

## the verdict

_✅ **ruled — lift.** shipped 2026-09-10. gates after: `types` ✅ · `format` ✅ · `lint` ✅ ·
`unit --thorough` **700 passed / 59 suites** ✅ · `integration --scope path://runLambdaEndpoint`
**37 passed / 4 suites** ✅._
