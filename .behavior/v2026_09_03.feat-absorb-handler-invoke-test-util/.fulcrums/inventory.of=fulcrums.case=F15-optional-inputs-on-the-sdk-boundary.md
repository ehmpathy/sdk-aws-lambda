# F15 — optional inputs on the sdk boundary, where a rule's letter and its reason diverge

- **status** = open — a council's to settle
- **rework** = clean
- **confidence** = 90%
- **raised** 2026-09-08, self-review r7 of `5.1.execution.from_vision`

## .the fork, stated fairly

`rule.forbid.undefined-inputs` grades a **blocker** on *"optional attributes in internal input
arguments"*, and scopes its one exception to `src/contract/` — it permits them in *"boundary
user-facing contracts"* there, *"for better ux"*.

five optionals on this drive's public surface sit in `domain.operations/`, not `src/contract/`:

| operation | optional |
|---|---|
| `runLambdaEndpoint.onReferenced` | `struct?`, `trail?`, `context?` |
| `runLambdaEndpoint.onSerialized` | `at?`, `struct?` |

| the fork | |
|---|---|
| **A — obey the letter** | make all five required; every call site writes `struct: null, trail: null, context: null` |
| **B — obey the reason** | keep them optional, because this IS the boundary the exception describes |

**I took B.**

## .why B

1. **the rule locates the boundary by DIRECTORY, and this repo's boundary is elsewhere.** the rule
   reads as written for a *service* repo, where `src/contract/` is the public edge. this is an
   **sdk**: the public edge is the barrel at `src/index.ts`, and `runLambdaEndpoint` is exported
   from it and consumed by other repos. the directory differs; the architectural role is identical.
2. **the hazard the rule names is absent by construction here.** its `.why` is a *propagation*
   hazard — *"avoids forgotten inputs in call stack … eliminates thread bugs."* these five values are
   consumed **immediately, in the same function**, and threaded onward nowhere. so option A would
   impose the rule's cost while the risk it prices is not present.
3. **it would cost the migration its ergonomics.** the incumbent contract takes two fields,
   `{ event, handler }`. three mandatory nulls across **318 call sites** buys no compile-time safety
   that the two-field form lacks.
4. **it collides with a peer rule.** `rule.prefer.defaults-match-common-case` — *"a value the
   surface could infer or sensibly default must not be a required input."* under A, every one of
   the five would violate it.
5. **the one optional that DOES propagate was treated differently**, which is the evidence that this
   is an axis rather than a blanket excuse: `from?` threads `onSerialized` → the yml lookup →
   `getOneProjectRoot`. it was traced, its innermost layer confirmed **required**, and its
   conditional spread repaired at r7 gap 28.

## 🔴 .why the confidence is 90%, and what would move it

> **a rule that carves its exception by directory arguably means the directory.** a council that
> reads `.exception` as normative — rather than as an artifact of the repo the rule was written in —
> should overrule me and take A, or amend the rule to name the *boundary* rather than the *path*.

| pulls toward B | weight |
|---|---|
| the propagation hazard is provably absent for all five | **strong** — this is the rule's own stated `.why` |
| `rule.prefer.defaults-match-common-case` points the other way under A | strong |
| the incumbent's two-field contract is the adoption surface | moderate — A1 withdrew the byte-identical bar, so this carries less than it did |
| `from?`, the one case that threads, was handled per the letter | moderate — evidence the axis is applied, over invoked |

⇒ **the cleanest outcome is neither A nor B but a rule amendment**: re-word `.exception` to name a
*public boundary contract* rather than a *directory*, so an sdk and a service repo read it the same
way. that is a `bhrain`/`ehmpathy` briefs change, out of scope here, and it is the durable fix.

## .where

- `src/domain.operations/runLambdaEndpoint/runLambdaEndpoint.onReferenced.ts:145,150,155`
- `src/domain.operations/runLambdaEndpoint/runLambdaEndpoint.onSerialized.ts:93,113`
- `.behavior/…/review/self/for.5.1.execution.from_vision._.r7.role-standards-adherance.md` — gap 28,
  where the axis is derived and the `from?` counter-case is traced
- `rule.forbid.undefined-inputs` (ehmpathy/mechanic) — the rule
- `rule.prefer.defaults-match-common-case` (ehmpathy/ergonomist) — the peer it collides with

## .the verdict, once ruled

_unruled._
