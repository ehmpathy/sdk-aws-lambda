# F18 — the refusal line's `origin` field (schema vs handler) is deferred

## the fork

`enroll-impl-arch-defects` (5.1, i004, nitpick.1): a handler's own `ConstraintError` writes the same `sqs.record.refused` line as a producer's schema refusal, so an operator cannot alarm on a handler that deletes messages it should have retried.

| option | for | against |
|---|---|---|
| **defer to a dream** (taken) | the human's ruled policy stands without it; the readme and invariant already name the cure (throw `MalfunctionError`) | the observability gap ships |
| add `origin: 'schema' \| 'handler'` now | an alarm can key on handler refusals | perRecord's one `try` wraps validate and invoke, so it must split in two; it adds a key to a log contract operators alarm on, in a round whose reviewers already graded that catch twice |

## taken, and why at the time

defer: safe, but not clean — it ripples into the perRecord catch and the log contract.

## rework

dirty — a log contract change, once operators key alarms on the line.

## confidence — 85%

the deferral is sound for scope; a council that weighs observability above scope could pull it in.

## where

`.dream/2026_10_22.sqs-refusal-log-names-its-origin.dream.md`

## verdict

open.
