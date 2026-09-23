# rule.require.survey-the-set-before-the-definite-article

> **"the escape hatch", "the only way", "the fix", "the workaround" — each asserts the set has ONE
> member. survey the set, or write "one of".**

## .what

a definite article over a solution slot is an **absence claim in positive clothes**. *"the escape
hatch is X"* says *"and there is no other"* — a claim about a whole set, made with no negative word
in the sentence.

`rule.require.positive-control-before-absence-claims` already governs that claim. every cue it
lists is an **explicit negative** — *"no X exists"*, *"not one test asserts Y"*, *"I searched and
found none"* — so a reader who applies it diligently looks straight past a sentence that contains
none of them. that is `rule.require.specialize-a-rule-its-readers-look-past`'s exact trigger.

## .why

measured on this stone: a yield carried a section headed **"the escape hatch, measured rather than
asserted"**, and the measurement under it was sound — `.refine()` really does land a caller fault,
with the consumer's message verbatim.

**the sentence around it was not.** `.refine()` is one of **two** hatches, and it is the weaker
one: it cannot reshape, so it is no substitute for the usecase the whole wish existed to serve. the
stronger one — `ctx.addIssue` + `z.NEVER` — is the mechanism the sdk's own headline feature uses
internally, and no record said a consumer may reach for it too.

the mechanism of the failure is specific, and it is not carelessness:

- I ran the alternative **I already held**
- a run beats an assertion, so the result read as rigor
- ⇒ **the measurement confirmed my model rather than mapped the space.** a run of ONE candidate
  still reads as a survey, because the artifact it produces is identical to a survey's

and the cost compounds past the yield. the claim propagated into a fulcrum's fork table as *"this
repo declares no such vocabulary"* — which set a `dirty` rework grade, reserved a wisher call, and
deferred a repair that was **never owed**. ⇒ **one definite article, priced at a deferred fulcrum.**

## .the test — for the proposer

before you write *"the X"* over a solution slot: **how many candidates did I run?**

| what you ran | what you may write |
|---|---|
| the whole set, and it has one member | *"the X"* |
| the whole set, and it has several | *"one of N"*, and name the trade between them |
| one candidate | **"one X is …"** — never *"the"* |
| none | you hold a model, never a measurement |

the survey is cheap, and its cost is flat: **list the candidates first, then run them in one pass.**
four rows in one probe file cost the same permission wait as one row, and the row that moves the
verdict is rarely the row you would have run alone.

⚠️ **the candidate you would reach for first is the one least likely to close the set.** it is the
one your model already holds, so its result confirms rather than maps. a survey earns its name by
the candidates you had to think of.

## .the test — for the reviewer

grep the diff for a definite article over a solution: **the fix · the escape hatch · the only way ·
the workaround · the alternative · the approach**. for each, ask *"what proves the set has one
member?"*

the tells:

- a section headed *"measured rather than asserted"* whose measurement covers **one** candidate —
  the header is the camouflage, since a real run did happen
- a fork table whose `against` column asserts an **absence** of vocabulary, affordance, or
  precedent, with no command beside it
- the named candidate is the one a reader would guess the author reached for first
- a **dependency's** surface described by one member — a vendor usually ships several, and the
  `.d.ts` is one read away

## .the caveat

- **a set with one member is a real answer.** write *"the X"* once you have walked it, and say what
  you walked
- **a definite article over a NOUN is fine** — *"the handler"*, *"the wire shape"*. this fires on a
  definite article over a **choice**, where a second option could exist
- **a survey need not be exhaustive to be honest** — *"of the three forms I ran, X is the strongest"*
  is a claim a reader can check and extend. *"the"* is not

## .enforcement

- a definite article over a solution slot, with one candidate run = **blocker**
- a fork table whose `against` column asserts an absence of vocabulary or affordance, with no
  command recorded = **blocker** (`rule.require.positive-control-before-absence-claims`, at the
  option-set grain)
- a section headed *"measured"* whose measurement covers one candidate = **blocker**
- *"one of N"* with the trade named = false positive (that is this rule satisfied)
- a definite article over a noun rather than over a choice = false positive

## .see also

- `rule.require.positive-control-before-absence-claims` — the parent. this names the form its cue
  list cannot reach: an absence claim with no negative word in it
- `rule.require.measure-the-value-you-emit` — the same family; there the false source is a vendor's
  type, here it is the author's own option set
- `rule.require.retest-the-model-on-every-family` — the peer at model grain: derived from one
  consumer, applied to two
- `rule.require.review-attempts-deletion` — *"how many candidates did I run?"* is a deletion question
- `rule.require.specialize-a-rule-its-readers-look-past` — why the parent needed this specialization
