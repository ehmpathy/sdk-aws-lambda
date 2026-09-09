# rule.require.review-attempts-deletion

## .what

a self-review must attempt to **delete** the design, not confirm it. each round names the one
claim the design rests on, states what would make that claim fall, then goes and tries to make it
fall.

## .why

four thorough self-reviews on one artifact produced 28 findings and missed the four defects that
mattered most: a needless peer export, a name that mashed two dimensions, an invented
requirement, and an optional field that forked two code paths. all four fell in seconds to a
reader who asked a different question.

the reviews **verified**. each read a claim and checked it held. every check passed, so the design
looked sound — while its **shape** was wrong. a verification review cannot find a shape defect,
because the shape is the frame the review works inside. it audits the rooms and never asks whether
the house belongs on this lot.

a deletion review asks the opposite: **what would have to be true for this whole approach to be
the wrong one?** that question reaches the frame.

## .the test — for a review of your own work

each round, before you read a line:

1. **name the claim the design rests on** — the one whose fall re-shapes the answer, not one
   whose fall edits a paragraph
2. **state what would make it fall** — a concrete, checkable condition
3. **go try to make it fall** — read the code, run the probe, count the call sites
4. **if it holds, say why in one line, then move to the next claim**

a round that ends with every claim confirmed and no claim attacked did not review.

## .the deletion questions

ask these of the design, not of its prose:

- **could this be zero exports instead of one?** does an extant seam already carry it?
- **could this be one export instead of two?** (`rule.require.widen-before-parallel`)
- **which requirement here did the wish not ask for?** the wish's `.acceptance` is the list;
  each demand you add must trace to a line, or be marked as your own proposal and justified
- **which of my own choices did i justify by convenience?** convenience never pays for a code
  path (`rule.require.explicit-optout`)
- **what does the wish flag as an open question, and did i answer it out loud or silently?** a
  silent answer to a flagged question is the defect the wisher most needs to see
- **what would a reader who never saw my notes read this name as?**
  (`rule.forbid.names-that-mash-dimensions`)
- **which claim did i infer from a read, where a run would settle it?** verify the claim whose
  fall would invert the proposal, not the ones that confirm it

## .the tells that a review only verified

- every finding edits prose; none moves a boundary
- the finding count is high and the design is unchanged
- no fulcrum was **dissolved** — only settled. a dissolved fulcrum is the signature of a shape
  found wrong, so a review with none has likely stayed inside the frame
- each fulcrum is a two-option fork ("A vs B") with no "neither" row

## .the caveat

a deletion review is not a demand to re-open a settled shape every round. once a claim has been
attacked and held, cite the round that attacked it and move on. the mandate is that **each claim
the design rests on is attacked once, on the record** — not that every round re-litigates.

nor does a review that finds no shape defect fail this rule. a review that **tried** and found
the shape sound satisfies it; a review that never tried does not, however many findings it
returns.

## .enforcement

- a self-review round with no attempt on a claim the design rests on = **blocker**
- a review that raises an "A vs B" fulcrum with no "neither" option = **blocker**
- a review that confirms every claim and attacks none = **blocker** (it did not review)
- a review that attacked the shape and found it sound = false positive

## .see also

- `rule.require.widen-before-parallel` — "one export instead of two?" is a deletion question
- `rule.require.explicit-optout` — "justified by convenience?" is a deletion question
- `rule.forbid.names-that-mash-dimensions` — "what would a stranger read this as?" is a deletion question
- `rule.require.trust-but-verify` (mechanic) — verify inherited claims, above all your own
- `philosophy.verification-strictness` (behaver) — an unproven claim is a guess
