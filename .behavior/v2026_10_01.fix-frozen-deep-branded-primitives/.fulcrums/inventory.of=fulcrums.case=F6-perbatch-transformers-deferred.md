# F6 — perBatch's inline id pipelines are deferred to their own refactor

## the fork

- **A** — extract the six pipelines into named transformers in this commit (the
  `mech-decode-friction` blocker's fix)
- **B** — defer to its own `refactor` release, with a dream ← taken

## taken: B, and why

- the pipelines are pre-extant (0.7.0, #46); this branch touches `perBatch.ts` only at its import
  line, and the wish (#48) is a types-only fix
- **not CLEAN.** five new transformer files plus five test files ride into a single-commit patch whose
  diff is otherwise six import lines and a test clamp. no behavior changes, so it lands better alone,
  beside F5's catch change, since both edit one `logic` body
- the shape of the fix is in the dream:
  `dreams/v2026_10_02.fix.perbatch-logic-carries-inline-id-pipelines.md`

## rework: clean

a pure extraction; the extant `perBatch` cases clamp it. naught here builds on the inline form.

## confidence: 90%

a refactor of untouched code inside a fix patch is the smuggle `rule.prefer.scouts-honor` bounds.

## verdict

open — for the wisher at the fulcrum council.

## ✅ verdict — ruled by the wisher: ok, defer