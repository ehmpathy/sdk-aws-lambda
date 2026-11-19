# F08 — the deserialize fix that prints twice in one refusal line stays

## .the fork

a text record on the json default yields a refusal whose `errorMessage` carries the fix twice: in the header (`validation failed: fix: the payload reached the schema as text …`) and again in the `hint` key of the json beneath.

- **cut it now**: the header states the class and the path, and the fix lives in `hint` alone
- **leave it**: ship the line as the extant `forSqs` refusal already prints it

## .taken — leave it, and say so

the text is the shipped `forSqs` contract, unchanged on main, and operators parse that line. a cut changes every source's refusal at once, sqs included. so it is a log-contract change, a release decision, and not the subject of this wish (symmetry). it costs a re-read, not a lost record.

## .rework — clean

one header edit in the shared `getValidationError` plus a resnap of the refusal snapshots. no caller is hardened against the repeat.

## .confidence — 90%, why not higher

an operator may well want the cut now: the line is long. the commander may rule it rides this pr.

## .where

- found: `review/self/for.5.3.verification._.has-critical-paths-frictionless.md`
- caught: `.dream/v2026_11_15.refactor.record-source-structural-hardening.md`, item 18
- surfaced: the pr body

## .verdict

open, to the commander.
