# F20 — `trail` rides the `invoke` bag in `forSqs`, and NOT yet in `forApiGateway`

| | |
|---|---|
| **rework** | clean — the slot was deleted, not added |
| **status** | 🌙 **DISSOLVED**, 2026-09-25 |
| **confidence** | n/a — the fork is closed |
| **where** | `genLambdaEndpoint.forSqs.perRecord.ts` · `…perBatch.ts` · `genLambdaEndpoint.forApiGateway.ts` |
| **caught** | 2026-09-25, at the moment the sqs `invoke` signature was first written |

## 🔴 the verdict — the fork had a THIRD arm nobody offered

> *"ok then why would trail ever be on input if it should always be on context?"*
> *"absoutely not"* · *"forbid that crap"*
> — the wisher, 2026-09-25

this entry asked *"does `forApiGateway` grow the slot, or does sqs keep an unexplained
asymmetry?"* — and both arms assumed the slot belongs in `input` at all.

🔴 **it does not. `trail` is AMBIENT runtime, so it rides `context` and only `context`**
(`rule.require.env-access-in-context`). the asymmetry closed by the **deletion** of the sqs slot,
so `forApiGateway` was the correct shape the whole time and this entry had the two families the
wrong way round.

⚠️ **the tell this entry missed** is on its own page: it recorded that every family already reaches
the lineage at `context.log.trail`, and read that as *"the gap is one hop"* rather than as *"then
the slot buys naught and duplicates an ambient value into the request bag."* ⇒ a measurement that
REFUTES a fork is worth more than one that sizes it, and this drive read it as the latter.

the clamp is `[case1]`'s *"the input bag carries NO `trail` key"*, on both sqs variants — it reads
the **absence** at runtime, because a slot re-declared on the type alone would compile everywhere
and still be wrong.

---

_what follows is the record as it stood before the verdict._

## the fork, stated fairly

the wisher ruled the four-slot shape on 2026-09-24:

> *"and trail is different than headers — `{ payload, headers, event, trail }`"*

that ruling arrived while the **api-gateway** family was the only one that existed. `forSqs` was
built after it, so the question is which family the ruling reaches.

| | |
|---|---|
| **A — the new family only** | `forSqs` hands `trail` in the `invoke` bag. `forApiGateway` keeps `trail` reachable **only** at `context.log.trail`, as it is today |
| **B — both, in this wish** | sweep the api-gateway family too, so the ruled shape holds everywhere at once |
| **C — neither** | leave `trail` in `context` for both, and read the ruling as a statement about the TERM (raw-vs-reconciled) rather than about a SLOT |

## taken, and why at the time

🔴 **A**, and the SAFE/CLEAN test is what decided it — never the scope
(`rule.always.fix-forward-under-scouts-honor`):

| | |
|---|---|
| **safe?** | 🔴 **no, for B.** `forApiGateway`'s `invoke` bag is the surface **78 production files** destructure. to add a slot is additive at the type level and it re-opens a contract this wish already broke once, in the same release, for a different reason. two breaks to one signature in one version is a migration a consumer reads as churn |
| **clean?** | 🔴 **no, for B.** the api-gateway hand-off is built by `logic` at one site, but the ⚠️ **acceptance corpus** asserts its shape across 12 blackbox suites and 257 cases. a slot added there ripples into snapshots this wish's subject never intended to open |

⇒ **both answers are no for B, so B is deferred and the deferral is recorded.** A ships because
`forSqs` is **new** — no consumer calls it, so its shape costs nobody a migration and the ruled
four-slot form is free at birth.

⛔ **C is refused on the wisher's own words.** *"trail is different than headers"* is a statement
about **two slots**, made in a sentence that enumerates four. to read it as term-only would be to
answer a question the wisher did not ask.

## ⚠️ why this is a fulcrum rather than merely a deferral

**the deferral creates an asymmetry between two live families**, and an asymmetry is exactly what
`rule.forbid.defended-exceptions` grades:

| family | `trail` in the `invoke` bag? | traceable to an AXIS? |
|---|---|---|
| `forSqs` | ✅ yes | — |
| `forApiGateway` | ⛔ no | 🔴 **no.** both families mint a trail; both hand a `ContextLogTrail`. no property of http makes the slot wrong there |
| `forAskEndpoint` | ⛔ no | ⚠️ **unexamined** |

⇒ 🔴 **this asymmetry has NO axis behind it.** it is a property of *when each family was written*,
which is chronology rather than domain — and chronology is the one justification that rule refuses
outright. so the honest record is: **A is a scheduling decision, not a design one**, and it owes a
sweep in a later round rather than a paragraph here.

⚠️ that is the sharpest reason the confidence is not higher. a reviewer who reads only the two
signatures sees an exception with no axis, and they are **right** to.

## why the rework is dirty

the repair (B) is additive at the type level and cheap to write — one slot, one hand-off site. what
makes it dirty is the **proof**: 12 acceptance suites and 257 cases assert the api-gateway hand-off,
and an added slot changes what several of them snapshot. ⇒ the fix is one line; the verification is
a corpus.

and the cost falls on the **consumer** rather than on the repo: a second signature change to a
surface this wish already broke, inside one version.

## the confidence, and why it is not higher

**88%.** the 12 points:

- 🔴 **the no-axis asymmetry above is the whole of it.** i cannot name a property of http that makes
  the slot wrong at api gateway, and a deferral whose only justification is *"that family is older"*
  is the shape this repo's own rules refuse
- ⚠️ a reviewer may fairly hold that **an additive slot is not a break** — a consumer who does not
  destructure `trail` is untouched, so the *"two breaks in one version"* argument overstates the
  cost. that read is sound, and what it weighs against is the **snapshot corpus**, not the contract
- ⚠️ and `forAskEndpoint` is **unexamined** here. F06 scopes the twin out of this wish, so its row
  above is an honest blank rather than a measured zero
  (`rule.require.positive-control-before-absence-claims`)

## the sweep the cause implies

> **the cause**: *a ruled hand-off shape applied to the family that was under the pen, and not to
> its peers.*

that sentence's subject is **every family's `invoke` bag**, so the sweep is one row per family:

| family | `payload` | `headers` | `event` | `trail` | swept? |
|---|---|---|---|---|---|
| `forApiGateway` | ✅ | ✅ | ✅ | ⛔ **absent** | 🔴 **open** — dreamed |
| `forSqs.perRecord` | ✅ | ✅ | ✅ | ✅ | ✅ shipped |
| `forSqs.perBatch` | ⚠️ per-record | ⚠️ per-record | ✅ | ✅ | ✅ shipped |
| `forAskEndpoint` | ⛔ n/a — no envelope | ⛔ n/a — no bag | ✅ (its whole input) | ⛔ absent | ⚠️ out of scope (F06) |

⚠️ **`perBatch`'s two ⚠️ rows are an axis, not a gap.** the batch variant lifts no singular `payload`
or `headers`, because an invoke carries N messages and a singular lift would assert a cardinality the
runtime does not have. they ride **per record** instead — `records[i].payload` — which is the same
word at the grain the trigger forces (`domain.terms/event.md`, the cardinality caveat).

⇒ **one live member open**, one traced to an axis, one scoped out. the api-gateway row is the work.

## the verdict, once ruled

_(unrecorded — open)_

## see also

- `dreams/v2026_09_25.fix.trail-is-absent-from-the-apigateway-invoke-bag.md` — the work owed
- `domain.terms/trail.md` — the term, its etymology, and the `.the reach` table this entry is the
  open row of. ⚠️ that file names this asymmetry outright, so a reader cannot take it as ruled
- `domain.terms/headers.md` — *"`trail` is NOT `headers`"*, the raw-vs-reconciled axis the wisher's
  sentence rests on
- `rule.forbid.defended-exceptions` — the rule that grades the asymmetry this entry creates
- `rule.always.fix-forward-under-scouts-honor` — the two questions that ruled A
- `rule.require.sweep-the-defect-class` — the per-family sweep above
