# F13 — the run output type does not model the strip, and I deferred the repair

- **status** = 🔴 **CLOSED — overruled at peer review r006, and the reviewer was right**
- **rework** = clean
- **confidence** = 78% at the time · **the 22% was where the truth sat**
- **raised** 2026-09-08, self-review r6 of `5.1.execution.from_vision`
- **closed** 2026-09-09, peer review r006 `arch-hazards-maintenance`, blocker.1

## .the fork, stated fairly

`runLambdaEndpoint` JSON-strips the handler's output — a load-bearing guarantee, and `case=4`
exists to teach it. its return type does not model the strip:

```ts
LambdaEndpointRunOutput<TOutput, TDialect> = TOutput | LambdaEndpointErrorEnvelope<TDialect>
//                                           ^^^^^^^ as the HANDLER declares it
```

so a handler typed `{ scheduledAt: Date }` yields a value whose `scheduledAt` is a `string`.

🔴 **it holds on BOTH boundaries and on two independent shapes** — verified at gap 25, after the
first draft of this row asserted the `onSerialized` half with no read behind it:

| shape | declared | delivered |
|---|---|---|
| `Date` | `Date` | `string` |
| **`void`** | `void` | **`null`** — `onSerialized`'s `?? null`, because aws answers `null` for a lambda that returns no value |

⇒ the `void` case matters for the count: a council that weighs *"one `Date` clause"* against *"a
whole mapped type"* should know the defect is not confined to `Date`.

| the fork | |
|---|---|
| **A — repair now** | add `Jsonified<T>`, so the type states what the util returns |
| **B — clamp and defer** | pin the discrepancy with a test, document it, hand the design call to a council |

**I took B.**

## .why B, at the time

1. **the SAFE/CLEAN test decided it, and only one half passed.** it is SAFE — types only. it is not
   CLEAN: it changes the public return type of **both** boundary operations and ripples into every
   test and demo that names an output type. `rule.always.fix-forward-under-scouts-honor` sends a
   dirty fix to a dream, and a dirty *judgment* to a fulcrum.
2. **the hard half is a design decision, not a transcription.** `JSON.stringify` drops a key whose
   value is `undefined`, so a faithful model deletes optional keys — correct, and hostile enough
   that a reader would call it a defect. an unfaithful-but-kind model keeps them. **that call wants
   a council, not a self-review round.**
3. **the discrepancy is pinned rather than trusted to memory.** `[case8][t2]` asserts
   `typeof out.scheduledAt === 'string'` beneath an annotation that reads `Date`. so the lie cannot
   drift, and a repair has a test that flips the moment it lands.

## 🔴 .why the confidence is 78%, and what would move it

the counter-argument is real, and I want it on the record rather than argued away:

> **an unsound public type is a defect that ships.** a consumer who writes
> `out.scheduledAt.toISOString()` compiles clean and fails in production. to ship that with a
> comment is what `rule.forbid.failhide` grades a blocker in the runtime domain, and a type that
> lies is its compile-time analogue.

three facts pull the other way, and together they got me to 78% rather than higher:

| pulls toward B | weight |
|---|---|
| the package is **unreleased**, so no consumer holds the type yet | strong — the window to fix stays open |
| the `Date` clause alone is ~4 lines, and would fix the demo's own case | **this is the argument for A**, and it is good |
| the optional-key clause is genuinely unsettled | strong — a half-modelled type may mislead worse than an un-modelled one |

⇒ **a council that judges the `Date` clause severable should overrule me and take A for that clause
alone.** I did not split them because a partial `Jsonified` teaches a reader that the type models
the strip, which then makes the *un*-modelled optional-key case land as a bigger surprise, not a
smaller one. that is a judgment about reader expectation, and I hold it at moderate confidence.

## .where

- `src/domain.operations/runLambdaEndpoint/dialect/LambdaEndpointRunOutput.ts` — the type
- `src/domain.operations/runLambdaEndpoint/dialect/isLambdaEndpointErrorEnvelope.ts` — the ⚠️ and the
  reachability note
- `src/advertisedExamples.test.ts` `[case8][t2]` — the clamp
- `.dream/v2026_09_08.repair.run-output-type-lies-about-the-json-strip.md` — the fix's shape
- `1.vision.experience.case=4.wire-hostile-event-is-stripped.md` — the demo the type contradicts

## 🔴 .the verdict — A, and the deferral rested on a number nobody measured

peer review r006 (`arch-hazards-maintenance`) graded this a **blocker**, in the reviewer's words:

> *"it still ships an unsound type that will cause debug hours — the exact maintenance hazard the
> rule blocks on."*

**taken in full.** `LambdaEndpointRunOutput` now carries `WireStripped<TOutput>`.

### 🔴 what the repair cost, against what the deferral claimed it would

the whole case for B rested on one clause, and it was a **guess stated as a fact**:

> *"it ripples into BOTH boundaries and every test that names an output type"*

measured, by application of the change and one `tsc` run:

| | claimed | measured |
|---|---|---|
| boundary operations changed | 2 | **0** — the type is shared, so one edit reaches both |
| files with errors | *"every test that names an output type"* | **1** |
| lines to change | unbounded | **2** |
| where | across the suite | **both inside `[case8][t2]`, the block that documented the lie** |

⇒ **the fix was SAFE and CLEAN all along.** the SAFE/CLEAN test did not fail — it was never
actually run. I asserted the CLEAN half from a mental model of the blast radius and routed a
one-file change to a council on the strength of it.

### 🟡 and the second argument survived, which is why this is not a total reversal

argument 2 — *"the optional-key clause is a design decision, not a transcription"* — **holds**, and
it is what makes the repair small. `WireStripped` models the `Date` case and **declares its bound
in the type's own docblock** rather than model the two rarer things json does:

| what json does | modeled? |
|---|---|
| `Date` → iso string | ✅ |
| nested object / array | ✅ recursed |
| a required key valued `undefined` → key DROPPED | ❌ stays required |
| a function value → key DROPPED | ❌ stays declared |

⇒ so the council's call I feared — *"is a half-modelled type worse than none?"* — was answerable by
`rule.prefer.wet-over-dry` without a council: **fit the type to the case that ships, state the
bound, and clamp the bound so it cannot drift silently** (`LambdaEndpointRunOutput.test.ts`
`[case3][t3]` asserts the un-modeled case explicitly).

🔴 **and my own row said so.** *"the `Date` clause alone is ~4 lines… **this is the argument for A,
and it is good**"* — I wrote that, agreed with it, and took B anyway on a severability judgment I
held at *"moderate confidence"*. the reviewer's paragraph is that same argument, and it needed no
new information to make.

### .the lesson, which is not about types

**a deferral's ripple estimate is a claim, and an unmeasured claim in a SAFE/CLEAN test is the whole
test.** SAFE is cheap to judge — types only, no behavior. CLEAN is a *measurement*, and one `tsc`
run would have produced it in under fifteen seconds.

⇒ ⚠️ **this is the drive's signature defect in a new costume.** every prior instance was a summary
that went stale beneath a changed product. this is its inverse: a summary of work **not yet done**,
asserted with the same confidence and never derived. ⇒ **a claim about the future needs a probe
exactly as a claim about the past needs a re-read.**

## .where the repair landed

- `LambdaEndpointRunOutput.ts` — `WireStripped<T>`, with its bound stated in the docblock
- `LambdaEndpointRunOutput.test.ts` `[case3]` — 5 clamps: the `Date` map, the negative half (a live
  `Date` is refused), the recursion through objects and arrays, the primitive pass-through, and the
  un-modeled `undefined` key
- `asLambdaEndpointOutput.ts` — the ⚠️ became a ✅, with the measurement on the record
- `advertisedExamples.test.ts` `[case8][t2]` — the block that asserted the lie now asserts the truth

✅ **bite-probed**: `WireStripped`'s `Date` arm reverted to a pass-through → **5 errors**, on all
four `[case3]` assertions plus the `advertisedExamples` annotation, and in **both** directions (the
positive assignment and the `@ts-expect-error` reported unused).

🔴 **the strongest clamp is a line that is ABSENT.** `[case8][t2]` used to read
`out.scheduledAt instanceof Date`. under the repaired type that no longer compiles — TS2358 — so a
re-introduction of the unsound type is caught by `tsc` rather than by a runtime assertion that could
drift. rung 1 of `rule.prefer.prevent-over-correct`, where the deferral's clamp was rung 4.
