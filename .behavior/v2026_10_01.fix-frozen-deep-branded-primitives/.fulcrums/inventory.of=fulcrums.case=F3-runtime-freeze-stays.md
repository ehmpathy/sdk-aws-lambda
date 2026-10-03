# F3 — the runtime `setFrozenDeep` stays; only the type moves to type-fns

## ✅ verdict — RULED B, by the wisher: "no, switch fully at runtime too … now"

the best-guess (A) below is reversed. `setEventFrozen` now calls `asFrozenDeep`, and `setFrozenDeep`
is deleted. what the swap brought with it, each clamped:

- builtin mutators (`Date`, `Map`, `Set`, `WeakMap`, `WeakSet`) now refuse — `setEventFrozen.test.ts
  [case10][t0]`
- a value it cannot seal (typed array with bytes, global or sticky `RegExp`) fails before `invoke`,
  all or none, as a `MalfunctionError` with the type-fns refusal as `cause` — `[case10][t2]`
- 🔴 **found by measure, then fixed:** the mutator refusal is a `ConstraintError`, and
  `getIsConstraintError` read it as a CALLER fault — the caller got a `BadRequestError` envelope for a
  handler defect. `getIsFrozenMutatorRefusal` (matched by metadata + message, since type-fns ships no
  subclass) now keeps it a server fault — `forAsk [case16]` (seen red with the guard off),
  `getIsFrozenMutatorRefusal.test.ts`
- the dream that held B (`.dream/v2026_10_02.fix.adopt-asfrozendeep-runtime-for-the-invoke-freeze.md`)
  is closed by this change. it called B a minor; the wisher ruled it rides the 0.7.1 patch (F1)

the record below is the reason A was guessed at the time.

## the fork

- **A** — import the type alone; keep `setFrozenDeep` + `setEventFrozen` as they are
- **B** — also replace the runtime walk with type-fns' `asFrozenDeep`

## taken: A, and why

- the wish scopes step 2 to "the local `FrozenDeep` is deleted and imported from type-fns"
- `asFrozenDeep` is a different runtime: its doc (`FrozenDeep.ts:27-30` @ type-fns main) says it
  refuses `Date` / `RegExp` mutators with a `ConstraintError` — a behavior change on the hot path of
  every handler, which no wish line asks for

- re-measured at 5.1 against the **installed** type-fns 1.21.5
  (`node_modules/type-fns/dist/companions/asFrozenDeep.js`), not main. `asFrozenDeep`:
  - throws a `ConstraintError` on what it cannot freeze — a typed array with elements (`:152`), a
    global or sticky `RegExp` (`:169`), a built-in already sealed by another freeze (`:192`, `:208`)
  - redefines built-in mutators as throwers (`:245`)
  - walks `Map` / `Set` entries, where `setFrozenDeep` walks `Object.values` only
  - ⇒ a payload that a `.transform()` turns into a global `RegExp` would 500 where today it passes

- re-raised at 5.1 i003 by `enroll-impl-arch-defects` as `[nitpick][urgent]`: the type now comes
  from type-fns and the runtime does not, so `Set` / `Map` / `Date` writes the type documents as
  refused can still land (measured: `setEventFrozen.test.ts` `[case9]` note, `[case10][t0]`). the
  divergence is real; it predates this change (0.7.0 shipped the same walk). B is still a behavior
  change unfit for the patch F1 ruled, so it is held, not dropped:
  `.dream/v2026_10_02.fix.adopt-asfrozendeep-runtime-for-the-invoke-freeze.md` — a minor, own wish

- re-raised at 5.1 i004 by `enroll-impl-arch-defects` nitpick.3 as `[nitpick][urgent]`: a typed array
  with elements makes `Object.freeze` throw inside the walk, so the invocation fails before `invoke`.
  measured (`setEventFrozen.test.ts` `[case10][t2]`) and now named in the readme table. it predates
  this change too, and the swap to `asFrozenDeep` is what closes it (a named `ConstraintError` up
  front), so it rides the same dream. ⚠️ a one-line skip of buffer views would stop the crash but hand
  `invoke` an unfrozen value, which `rule.require.frozen-invoke-inputs` forbids

## rework: clean

a later swap touches one function body; the type already matches.

## confidence: 88% — the wisher may prefer B in this release; that would also make it a minor
