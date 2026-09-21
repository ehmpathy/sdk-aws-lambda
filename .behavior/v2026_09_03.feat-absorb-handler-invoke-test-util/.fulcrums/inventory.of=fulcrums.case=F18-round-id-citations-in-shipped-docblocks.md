# F18 — shipped docblocks NARRATE the drive (chronological accretion), and cite a review round that is never committed

> 🔴 **raised at i022 r010, and it is the SEVENTH round to raise it.** it has been flagged at i009,
> i011, and four rounds since; every one of the six caught a **dream** and not one raised a
> **fulcrum**. ⇒ that asymmetry is the whole reason it returns each round, and it is what this entry
> exists to record.

## 🔴 THIS IS TWO DEFECTS, AND THE LARGER ONE IS A RULE VIOLATION — NOT A CITATION NIT

> re-affirmed at i044 r011 `enroll-impl-arch-defects`: *"it should be named as a rule violation, not
> merely a style preference … a direct instance of this org's **own** `rule.forbid.chronological-accretion`
> and `rule.require.timeless-comments`, not just an F18-style citation-hygiene issue."*

**the charge is correct, and this entry has held it since i033 — but the title read "cite a review
round" alone, so two reviewers re-read the entry as citation-only.** the title now names both. the
split, stated once here so no reviewer has to dig for it:

| half | what it is | the rule it violates | fix |
|---|---|---|---|
| **the VOICE** (the larger) | docblocks written as a **transcript of the drive** — `raised at i0XX`, `probed 2026-09-09`, confidence deltas, *"it read X until iNNN"* | 🔴 `rule.forbid.chronological-accretion` + `rule.require.timeless-comments` — a **blocker-class** rule violation, not a style preference | strip the when/who-found-it, keep the durable why — a per-file sweep, dirty on the 135 extant sites, taken on-touch since i039 |
| **the CITATION** (the smaller) | the pointer's referent (`.reviews/peer/`) is never committed | an unresolvable reference on worktree delete | one line in `bhrain`'s `.gitignore` (branch C) — settles this half only |

⇒ **severity: the VOICE half is a blocker-class rule violation** (`rule.forbid.chronological-accretion`
grades at blocker), deferred on SAFE-✅/CLEAN-🔴 grounds (135 mid-sentence prose edits across 43
files, on the round before verification, `rule.require.review-test-changes` bars the sweep here). the
on-touch mitigation is live (§i039 below); the bulk sweep is owed as its own wish. this is **named as
a rule violation, triaged at blocker, and deferred with a recorded reason** — which is the disposition
r011 asked for.

## 🔴 the scope WIDENED at i033 r011 — this entry named the smaller half

> *"F18 names this narrowly … but the defect is bigger than citations. Nearly every production
> file's docblock is written as a **transcript of the drive**, not a statement of current truth:
> round IDs, confidence deltas, phrases like 'the drive's signature defect, met in a new direction',
> 'caught at self-review r6', 'raised SEVEN times'."*

**the charge holds, and it splits this entry in two.** the two halves take different fixes, and this
entry had conflated them:

| half | what it is | does branch C fix it? |
|---|---|---|
| **the CITATION** — `raised at i011 r010` | a pointer whose referent is never committed | ✅ **yes, for free.** commit the trail and all 140 point somewhere |
| **the VOICE** — the docblock written as a transcript | `rule.forbid.chronological-accretion`, straight | 🔴 **no. not at all** |

⇒ **so branch C was never a complete answer**, and this entry read as though it were. a comment that
says *"it read as a bare statement until i011 r010, which named two costs"* is chronological
accretion whether or not that round is committed — the durable fact is the two costs, and the round
is the transcript.

### what was DONE at i033, and what is still deferred

the reviewer named four files as the worst cases. all four are repaired — **zero round IDs, zero
drive-transcript voice** in any of them, and `onSerialized.ts` alone lost seven blocks of *"it once
read X"* narration:

| file | verdict |
|---|---|
| `runLambdaEndpoint.onSerialized.ts` | ✅ swept — 7 blocks rewritten to current truth |
| `runLambdaEndpoint.onReferenced.ts` | ✅ swept |
| `dialect/asLambdaEndpointOutput.ts` | ✅ swept |
| `guard/assertEventIsGiven.ts` | ✅ swept — a whole self-grading section cut |

### five more at i034 — and the rule that selected them is worth the record

a second arch lane caught two the i033 sweep had missed, and three more rode along:

| file | how it was reached |
|---|---|
| `asLambdaEvent.fromSns.ts` | 🔍 **named by the reviewer** — cited *"r7 swept"*, *"r8 derived"* |
| `asLambdaEvent.fromS3.ts` | 🔍 **named by the reviewer** — cited *"self-review r5"*, plus a past-tense drift |
| `serde/asWirePayload.ts` | 🚗 rode along — the file was already open for the `[case4]` clamp |
| `serde/asWirePayload.test.ts` | 🚗 rode along — same |
| `lambdaEndpointWire/getParsedResponse.ts` | 🚗 rode along — already open for its header repair |

🔴 **the two the reviewer named POST-DATE the i033 sweep**, which is the charge's sharpest clause:
*"backlog growth outpaces the work."* confirmed — the factories were written after the four head
files were repaired, and they were written in the same transcript voice.

⇒ **so the deferral has a cost that compounds**, and the mitigation is the ride-along column: a file
opened for any other reason is swept while it is open, because CLEAN is ✅ for a file already in the
diff. that is `rule.always.fix-forward-under-scouts-honor` applied per-file rather than all-or-none.

🟡 **the repairs are COUNTERFACTUALS, never deletions.** a past-tense defect description asserts the
defect is still present; a counterfactual keeps the durable why without that lie:

```ts
// ⚠️ **an ISO STRING here, where sqs sends millis and kinesis sends seconds** —
//    three representations of one instant, across three factories. this is the
//    one a numeric-literal search does not reach, so it is derived from the
//    shared constant rather than written…
```

🟡 **the sweep across the files left is the half still deferred**, on exactly the SAFE/CLEAN
grounds below. what changed is that every file a reviewer has been able to name is out of that
set, so the deferred half is the long tail rather than the head.

## 🔴 the backlog does NOT shrink — re-measured at i037, and the arithmetic inverts

this entry read **"the ~33 files left"** until i037. that figure was never measured — it was
`42 − 9` — and the subtraction assumes the set is closed. it is not.

re-walked with **this entry's own declared command** (`.where` below: same pattern, same `src/**`
glob), so the two figures are directly comparable:

| when | occurrences | files |
|---|---|---|
| first measured, before any sweep | 140 | **42** |
| implied by `42 − 9` after i033 + i034 | — | ~33 |
| **measured at i037** | **135** | **43** |

🔴 **nine files were swept and the file count went UP by one.** five occurrences left the tree in
two sweeps; the rest of the delta is files written since.

⇒ **so the deferral's cost is not "a long tail that waits" — it is a backlog that grows at about
the rate it is worked.** this entry already quoted the charge (*"backlog growth outpaces the
work"*) and then reported a number that contradicted it. the quote was right and the arithmetic
beneath it was wrong.

🟡 **and this drive is still a net contributor, deliberately.** i037 alone added `.note = raised at
i037 r011 nitpick.3` to `getOneHandlerFromServerlessYml.ts` and a `probed at i037` to
`onReferenced.ts` — written in the extant house style, because a lone file in a different style is
a third convention rather than a repair. ⇒ **the practice is what generates the backlog, so a
per-file sweep cannot close it. only branch C or a declared style change can.**

.note = raised at i037 r011 nitpick.5 `enroll-impl-arch-defects`, which called the tracked scope
  *"materially smaller than the actual surface."* the charge understated itself — the surface is not
  merely larger than recorded, it is larger than it was before the sweeps began.

## the fork, stated fairly

comments across the shipped tree carry a citation of the form `raised at i011 r010`, `caught at
self-review r5`, `found at i010 r011` — **140 across 42 files when first walked, 135 across 43 at
i037** (see the re-measurement above; the counts below are quoted at the branch's own scale rather
than re-derived, because the branch cost tracks the ORDER of the number and not its last digit).

| branch | cost |
|---|---|
| **A · strip the round ID, keep the reason** | 140 prose judgments across 42 files. each site embeds the citation mid-sentence, so no sed reaches it — and a bad cut damages prose that is currently correct |
| **B · rewrite each citation to a durable anchor** — the rule, or the drive name | the same 140 edits, plus a judgment per site about which anchor is right |
| **C · make the referent durable** — commit the review trail | **one line**, and all 140 resolve. ⚠️ the line is `bhrain`'s, never this repo's |

## 🔴 what SIX rounds got wrong, and the read that corrects it

every prior deferral reasoned from the dream's stated premise:

> *"once `.behavior/` is archived, these become unresolvable references"*

**that premise is false.** walked against `origin/main` on 2026-09-11:

| what | state on main |
|---|---|
| `.behavior/` | ✅ **committed** — five prior drives live there |
| a drive's wish, vision yield, execution yield, guards, stones | ✅ **committed** |
| a drive's `.reviews/peer/` | ✅ committed, and it holds **one** file: a `.gitignore` whose body is `*` |

⇒ **`.behavior/` is never archived. the review trail is never COMMITTED** — it is born ignored and
dies with the worktree.

🔴 **which makes the defect worse than six rounds priced it, on two counts:**

1. the referent dangles **the moment this worktree is deleted** — the normal end of a drive — never
   at some future prune
2. **a citation to a yield is durable; a citation to a round is not**, and the two read identically
   in a docblock. so the practice is not uniformly bad — it is bad on exactly one axis

## taken, and why

**branch C, escalated — and the SCOPED half of A declined.**

the two questions of `rule.always.fix-forward-under-scouts-honor`, answered honestly:

| question | answer |
|---|---|
| **SAFE?** | ✅ comment-only. zero behavior, on every one of the 140 |
| **CLEAN?** | 🔴 **no.** 140 mid-sentence prose judgments across 42 files, on the round before `5.3.verification`. it invalidates every cached clean reviewer hash and forces a full re-review that grades no behavior change |

⇒ the rule's own table puts `safe ✅ / clean 🔴` at **"defer — and raise a fulcrum. the dirt is the
reason, and the reason is what the council reads."**

🔴 **so the six prior rounds reached the right VERDICT by the wrong ROUTE, and skipped the half that
would have ended it.** each caught a dream, which records the *work*. none raised a fulcrum, which
records the *call*. ⇒ **a call nobody recorded is a call nobody can overrule**, so the next reviewer
met an undecided item and raised it again — six times.

## rework

**clean, and cheaply so — on branch C.** one line of one `.gitignore` in `bhrain`'s route skills,
and 140 source files need no edit at all.

⚠️ **dirty on A and B**, and that asymmetry is the argument: the expensive branches touch 42 files
of this repo; the cheap one touches one line of another. a council that rules A or B buys a sweep it
could have had for free.

## confidence, and why 88%

high on the **measurement** — `git ls-tree origin/main` and the committed `.gitignore` are direct
reads, and either settles in one command.

short of 93% on the **verdict**, for one reason: branch C commits ~60 files of review prose per
drive to the repo, and i have not priced that. a maintainer who cares about repo size may prefer A's
sweep precisely *because* it costs source churn rather than permanent bytes. i judge the trade
clearly favorable — a review trail is the evidence under every claim in the yield, and a yield whose
evidence is deleted is a claim on trust — but the cost is real and it is not mine to spend.

## where

- **135 sites across 43 files, measured 2026-09-12** (140/42 when first walked) —
  `rhx grepsafe --pattern '\bi0\d\d\b|\bself-review r\d|\br0\d\d\b' --glob 'src/**'`
  ⇒ re-run this before you quote a number from this entry. it moved twice already, and it moved
    UP, so a stale quote understates the ask rather than overstates it.
- `.behavior/<drive>/.reviews/peer/.gitignore` — the one line, on `bhrain`'s side
- `.dream/v2026_09_10.repair.review-trail-citations-outlive-their-referent.md` — the dream, now
  with the measurement and the corrected premise

## the verdict

🪘 **open — and it is the one row on this board whose cheapest fix lives in another repo.**

the ask is one sentence: **may the review trail be committed?**

- **yes** → one line in `bhrain`, and every citation in every drive points somewhere forever. zero
  source edits
- **no** → then branch A is owed, as its own wish rather than smuggled into this stone, because 140
  mid-sentence prose edits on the round before verification is the change
  `rule.require.review-test-changes` blocks outright

🔴 **and a `yes` settles the CITATION half only.** the VOICE half — a docblock that narrates the
drive rather than states what is — is owed on either answer, because it is
`rule.forbid.chronological-accretion` rather than a dangling pointer. it is the same 38-file sweep
and the same SAFE/CLEAN verdict, so it rides the same wish.

---

## 🔴 i039 r011 — the deferral was read as a LICENCE, and the driver is who read it that way

the arch lane raised this as a blocker, with a clause this entry could not answer:

> *"the 'voice' half needs **no bhrain change** — it's fixable today, incrementally, on touch, per
> this repo's own `rule.prefer.wickup-touched-prose`. Treating it as blocked on an external repo
> change conflates the two halves."*

⚠️ **half of that is refuted above** — the section two headers up splits citation from voice and
says outright that the voice half *"is owed on either answer."* the entry does not conflate them.

🔴 **the other half lands, hard.** the entry declares a ride-along mitigation at i034 — *"a file
opened for any other reason is swept while it is open, because CLEAN is ✅ for a file already in the
diff"* — and **the driver did not apply it.** on the i038 round, four files were held open for
unrelated repairs and **every one gained NEW transcript prose**:

| file | why it was open | what was written into it |
|---|---|---|
| `serde/asUnprefixedErrorMessage.ts` | the live regex defect | `.note = found at i038 r011 …, which observed that every test here` |
| `error/throwIfCredentialsError.ts` | the over-broad message arm | `.note = raised at i038 r011 …` |
| `local/getOneHandlerFromServerlessYml.integration.test.ts` | the memo key + the flake | *"this assertion read `expect(elapsedMs).toBeLessThan(2)` … ⇒ it flaked at 4.80 ms"* |
| `domain.objects/AwsIdentitySynthetic.ts` | 🔴 **a NEW file** | a three-strike table of which round found which duplicate |

⇒ **the last row has no defense.** a ride-along cannot be owed on a file that did not exist; the
voice was chosen for it from its first line. a sweep of the extant 135 is dirty, and **the 136th is
free to not write.**

### so the trend is not weather — it is authorship

the entry records the trend as a measurement (*140/42 → 135/43* — fewer citations, more files) and
reads it as backlog growth. **the mechanism is narrower and wholly within the driver's reach**: each
sweep strips citations from old files while each round writes fresh ones into new files, so the
count falls as the file count rises. the sweeps work; the tap is open.

### ✅ what this changes, at zero cost and with no council

| the half | status |
|---|---|
| the 135 extant sites | ⬜ **unchanged** — still dirty, still `rule.require.review-test-changes`, still owed as its own wish |
| a file already open for another repair | ✅ swept while open — the i034 ride-along, now actually honored |
| **a docblock written from here on** | ✅ **states current truth. no round id, no confidence delta, no "it read X until iNNN"** |

🟡 **the durable half is kept, which is what makes the change affordable.** *"the emoji is OPTIONAL,
and a pattern that required it was a live defect"* is a fact a future editor needs, and it carries no
round. what goes is the provenance sentence beside it — and the provenance already lives in
`.reviews/peer/`, the artifact built to hold it (`rule.require.archaeology-in-notes`).

⇒ **it is not a new branch and it does not move the rework grade.** it is this entry's own i034
mitigation, honored — and the reviewer was right that nobody had honored it.
