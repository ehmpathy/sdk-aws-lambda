# F10 — the four terms are enbriefed IN THIS WISH, not deferred to its own

**rework** clean · **status** 🔴 **RULED** — enbrief, per the wisher · **confidence** settled

a **scope addition**. the wish asked for a rename; it did not ask for four ubiqlang briefs.

## the fork, stated fairly

| option | what it is |
|---|---|
| **A — enbrief now, as a vision deliverable** ✅ **RULED** | four files land under `domain.terms/` beside the contract change |
| **B — enbrief as its own wish** | a term-cluster wish, scheduled after this one |
| **C — do not enbrief** | the doc-comments on the fields carry the senses; no brief |

## ruled, and why

🔴 **the wisher ruled A on 2026-09-20**, with the term list and a reason per term:

| term | the wisher's stated why | what the file became |
|---|---|---|
| `payload` | *"the wire-form marker — the one whose absence caused the error"* | 🔴 **inverted.** `payload` is the **body**; the wire form is `*Wire`. the enbrief is what found it |
| `request` | *"new term; must state the middy-bag collision and that it's internal-only"* | ⛔ **deleted.** the term was struck; the middy fact moved to `event.md` |
| `event` | *"extant ubiqlang, but its boundary with `request.body` (transform, not projection) is unstated"* | 🔴 **widened.** `event` is the **whole object**; the transform boundary is now `event.rawPayload` → `payload` |
| `headers` | *"why one field earned a lift and three did not — the 65/0/0/0 measurement"* | ✅ **as asked** — the one term the ruling did not disturb |

⇒ each of the four reasons names a **defect that already occurred on this drive**, which is what
separates A from B. deferred, the briefs would document a lesson only after the cost of their
absence had been paid a second time.

⚠️ 🔴 **three of the four rows changed in the course of writing them.** that is not a failure of the
wisher's list — it is the strongest evidence for A that exists. the terms could not be documented
without being examined, and they could not be examined without being corrected.

## 🔴 the evidence A rests on — the wish's own title was wrong

the `Payload` convention lived in **two doc-comments and 250 unlabeled usages**
(`ApiGatewayRequestPayload.ts:8-11`, `ApiGatewayResponsePayload.ts:22-24`). the wish proposed
`payload` for the handler's **envelope** — the exact inverse of that convention's sense — and the
inversion reached the wish's title and its acceptance discussion before anyone read the two blocks.

⇒ that is **F01**, which this drive raised at 90% and which overturned the wish's lead proposal. a
brief is the artifact that stops the next author from the same inversion, and `domain.terms/` did
not exist (measured: `globsafe '.agent/repo=.this/role=any/briefs/*'` → 31 files, zero under
`domain.terms/`).

⚠️ and `rule.require.persist-domain-term-evidence` already mandated it: **`request` is a new term
proposed to the distillate, so a file is owed regardless of this fulcrum.** A is the rule's own
demand; B and C were a deferral of it.

## 🔴 what landed — THREE files, not four

```
.agent/repo=.this/role=any/briefs/domain.terms/
├── .readme.md     the pipeline diagram + the two reversals, on the record
├── event.md       the whole object that arrived — and why `request` was struck
├── payload.md     the body — and the aws-vs-http inversion that caused `rawEvent`
└── headers.md     the projection, and the 78/65/0×5 measurement
```

⚠️ **a fourth, `request.md`, was written and then DELETED.** the term it documented was struck by
F01 mid-drive, and a brief for a term the repo does not hold is a trap for the next reader. its one
durable fact — *middy's `request` bag is real and internal-only* — moved into `event.md`, which is
where an sdk contributor meets it.

## 🔴 the enbrief is what CAUSED the F01 inversion — and that outranks the verdict

A was ruled on the argument that *"a brief stops the next author from the same inversion."* it did
better than that: **it caught the inversion this drive had already made.**

`rule.require.persist-domain-term-evidence` demands a term file record its **etymology** — where
the word comes from, and why this word rather than its rejected synonyms. to write that section for
`payload` forced the one question nobody had asked:

> *"does 'payload' mean, in **http**, what this repo decided it means?"*

rfc 9110 calls it the *"payload body"*. aws calls the whole message `Payload`. the repo had adopted
**aws's** sense inside an **http** family — and the drive had spent three rounds on a term
(`request`) that was reachable only while `event` stayed narrowed to the body.

⇒ **B and C would have deferred the etymology section past the point where the shape was settled.**
the enbrief would then have documented a wrong vocabulary faithfully, which is the failure mode the
rule exists to prevent and the one the deferral options could not see.

## rework, and why clean

**clean.** three markdown files and a readme. no code, no contract, no test. to reverse A is to
delete a directory; to switch to B is to move it. neither ripples.

## 🔴 the one substantive call inside A — the sqs/sns bound, and how it INVERTED

the wisher asked, separately: *"in the future when we support sqs or sns, will `request` make
sense there?"*

⛔ ~~it will not — so `request` stays fenced inside `genLambdaEndpoint.forApiGateway/` and never
enters a shared type, best-guessed at 92%.~~

🔴 **the answer held and the conclusion inverted.** `request` genuinely does not survive sqs:

- an sqs payload is `{ Records: [ … ] }` — **up to 10 messages per invoke**, so the cardinality
  breaks before the name gets a chance to be wrong
- an sns payload is a notification: no method, no path, no caller that awaits

⇒ the drive read that as *"fence the term"*. the correct read is *"the term is wrong"*:

| the move | what it costs |
|---|---|
| ⛔ fence `request` inside one directory | an **invariant** to write, enforce, and remember — plus a field name that exists in one family and in none of its peers |
| ✅ **use `event`, which needs no fence** | naught. aws calls every trigger's object an event, and every one has a body |

🔴 **a name that needs a fence is a name in the wrong place.** the fence was the tell, and this
entry priced it at 92% rather than read it as evidence. ⇒ the sqs question the wisher asked was the
**second** signal that `request` was wrong, and the drive answered it correctly and concluded
wrongly (`rule.require.review-attempts-deletion` — *"which of my constraints guards a case that
cannot occur?"*).

## where

- `1.vision.yield.md` → the deliverables list
- `.agent/repo=.this/role=any/briefs/domain.terms/` → the artifacts
- F01 (the name), F03 (the collision), F08 (the key-case hazard) each feed one brief

## the verdict, once ruled

🔴 **RULED — A.** the wisher said *"yes"* and supplied the term list with a per-term reason,
2026-09-20. the sqs/sns bound inside it stays this drive's own call at 92%.
