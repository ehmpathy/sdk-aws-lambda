# F13 — a perBatch schema that throws a server fault retries that record alone, logged loud; it is not rethrown

## the fork

`mech-failhides` (5.1, i001, blocker.1): the perBatch validation catch handles a server fault — a schema whose own `.refine()` throws a raw `Error` — rather than rethrow it.

| option | for | against |
|---|---|---|
| **retry that record alone, and log it loud** (taken) | the record is never deleted: it is named in `batchItemFailures`, so sqs redrives it. that is the partial-failure contract `perBatch` exists for (`genLambdaEndpoint.forSqs.ts`: "one poison pill does not redrive nine healthy messages"). the log is now `log.error` with `id`, `class`, `errorMessage`, `stack`, `consequence` — what an on-call engineer needs | the invoke itself succeeds, so a fault of ours shows as a retry plus an error line, not a failed invoke |
| rethrow (`MalfunctionError` with cause) | the invoke fails loud | every healthy record in the batch redrives with it, so one bad schema callback replays the whole batch on every receive — a worse outage, and the exact cost `perBatch` exists to avoid |

## why it is not a failhide

`rule.forbid.failhide` forbids a catch that HIDES an error. this catch hides none: the record redrives (its disposition is the safe one), and the error is reported at error level with its class and stack (`perBatch.test.ts [case14]` asserts both). the branch predates this PR on main; this PR made its report loud, in `setSqsRecordsValidated.ts`.

## taken, and why at the time

retry alone, logged loud. the fix conceded the reviewer's failloud half (class, stack, error level) and kept the partial-failure disposition.

## rework

clean — one branch in `setSqsRecordsValidated.ts`, one test case.

## confidence — 88%, and why it is not higher

a team might prefer a failed invoke for any fault of ours, at the cost of batch replay. that is a product call on `perBatch`'s contract, not on this fix.

## where

`src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.forSqs/setSqsRecordsValidated.ts`

## verdict

open.
