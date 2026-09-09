# rule.avoid.constraints-the-state-already-proves

## .what

do not add a type-level constraint for an invariant that a **state makes true by
construction**. when a value's own state is the proof, a constraint restates the proof at
real ceremony and buys no guarantee.

this is the **counterweight** to `rule.require.illegal-states-unrepresentable`. that rule
says "hold the cardinality in the type so the compiler refuses the illegal value." this one
bounds it: hold in the type what the type must hold, and no more. together they name the two
ways a proposal gets this wrong — a hole left open, and a hole invented.

## .why

a redundant constraint costs more than the keystrokes:

- **it asserts a hole that does not exist.** the prose that justifies it ("the compiler
  cannot verify X") reads as a real gap, so a reviewer weighs a tradeoff that was never on
  the table, and a later reader trusts the claim.
- **it hides the reason the code is already safe.** the state was the proof. once a
  constraint sits on top, the next maintainer reads the constraint as load-bearing and
  cannot delete it without fear.
- **conditional types are the usual form, and they are the expensive form.** they degrade
  error messages, resist inference, and demand a decode from every reader of the
  declaration.

measured on this stone: a proposal flagged as a hole that the compiler could not verify
`inputAfter` equals `inputBefore` when a translate member is off. but the off-state denotes *no
translate runs*, so the shape that lands **is** the shape the handler sees. the equality
was not unverified — it was **definitional**. the proposed conditional type would have
restated a tautology.

## .the test — for the proposer

before you add a constraint, ask: **"in the state where this could be violated, what would
have to happen for the violation to occur?"**

| answer | verdict |
|---|---|
| a step would have to run that this state says does not run | **no constraint** — the state is the proof |
| a caller could supply the wrong value, and no layer would object | constrain it |
| a caller could supply the wrong value, and a **loud** check objects at the boundary | leave it to the check (see the ladder below) |

then check the second axis — **is the failure silent?** `rule.prefer.prevent-over-correct`
puts a type at the top of its ladder, but the ladder exists to close **silent** failures. a
mismatch that throws with the field named is already on a fine rung.

## .the test — for the reviewer

find every prose sentence of the form "the compiler cannot verify …" or "this is a hole
because …". for each, ask two questions:

1. **is the invariant definitional in the state named?** if the state's own sense makes
   the invariant true, the sentence is false and the constraint is noise.
2. **if a caller can violate it, does any layer fail loud?** if a validation, an assure, or a
   guard already names the field, the constraint buys a compile-time echo of a runtime error
   that was never silent.

the tells:

- a **conditional type** whose only job is to relate two parameters that a documented state
  already relates
- a `never` or a mapped type introduced beside a prose paragraph that explains why it is
  needed — a discovered constraint needs no essay
- a constraint that fires only in the state where the code does the **least** work (a
  passthrough, an identity, a no-op). those are exactly the states where invariants hold by
  construction

## .the caveat

- **this does not soften `illegal-states-unrepresentable`.** where `{}` is meaningless, or a
  cardinality is real, the type must hold it. the difference is whether a **state** already
  supplies the proof.
- **a state must actually say it.** "it happens to be true today" is not construction; it is
  a coincidence, and a coincidence needs a constraint. the state must *denote* the invariant —
  documented, in the type's own vocabulary.
- **a comment is the cheap alternative, and often the right one.** where the reader might
  wonder, one line at the declaration ("`false` = no translate runs, so the two shapes are one
  value") costs a sentence and closes the question.

## .examples

### 👎 bad — a conditional type that restates what the off-state denotes

```ts
// prose: "the compiler cannot verify inputAfter equals inputBefore when input is off"
export interface Translate<TShapes extends LambdaEndpointShapes> {
  payload?: {
    input?:
      | Translator<TShapes['inputBefore'], TShapes['inputAfter']>
      | (TShapes['inputAfter'] extends TShapes['inputBefore'] ? false : never);
    //  ^ the off-state denotes NO translate, so the two are one value.
    //    the constraint proves a tautology, and degrades every mismatch error.
  };
}
```

### 👍 good — the state carries the proof, a comment carries the reader

```ts
/**
 * .note = each payload member is TRI-STATE — three states, three senses:
 *
 *   absent   -> the family's default translator runs
 *   false    -> DISARMED; no translate, so the shape passes through untouched
 *               (the shape that lands IS the shape the handler sees)
 *   function -> yours, in place of the default
 */
export interface Translate<TShapes extends LambdaEndpointShapes> {
  payload?: {
    input?: Translator<TShapes['inputBefore'], TShapes['inputAfter']> | false;
    output?: Translator<TShapes['outputBefore'], TShapes['outputAfter']> | false;
  };
}
// a caller who disarms and then declares a mismatched schema fails loud at
// validation, with the field named — never silently.
```

## .enforcement

- a type-level constraint for an invariant a documented state makes true = **nitpick**
- prose that claims a hole the state's own sense closes = **blocker** (the claim misleads
  every later reader, whether or not the constraint ships)
- a constraint for a violation that a boundary check already catches loudly = **nitpick**
- a constraint for a real, silently-violable invariant = false positive (that is
  `illegal-states-unrepresentable`, and it should ship)

## .see also

- `rule.require.illegal-states-unrepresentable` — the rule this bounds; hold real cardinality
  in the type
- `rule.prefer.prevent-over-correct` (ergonomist) — the ladder; its top rung is for **silent**
  failures
- `rule.require.failfast` (mechanic) — the loud boundary check that makes a constraint
  unnecessary
- `rule.require.review-attempts-deletion` — "which of my constraints guards a case that cannot
  occur?" is a deletion question
