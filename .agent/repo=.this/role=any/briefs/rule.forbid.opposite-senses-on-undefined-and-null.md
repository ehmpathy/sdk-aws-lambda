# rule.forbid.opposite-senses-on-undefined-and-null

## .what

never assign **opposite senses** to `undefined` and `null` in the same union. they are the
most confusable pair of values in the language, so the two states that differ most in *sense*
must differ most in *form*.

```ts
// 👎 absent and off are inverses, expressed as the confusable pair
input?: Translator<TFrom, TInto> | null;
//   undefined -> the default translator RUNS
//   null      -> no translator runs        <- the inverse, one keystroke away

// 👍 the off-state differs maximally in form from the absent-state
input?: Translator<TFrom, TInto> | false;
```

this is not a ban on tri-states. a tri-state is often the right contract. it is a rule about
**which sentinel** carries the third state.

## .why

`undefined` and `null` are near-synonyms in form and in every idiom that touches them:

- **`??` and `?.` flatten the pair.** `member ?? theDefault` treats an explicit off exactly
  as it treats an omission — a silent inversion of the caller's intent.
- **truthiness flattens the pair.** `if (!member)` collapses absent into off.
- **the reader flattens the pair.** a maintainer who remembers "one of them means off" has a
  50% chance of the inverse, and the wrong guess is silent.
- **a `== null` check catches both**, so a lint-clean codebase can still lose the distinction.

when the two senses are merely *different* (absent = "not supplied", null = "supplied as
empty"), the pair is survivable. when they are **inverses** — one arms a guarantee and the
other disarms it — a single confusion produces the exact opposite behavior, and no signal
fires.

`false`, `0`, or a string literal share none of that machinery with `undefined`. the form
difference carries the sense difference.

## .the test — for the proposer

when a union needs a third state, ask both:

1. **"is the third state the INVERSE of absence, or merely a different value?"**
   - inverse (absent arms it, this disarms it) → **the sentinel must not be `null`**
   - merely different → `null` is acceptable
2. **"which extant sense does this repo give `null` versus `false`?"** grep before you choose.
   most repos settle into a grain — `null` for an absent value, `false` for a switch that is
   off — and the sentinel should follow it.

then check the collapse site: if the code that reads the union would naturally be written
`member ?? theDefault` or `if (!member)`, and either of those would be **wrong**, the
sentinel is wrong.

## .the test — for the reviewer

grep every union that holds `null` beside an optional marker — `field?: X | null`. for each,
read what the code does in each of the three states and ask: **"are the absent-arm and the
null-arm inverses of each other?"**

if they are, the sentinel is the defect, whatever else the contract gets right.

the tells:

- a doc-comment that must **spell out** which of `undefined` / `null` means which, in
  capitals or with a caution — the prose is a confession that the form does not carry it
- a `=== null` or `!== undefined` **strict** comparison at the read site, where the codebase
  elsewhere uses `??`. the strictness is evidence of the load: the author knew the shorthand
  would break
- a union where the absent state is described as "on", "default", "enabled", and the null
  state as "off", "skip", "disabled"
- an appeal to `rule.forbid.undefined-inputs` as a **licensed exception** without any argument
  about the sentinel. that rule permits a declared third state; it says not one word about
  which value should carry it

## .the caveat

- **this does not forbid `X | null`.** a nullable that denotes an absent value is the repo's
  own grain (`rule.forbid.undefined-inputs` prefers `null` over absent, precisely so the
  caller must supply it). the rule fires only when `null` and `undefined` are both reachable
  **and** carry inverse senses.
- **it does not forbid tri-states.** `absent | off | value` is a legitimate contract. pick a
  sentinel that reads as "off".
- **`false` is not always the right sentinel.** where the third state is not boolean in
  character, a string literal reads better — `'inherit'`, `'none'`, `'passthrough'`. the
  mandate is distinctness from `undefined`, not `false` specifically.
- **a two-state union needs no rule.** `X | null` with no optional marker has no `undefined`
  to confuse.

## .examples

### 👎 bad — the doc-comment carries what the form does not

```ts
/**
 * ⚠️ NOTE: `undefined` means the default validator RUNS.
 *          `null` means validation is SKIPPED. do not confuse these.
 */
validate?: Validator<T> | null;

// and the read site cannot use the idiom:
const validate = config.validate === null ? noop : (config.validate ?? theDefault);
// ^ if anyone ever "simplifies" this to `config.validate ?? theDefault`,
//   an explicit skip silently becomes a validate. no test necessarily catches it.
```

### 👍 good — the off-state is unmistakable

```ts
/**
 *   absent   -> the default validator runs
 *   false    -> DISARMED; no validation
 *   function -> yours, in place of the default
 */
validate?: Validator<T> | false;

const validate = config.validate === false ? noop : (config.validate ?? theDefault);
// ^ a `?? theDefault` shorthand is now visibly wrong to a reader,
//   because `false ?? x` is `false`, not `x`.
```

## .enforcement

- `undefined` and `null` given **inverse** senses in one union = **blocker**
- a doc-comment that must caution a reader about which of the pair is which = **blocker** (the
  same defect, seen from the prose side)
- a sentinel choice that contradicts the repo's extant `null`-vs-`false` grain = **nitpick**
- `X | null` where `null` denotes an absent value = false positive (that is the extant grain)
- a tri-state with a distinct sentinel = false positive (that is this rule satisfied)

## .see also

- `rule.forbid.undefined-inputs` (mechanic) — permits a declared third state; this rule says
  which value may carry it
- `rule.forbid.nullable-without-reason` (mechanic) — "off" is a boolean concept, not an
  absence concept, so it owes no nullable
- `rule.require.explicit-optout` — the opt-out must be a **value**; this rule constrains which
  value
- `rule.avoid.constraints-the-state-already-proves` — the peer find from the same tri-state
- `rule.require.ubiqlang` (mechanic) — one form per sense, consistently
