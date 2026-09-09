# rule.require.retest-the-model-on-every-family

## .what

a model you derived from one consumer must be **re-tested against every consumer it claims to
cover**, before it is proposed. and each satellite contract — a schema, a validator, a config —
must name a **point the model declares**, never a field one level inside one.

the two halves are one rule because the second is what makes the first detectable: when a
satellite points at a sub-field, the model and the satellite cannot be lined up, so a mismatch
between them has no visible surface.

## .why

a model derived from one instance encodes that instance's **step count**, silently.

measured on this stone: a four-point pipeline model (`inputBefore → inputAfter → invoke →
outputBefore → outputAfter`) was derived from a family whose input side runs **one** transform.
its peer family runs **two**. so three shapes had to fit two names — and different sections of
the same document picked different pairs. the design stated `inputBefore` as two different types,
in two places, and four self-review passes read past it.

the second half is why:

- a `schema.output` typed as `ZodSchema<TBody>` names the **body**, which is a field inside the
  point `outputBefore`. so a reader who checks `schema` against the model must hold a level-gap in
  their head, and a drift inside that gap is invisible.
- once every satellite names a point, the check is mechanical: read the pair, read the model, see
  whether they match. a contradiction cannot hide in a level no one inspects.

and the cost of the gap is not only documentation. on this stone the same conflation sat in prod
code as `event.body as TInput` — an `as`-cast that asserts the relation the model should have
derived (`rule.forbid.as-cast`). **the defect and its fix both sat inside the one line the model
could not name.**

## .the test — for the proposer

before you propose any shared model — a pipeline, a lifecycle, a state machine, a set of named
stages:

1. **list every consumer that must bind it.** not the one you had in mind; all of them.
2. **for each, count the steps it actually runs.** read the code, do not infer from the peer.
3. **if the counts differ, the model is wrong until you say which steps it names.** the usual
   resolution: a model names the boundaries a **consumer can hook**, and a default
   implementation's internal steps are not points. say that out loud rather than let each bind
   site decide.
4. **then check every satellite contract points at a named point**, not into one.

the shortcut tell: **you wrote the model while you had one example open.** that alone requires
step 2 before you propose it.

## .the test — for the reviewer

**grep one term across every section, and check it denotes the same type each time.** a shared
model is stated more than once — in a declaration, in a bind site, in a diagram, in prose. take
its most load-bearing member and read every occurrence.

- same type everywhere → the model held
- two types → the model does not fit one of its consumers, and the contradiction is the symptom

then, for each satellite: **does it name a member of the model, or a field inside one?** a
sub-field satellite is a blocker on its own, because it disables the check above.

the tells:

- a model with **N** named stages, and a consumer whose code plainly runs **N+1** transforms
- prose that reconciles a bind site with an aside ("for family X the same holds, which is why its
  `foo` is actually Y") — a reconciliation is a confession that the model does not fit
- a satellite typed one level below the model (`ZodSchema<TBody>` where the point is the envelope)
- an `as`-cast at the seam the model is supposed to describe. the cast is the model's absent edge,
  asserted by hand
- **a bound pair whose two members hold the same type at every bind site.** see below — this one
  has a specific remedy, and the obvious remedy is the wrong one

## .the collapsed pair — suspect the bind, never the member

when a model names two adjacent points and **every** consumer binds them to one type, the model is
wrong. that much is the tell above. but there are two ways to fix it, and they are not
symmetric:

| the fix | what it assumes | when it is right |
|---|---|---|
| **re-bind** one member to the type it actually holds | the pair is real; one bind was lazy | almost always |
| **delete** a member | the pair was invented; the domain has one point there | rarely — and only after the re-bind is tried |

reach for the re-bind first, and reach for `unknown` before you reach for deletion. **a member
that holds a value the domain plainly has must keep its name even where a consumer cannot type it
precisely** — an imprecise bind (`unknown`, an envelope with opaque contents) still holds the
term, and a held term is the whole point of a structural bind.

measured on this stone: a pipeline model bound `outputBefore` and `outputAfter` **both** to the
handler's response type. the collapse was real. the first fix deleted `outputAfter` — and thereby
deleted the only name for *the value the entire work existed to control*, the bytes on the wire. the
correct fix was one line: bind `outputAfter` to the post-encode shape, whose body is a `string`
rather than the domain type. the pair then differed, the slot constrained a real transform, and the
sdk-owned step it straddled turned out to be a **replaceable default** rather than a fixed stage.

**the diagnostic question:** *"if I cannot type this precisely, can I still name it?"* if yes, the
member stays. a model that cannot say "the bytes on the wire" is not a smaller model — it is a model
that lacks the term its consumers most need.

## .the caveat

- **a model need not name every step.** it should name the boundaries a consumer can act on, and
  say so. the defect is an **unstated** choice about which steps count, not a small model.
- **a satellite may legitimately describe a sub-shape** where that sub-shape is itself a declared
  point. the rule is that every satellite names a value the model declares, not that every
  satellite names the outermost value.
- **two consumers may bind the same member to the same type.** redundancy in a bind is not a
  defect; it is often what makes a distinction visible.
- **one consumer may bind a PAIR to the same type, where its own domain says so.** the collapsed-pair
  tell fires on *every* consumer, never one. a family whose response genuinely **is** its wire payload
  binds `outputBefore` and `outputAfter` identically and is correct to; a family that must encode
  binds them differently. document the identity at the bind site, else a reader reads it as the defect.

## .examples

### 👎 bad — a model derived from one family, and a satellite one level below it

```ts
// derived from the family whose input side runs ONE transform
interface Shapes { inputBefore: unknown; inputAfter: unknown; /* ... */ }

// family A (one transform) — fits
{ inputBefore: WrappedPayload<TInput>; inputAfter: TInput }

// family B (TWO transforms: unify, then body-extract) — does not fit,
// so section 1 wrote this...
{ inputBefore: RawEvent;     inputAfter: UnifiedEvent }
// ...and section 2 wrote this, and both shipped:
{ inputBefore: UnifiedEvent; inputAfter: TInput }

schema: { output: ZodSchema<TBody> }   // names a FIELD inside outputBefore
//                                     ^ so no reader can check schema against the model
```

### 👍 good — the model states what it names, and every satellite names a point

```ts
/**
 * .note = these are the boundaries a CONSUMER can hook. a default translator's
 *         internal steps are not points here — family B's unify is a step inside
 *         its default translator, not a member of this interface.
 */
interface Shapes { inputBefore: unknown; inputAfter: unknown; /* ... */ }

// both families now bind identically
{ inputBefore: RawEvent; inputAfter: TInput }

schema: {
  input: ZodSchema<Shapes['inputAfter']>;    // names a point
  output: ZodSchema<Shapes['outputAfter']>;  // names a point
}
```

## .enforcement

- a shared model proposed without a per-consumer step count = **blocker**
- one member of a model stated as two different types in one document = **blocker**
- a satellite contract (schema, validator, guard) typed one level inside a model point = **blocker**
- a bound pair that holds one type at **every** bind site = **blocker** (re-bind it; see the
  collapsed-pair section)
- a model member **deleted** to settle a collapsed pair, with no recorded attempt to re-bind it or
  to hold it as `unknown` = **blocker** (a deleted term costs every later reader; a loose bind costs
  no one)
- prose that reconciles a bind site with the model, instead of the model that fits = **nitpick**
- a model that names a subset of steps, and says which subset = false positive
- two consumers that bind one member to the same type = false positive
- one consumer that binds a pair identically because its domain says so, and documents it = false
  positive

## .see also

- `rule.forbid.ungrounded-type-params` — the structural-bind companion; a bind cannot hold a
  vocabulary the model gets wrong
- `rule.require.widen-before-parallel` — the same failure at contract grain: a design derived
  from one case, applied to two
- ⚖️ **`rule.prefer.wet-over-dry` (mechanic) — the COUNTERWEIGHT to read with care here.** it
  rightly prunes a slot no consumer has asked for — and on the case that produced this rule it
  prompted the **deletion of a domain term** whose evidence surfaced one minute later. prune a
  *slot*, never a *name*: a name costs one line, and its absence costs every later reader.
- `rule.forbid.as-cast` (mechanic) — an `as`-cast at a seam is the model's absent edge
- `rule.require.review-attempts-deletion` — "which claim did i verify against only one consumer?"
  is a deletion question
- `rule.require.trust-but-verify` (mechanic) — above all, verify your own inherited model
