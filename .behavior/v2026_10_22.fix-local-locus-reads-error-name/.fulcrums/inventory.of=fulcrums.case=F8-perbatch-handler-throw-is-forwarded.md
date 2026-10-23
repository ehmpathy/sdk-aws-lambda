# F8 — a perBatch handler throw is forwarded, whatever its class

## .the fork

- **A, ruled**: a `perBatch` handler throw — a `ConstraintError` included — is forwarded, so the batch redrives as today. to refuse one record, a handler acknowledges it via `successes`
- **B, rejected**: a `perBatch` handler that throws a caller fault acknowledges every record in the batch

## .the verdict — the human

> batch level throws must not acknowledge every record cause we dont know which ones do succeeded or failed. thats unacceptable. so, forBatch, we should forward the throw

a batch-level throw carries no per-record verdict: some records may have been served, some not. to acknowledge all would delete records with an unknown outcome. so "never redrive a caller fault" binds per message — a schema refusal names its record; a batch throw names none.

## .the path to it

first best-guessed A (85%). self-review 4 flipped it to B on the verdict's "never" and the predecessor's whole-invoke catch. the human ruled A. the lesson: the predecessor had no per-record answer to preserve, so its whole-invoke catch was not evidence for a batch that does.

## .rework — clean

no change to `perBatch`'s invoke path; the catch wraps validation only.

## .where

`genLambdaEndpoint.forSqs.perBatch.ts`; `invariant.constraint-errors-never-redrive-sqs.md` § the bound

## .verdict

ruled — A, by the human, 2026-10-22.
