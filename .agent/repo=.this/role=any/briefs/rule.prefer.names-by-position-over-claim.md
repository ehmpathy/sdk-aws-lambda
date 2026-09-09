# rule.prefer.names-by-position-over-claim

## .what

when a value sits at a known point in a pipeline, and every candidate name makes a
**contestable claim** about what the value *is*, name its **position** instead.

```ts
// 👎 each name asserts a property of the value, and each assertion is arguable
payloadInput / payloadOutput      // "payload" is true only by one vendor's convention
inputSerial / outputSerial        // false — the runtime already parsed the envelope
inputRaw    / outputRaw           // "raw" names a quality, not a value

// 👍 the name states where it sits; no assertion is owed
inputBefore  // before the input translator
inputAfter   // after  the input translator
outputBefore // before the output translator
outputAfter  // after  the output translator
```

## .why

a name that asserts a property inherits that property's fragility:

- **the assertion can be false, and often is.** `Serialized` said the value was bytes when
  the runtime had already parsed it. the name shipped a factual error into the vocabulary.
- **the assertion can be true only by convention.** `payload` is accurate for AWS because AWS
  chose the word; for a different trigger the same slot holds a queue record, an http event,
  a cron tick. the name binds the abstraction to one vendor.
- **the assertion decays with the implementation.** add a decode step and `Raw` is no longer
  raw. the position never moves: whatever runs before the translator is what `before` names.
- **an assertion invites debate; a position ends it.** three drafts and three families of
  names were spent on one slot, and the argument was never about the slot — it was about
  which property to assert.

a positional name is **unfalsifiable in the good sense**: it says only what the pipeline
already guarantees.

## .the test — for the proposer

ask, of each candidate name: **"is this a fact about the value, or a fact about the
pipeline?"**

| the name says | verdict |
|---|---|
| a fact about the pipeline (it sits before/after a named step) | ✅ prefer it |
| a fact about the value that is verifiably true, forever, for every consumer | fine |
| a fact about the value that a vendor, a config, or a later step could falsify | **rename to the position** |

and one shortcut tell: **if you have drafted the name three times and each draft was wrong
about the value, the axis is wrong.** stop and name the position.

## .the test — for the reviewer

for each name in a pipeline type, ask: **"what would have to change for this name to become
false?"**

- **no change would** (the position is structural) → good
- **a decode step, a vendor swap, a config flag would** → the name asserts; flag it

a second tell: the proposal **defends** the name with evidence about the value ("`payload` is
already bidirectional in this repo", "the runtime hands us bytes"). a defense of that shape
concedes the name is an assertion — the question is only whether this one happens to hold.

## .the mechanics

- **`[noun][adj]`, never `[adj][noun]`** — `inputBefore`, not `beforeInput`
  (`rule.require.order.noun_adj`, whose own canonical examples are `userbefore` /
  `userafter`). the payoff is autocomplete: type `input` and see every position of it.
- **name the step the position is relative to.** "before" is meaningless alone; "before the
  input translator" is what the doc-comment must say, so a reader knows the axis.
- **expect one wrinkle, and document it.** in a linear pipeline read from the edge inward,
  `before`/`after` alternates which side is "inner" — `inputAfter` and `outputBefore` are the
  two handler-side shapes, while `inputBefore` and `outputAfter` are the two edge-side shapes.
  that is inherent, so the comment carries it.

## .the caveat

- **a value with a real, stable identity keeps its own name.** `Invoice`, `SurfLesson`,
  `LambdaEndpoint` are not positions and must never become `stepTwoValue`. this rule fires
  only where the value is *defined* by its place in a transform chain.
- **position names need a pipeline the reader can see.** if there is no named step to sit
  before or after, the name has no anchor and the rule does not apply.
- **do not stack positions.** `inputBeforeAfterParse` is a confession that the pipeline needs
  another named step, not a longer name.

## .enforcement

- a pipeline-slot name whose assertion about the value is falsifiable by a vendor, a config,
  or a later step = **nitpick**
- a pipeline-slot name that is **factually wrong** about the value it names = **blocker**
- `[adj][noun]` order on a positional name = **nitpick** (`rule.require.order.noun_adj`)
- a domain entity named by position = **blocker** (the inverse defect)

## .see also

- `rule.require.order.noun_adj` (mechanic) — `userbefore` / `userafter`; the prescribed shape
- `rule.forbid.ungrounded-type-params` — the peer rule; a position name must still trace
- `rule.require.ubiqlang` (mechanic) — one canonical word per concept
- `rule.forbid.names-that-mash-dimensions` — the other name rule; shares the "the proposal
  explains the name" tell
