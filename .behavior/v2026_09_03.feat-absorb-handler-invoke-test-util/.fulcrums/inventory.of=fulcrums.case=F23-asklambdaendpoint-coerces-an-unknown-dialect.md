# F23 — `askLambdaEndpoint` coerces an unknown dialect to contemp; its peer `runLambdaEndpoint` throws

| field | value |
|---|---|
| **rework** | **dirty** on the repair (safe 🔴 / clean ✅) · **clean** on the record (this row) |
| **status** | open — best-guessed *leave asymmetric*, flagged for the council |
| **confidence** | 88% on the CALL (leave it), the safety argument is strong; the RECORD was owed regardless |
| **raised** | i029 r011, restated i039, and the RECORD gap named at i040 (blocker item 3) + i041 r010 §1a |
| **where** | `askLambdaEndpoint.ts:85` vs `runLambdaEndpoint`'s `asLambdaEndpointDialect` guard |

## the fork, stated fairly

one domain concept — `LambdaEndpointDialect` — is read at two call sites, and they refuse an unknown
value with opposite stances:

| call site | the code | an unknown value |
|---|---|---|
| `runLambdaEndpoint` (both subdomains) | `asLambdaEndpointDialect({ declared })` | **throws** a `ConstraintError` that lists the valid set |
| `askLambdaEndpoint.ts:85` | `input.struct?.payload ?? 'contemp'` | **silently becomes `'contemp'`** |

⇒ a caller who typos `struct: { payload: 'anceint' }` gets a silent success on `askLambdaEndpoint`
and a loud reject on `runLambdaEndpoint`. the field is typed, so a typed caller is safe; a js
consumer, an `as any` site, or a config-driven value is not.

## taken, and why — at the time

**leave the coercion in place, and RECORD the call here.** two decisions, split:

- **do not repair** — `askLambdaEndpoint` is a shipped production caller this wish does not touch. a
  live service that passes a bad value today gets `'contemp'` and works; a throw is a runtime break
  in someone else's deploy, introduced by a test-util wish. `safe 🔴` is the harder stop, and
  `rule.always.fix-forward-under-scouts-honor` puts it at *defer*. the work is tracked at
  `.dream/v2026_09_11.repair.one-dialect-two-validation-philosophies.md`.
- **do open this row** — the dream justified the decision NOT to repair, and said naught about the
  decision NOT to record. those are two calls. *"a call nobody recorded is a call nobody can
  overrule"* — F18's own lesson, six rounds of it. so the RECORD gap is closed here.

## rework — why the repair is dirty but the record is clean

| the move | rework |
|---|---|
| the one-line fix (`asLambdaEndpointDialect({ declared: input.struct?.payload })` + a clamp) | **dirty** — safe 🔴 (breaks a live bad caller), clean ✅ (one line, one import, one test) |
| this fulcrum row | **clean** — a record, reversible at no cost |

## the settler that resizes it

> how many callers pass `struct.payload` from an untyped source — config, a json body, an `as any`?

a measured `0` makes the fix safe outright and collapses it to the one-line change with no council
question. the search wants the `ahbode/*` + `ehmpathy/*` population — in reach of `rhx git.repo.get`,
out of reach of this stone's scope. stated rather than left implicit (the F14 lesson: a deferral that
cites a cheap settler and leaves it unrun is an unasked question).

## the council question, in one line

> **should one domain concept carry one validation stance across the two operations that own it —
> and if so, is a runtime break in a shipped caller an acceptable cost to get there, or does the
> settler (a measured zero of untyped callers) make it free?**

## .see also

- `.dream/v2026_09_11.repair.one-dialect-two-validation-philosophies.md` — the one-line fix, its clamp, the settler
- `F9` — dialect-as-a-generic; the typed caller this asymmetry does not endanger
- `F19`/`F20` — the peer dialect-classification council; F22 closed their contemp halves
- `rule.always.fix-forward-under-scouts-honor` — the SAFE/CLEAN split that grades the repair a defer
