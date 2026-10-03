# F5 — perBatch's catch-all record catch is deferred, not narrowed in this patch

## the fork

- **A** — narrow the catch to `ConstraintError` in this commit (the `mech-failhides` blocker's fix)
- **B** — defer to its own release, with a dream; answer the blocker with the deferral ← taken

## taken: B, and why

- the catch is pre-extant (0.7.0, #46); this branch touches `perBatch.ts` only at its import line
- **not SAFE for a patch.** the allowlist moves a non-validation throw from a one-record retry to a
  whole-batch failure, so sqs redelivers siblings the handler already processed. a consumer with
  non-idempotent effects meets duplicate work inside a types-only 0.7.1. that change owes a release
  note of its own
- the shape of the fix and its clamp are in the dream:
  `dreams/v2026_10_02.fix.perbatch-record-catch-absorbs-every-error.md`

## rework: clean

the fix is a one-line catch change plus one clamp; naught in this patch builds on the catch.

## confidence: 80%, and why it is low

the rule is a mega blocker in the mechanic briefs, and a wisher may prefer the fix to ride along.
the counter: the fix changes run-time behavior for every `perBatch` consumer, and the wish is #48.

## verdict

open — for the wisher at the fulcrum council.

## ✅ verdict — ruled by the wisher: "defer is fine"