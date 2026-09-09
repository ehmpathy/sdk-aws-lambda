# rule.require.deferred-defect-records-lead-with-status

## .what

when you record a defect you did **not** fix, the record must lead with its **status**, and the
repair must never be stated more prominently than the fact that the repair is unapplied.

the better you describe a repair, the more the record reads as a **changelog** — so a thorough
`.defect` block is more likely to be mistaken for a fix than a thin one.

```ts
// 👎 the repair is the headline; the status is buried
/**
 * ⚠️ .defect = `handler.input` NEVER logs, and the repair is to move `genTrailMiddleware()`
 *              from index 8 to index 3 — directly above this entry
 *              [ …40 lines of correct diagnosis… ]
 * .why left = `main` carries the identical relative order, so this predates the wish
 */

// 👍 the status is the headline, and it names its own proof
/**
 * ⚠️ .defect = LIVE, NOT FIXED — `handler.input` never logs for this family
 * .proof it is live = `[case16][t1]` asserts the log branch does NOT run. that test is GREEN,
 *                     so the defect is present. it goes RED under the repair below
 * .repair, unapplied = move `genTrailMiddleware()` from index 8 to index 3
 *              [ …the same 40 lines… ]
 */
```

## .why

a deferred-defect record is the one artifact whose **content argues against its own conclusion**.
every quality that makes it good — the exact line, the sized repair, the measured blast radius —
is a quality a *completed* fix would also have. so the record's excellence is itself the hazard.

measured on the case that produced this rule: a `.defect` block stated its repair as *"move
`genTrailMiddleware()` from index 8 to index 3"* and recorded the probe (`535 passed, 1 failed`).
a later reviewer cited that comment's **line number** and reported the defect *"fixed … (trail
moved index 8→3)"* — then **approved** partly on that belief. the array was unchanged; two
independent proofs said so. the reviewer met a repair described precisely and took a described fix
for a landed one.

and the cost compounds in the direction that matters least visibly:

- **an approval built on a false premise is worse than a rejection.** the round closed with the
  defect credited as closed, so the next reader inherits a wrong fact from a *review* rather than
  from a comment — one step further from the code.
- **the reader who is most careful is the one most likely to be misled**, because they read the
  comment rather than skim it. a skimmer sees `⚠️ .defect` and stops.
- **no test catches it.** the code is correct, the comment is correct, the suite is green. only a
  direct read of the subject falsifies the claim.

⚠️ **this is the second instance of one class on the same branch**, and the pair is the point:

| what was documented thoroughly | what the thoroughness suppressed |
|---|---|
| one hook-order **axis**, exhaustively | *"is there a second axis?"* — there was, unswept for 15 rounds |
| one deferred **repair**, exhaustively | *"did this land?"* — it had not, and a reviewer said it had |

both share one mechanism: **documentation quality is read as a proxy for the state it describes.**
a well-stated invariant reads as THE invariant; a well-stated repair reads as a DONE repair.

## .the test — for the proposer

after you write a deferred-defect record, read only its **first line** and ask: **"does this tell
me the defect is still live?"**

| the first line says | verdict |
|---|---|
| the defect, plus an explicit LIVE / NOT FIXED / UNAPPLIED | ✅ |
| the defect, then the repair | **reorder — the repair outranks the status** |
| the repair, or the repair's measurement | **reorder — this reads as a changelog** |

then add the one element that makes the status **falsifiable rather than asserted**: name the
clamp, and say which way it points. *"`[case16]` is green, and green means the defect is
present"* cannot be misread, because a reader can run it. *"left in place"* can, because it is a
claim about intent rather than about state.

## .the test — for the reviewer

for every `.defect` / `.hazard` / `TODO` block in the diff, do not read the block — **read the
code it describes.** then ask: **"does the state of the code match the state the block claims?"**

the tells that a block is at risk of a false-fixed read:

- it states a **specific, sized repair** ("move X from index 8 to 3", "add one key", "delete the
  cast") — specificity is the hazard, and it is also what makes the block valuable, so this is a
  prompt to check rather than a defect in itself
- it carries a **probe result** (`535 passed, 1 failed`) with no sentence that states the probe was
  reverted
- the status word appears **after** the diagnosis, or only in a `.why left` at the end
- the block is long enough that the status scrolls off the top

and one structural tell about your own review: **you are about to report a defect as fixed, and
your citation is a comment's line number.** a comment cannot be evidence of its own subject's
state. cite the code, or a test that goes red.

## .the caveat

- **this is not a demand to document less.** the sized repair with its measured blast radius is
  exactly what makes a deferred defect cheap for the next traveler to close. keep every line; move
  the status to the front.
- **a fixed defect's record needs no such care** — a fix is proven by the code and by a green
  clamp, so there is no state to misread.
- **a one-line `TODO` is not at risk** of this failure, because it describes no repair. it is at
  risk of a different one — to be ignored — which is why the thorough block is still the better
  form.

## .enforcement

- a deferred-defect record whose first line states the repair rather than the status = **nitpick**
- a deferred-defect record that carries a probe result with no note that the probe was reverted =
  **blocker** (the measurement reads as a changelog entry)
- a deferred-defect record with no named clamp, or whose clamp's polarity is unstated = **blocker**
  (the status is asserted rather than falsifiable)
- a **review** that reports a defect fixed, where the citation is a comment rather than the code or
  a test = **blocker**
- a thorough record that leads with `NOT FIXED` and names its clamp = false positive (that is this
  rule satisfied)

## .see also

- `rule.require.sweep-the-defect-class` — the twin instance: an invariant stated well on one axis
  reads as THE invariant. same mechanism, at the axis grain
- `rule.require.positive-control-before-absence-claims` — a claim sourced to other than a verified
  observation; here the source is *prose about the fix* rather than the fix
- `rule.require.measure-the-value-you-emit` — the same family: a claim owes a run, never a read of
  a description
- `rule.require.clamp-edge-cases` — the clamp this rule asks you to cite by name, and to state the
  polarity of
- `rule.require.trust-but-verify` (mechanic) — what caught this one; verify an inherited claim even
  when it is good news
- `rule.require.timeless-comments` (mechanic) — a status that reads correctly only within the
  session that wrote it is not timeless
