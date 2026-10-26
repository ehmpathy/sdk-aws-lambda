# F17 — the `sqs.record.refused` line is pinned by an exact `toEqual`, never a snapshot

## the fork

two lanes disagree. `repo-rules` (5.1, i002, nitpick.1): the snapshot in `logSqsRecordRefused.test.ts` is redundant with the exact `toEqual` above it — delete it. `enroll-impl-behavior-intent` (5.1, i004, nitpick.5): the operator's one trace is not snapped — snap it.

| option | for | against |
|---|---|---|
| **exact `toEqual`, plus level and fate pinned at the seam** (taken) | the `toEqual` pins every key and value byte for byte, so a snapshot beside it can only go red when the `toEqual` already has. the seam pins (`"level":"warn"`, the `consequence` prose) cover what the unit grain cannot see | a pr reader sees the line in the test body, not in a `.snap` diff |
| snapshot beside the `toEqual` | the line shows up as a `.snap` diff in review | a second pin with no reach of its own, and a file to maintain |

## taken, and why at the time

the `toEqual`: it is already exact, and the line's shape shows in the test body.

## rework

clean — one `then` block.

## confidence — 90%

## where

`src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.forSqs/logSqsRecordRefused.test.ts`

## verdict

open.
