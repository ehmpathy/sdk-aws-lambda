# F11 — the trail carries the exid and never selects the dialect

> 🔴 **raised at self-review r5, and it should have been raised at execution.** the vision named this
> fork outright and handed it forward — *"the blueprint must pick; the vision does not"* — and the
> pick was made in code, documented in two docblocks, and clamped by two tests, with **no fulcrum
> row**. `rule.always.itemize-the-fulcrums-you-best-guess` grades that a blocker.

## the fork, stated fairly

`1.vision.yield.md`, awkwardness §1, on the bound F9 left open:

> ⚠️ **and F9 leaves a live implementation question behind it — one knob too many.** the frame is
> driven by the author's `trail:` input; the dialect is declared by `struct.payload`. **two knobs,
> one fact**, so they can be set to disagree — `{ trail, struct: { payload: 'ancient' } }` asks for a
> contemp frame and an ancient type. either the util derives `struct` from the frame (one knob, and
> the generic loses its explicitness) or it refuses the mismatch at the type level. **the blueprint
> must pick; the vision does not.**

so the vision offered two branches:

| # | branch | cost |
|---|---|---|
| A | derive `struct` **from the frame** — the trail wins | the generic loses its explicitness; the author cannot declare a dialect |
| B | **refuse** the mismatch at the type level | a conditional-type error at the call, which reads as noise and is hard to word |

## taken, and why at the time

**neither. a third branch: derive the FRAME from `struct.payload`, and demote `trail` to a payload
field.**

```ts
// asFramedPayload.ts — struct.payload is the only declaration
if (input.dialect === 'contemp')
  return { event, trail: input.trail?.exid ? { exid: input.trail.exid } : {} };
return input.event;                    // ancient: untouched, exactly as the wire sends it
```

⇒ **the disagreement is not resolved; it is unrepresentable.** there is one knob, and it is the one
the author declares — `rule.prefer.prevent-over-correct` rung 1, where branch B is rung 3 and branch
A is rung 1 at the cost of the F9 guarantee.

three reasons it beats both named branches:

1. **it keeps F9 whole.** branch A deletes the declaration the wisher ruled for; this keeps
   `struct.payload` authoritative and makes the frame follow it.
2. **it matches the WIRE, verbatim.** `askLambdaEndpoint.ts:74-77` sends `input.event` and no other
   field on the ancient dialect — the trail does not travel. so the referenced boundary now emits the
   byte-identical payload the serialized boundary does, which is the fidelity guarantee case=4 rests
   on. branch A would have made the two boundaries disagree.
3. **it removes a knob rather than police one.** branch B needs an error message that explains a
   conflict between two inputs; this needs no message, because the conflict cannot be written.

## 🔴 what it COSTS — the vision's case=5 experience is dissolved

this is the part that earns the row, and it is a **user-visible model change**:

| | the vision's model | this implementation |
|---|---|---|
| what `trail:` does | selects the caller frame, **and so the dialect** | supplies the exid, and no more |
| add a trail to an ancient call | the envelope flips to contemp | **the envelope does not move** |
| case=5's aha | *"she changed who she said she was"* | 🔴 **unreachable — she cannot** |

⇒ the demo at `1.vision.experience.case=5.*` narrates an experience this design makes **impossible**,
and `onReferenced.test.ts [t1b]` asserts the opposite outcome for the identical call. both are
corrected; see the review's gap 11.

⚠️ **and the coupling still exists in `genLambdaEndpoint` itself** — a handler invoked by any other
route still reads its dialect from the payload frame. what this fulcrum changes is that **this util
never puts an author in that position by accident.** the underlying design debt is unchanged, and is
follow-up #4 in the vision.

## 🟡 what it does NOT cost — the invariant is UPHELD, never contradicted

> raised at i013 r010 `enroll-impl-behavior-intent` as *"a user-visible model change that
> **contradicts a documented invariant** (`invariant.ancient-vs-contemp-callers`)"*.

**the model-change half is taken whole. the invariant half does not hold, and the distinction
changes what the council is asked to rule.**

`invariant.ancient-vs-contemp-callers` fixes the dialect on the **payload format**, never on the
presence of a trail:

| caller | payload format | detected via |
|---|---|---|
| contemp | `{ event, trail }` | `getIsWrappedPayload` → true |
| ancient | `{ ...event }` | `getIsWrappedPayload` → false |

read `asFramedPayload.ts:51-59` against that table — **both branches satisfy it exactly**:

| `struct.payload` | the frame emitted | `getIsWrappedPayload` | the envelope | invariant |
|---|---|---|---|---|
| `contemp` | `{ event, trail }` | true | contemp | ✅ upheld |
| `ancient` | the event, flat | false | ancient | ✅ upheld |

🔴 **so the derivation makes the invariant UNBREAKABLE from this surface rather than breaks it.**
what the two-knob design admitted was a call that emitted a **wrapped** payload while it declared
`ancient` in the return type — a state the invariant says cannot exist, and which F9's generic would
then have typed wrongly. the derivation deletes that state.

⇒ **the ask that survives is narrower and answerable:** not *"may this util break a cross-cutting
invariant?"* — it may not, and it does not — but

> **may a TEST util decline to expose a didactic surface the vision valued?**

case=5's aha was *"she changed who she said she was, and the envelope moved"*. under this design she
still can — she writes `struct: { payload: 'contemp' }` — she simply cannot do it **by accident**
while she reaches for a trail. the lesson survives; the *ambush* is what is gone.

🟡 **and that reframe runs both ways, which is why the row stays open.** a wisher who wanted the
ambush wanted it precisely *because* it is an ambush — a migrant who meets it once never forgets
that the frame is the declaration. i judge that the wrong trade for a **test util**, whose job is to
report what the handler did. it is still a real alternative and it is still not mine to rule.

## rework

**clean.** one branch in one transformer (`asFramedPayload.ts:51-59`). to reverse it is to let
`trail` drive the frame again — a one-line change, plus the two tests that clamp it. no consumer has
adopted either behavior, since neither has shipped.

## confidence, and why 92%

high, and short of the 93% bar for a reason worth stating: the **mechanism** is well-grounded (it
matches the wire verbatim, which is a checkable claim, `askLambdaEndpoint.ts:74-77`), and the
**model change** is mine rather than the wisher's. the vision framed the trail→dialect coupling as
"load-bearing" and "deliberate", and I removed it from this surface without an explicit ruling.

a wisher who values the coupling as a *teaching* surface — case=5's whole aha — may prefer branch B,
so the author meets the conflict rather than never encounters it. i judge that the wrong trade for a
**test util**, whose job is to report what the handler did, never to educate about caller identity.
but it is a real alternative and it is not the one i took.

## where

- `src/domain.operations/runLambdaEndpoint/serde/asFramedPayload.ts:13-23,51-59` — the derivation
- `src/domain.operations/runLambdaEndpoint/runLambdaEndpoint.onReferenced.ts:107` — `trail`'s docblock
- `src/domain.operations/runLambdaEndpoint/runLambdaEndpoint.onReferenced.test.ts` — `[t1b]`, `[t2]`
- `1.vision.experience.case=5.*` — corrected to match

## the verdict

✅ **RULED by the wisher, 2026-09-11: branch (a) — the code is right, and the demo is amended.**

the ask was: *may a test util decline to expose a didactic surface the vision valued, in exchange
for a state that cannot be written wrong?* the answer is **yes**, on the reason offered with it:

> *"a test util's job is to report what the handler did, not to educate about caller identity, and
> `rule.prefer.prevent-over-correct` puts 'unrepresentable' a full three rungs above 'good error
> message'."*

⇒ so the derivation stands: `struct.payload` is the sole declaration, `trail` supplies the exid, and
the two-knob disagreement is unrepresentable.

✅ **the demo was already amended** — `1.vision.experience.case=5.*` carries a correction banner that
names the dissolved link, tables what the cell is *now*, and keeps its filename so no citation
orphans. **no further work falls out of this ruling.**

⚠️ **and the row never should have blocked the stone.** `rule.always.defer-fulcrums-to-last` demands
**all three** for a block — no defensible guess · a **dirty** rework · every other question
addressed. F11 failed two: i held a defensible guess at 92%, and i had graded its rework **clean**
in this very file.

⇒ **i blocked on a clean-rework fulcrum, which is the premature block the rule names outright**:
*"a flagged clean rework costs a glance; a premature block costs the road its momentum."* the
correct move was to best-guess it, flag it for the council, and drive on — which is what the rule's
middle row says, and what the record here already supported.

🔴 **the tell was in the artifact and i read past it.** a `clean` rework grade and an `--as blocked`
cannot both be right about the same row; the contradiction sat two headers apart in one file.
⇒ **a fulcrum's own rework grade is the block test**, so a row graded clean is answered, never
escalated.
