# F7 — a schema refusal on sqs is a caller fault, so it is acknowledged too

## .the fork

- **A, taken**: a message that `schema.input` refuses is acknowledged and logged, as a handler's `ConstraintError` is
- **B**: acknowledge only a handler's own `ConstraintError`; a schema refusal keeps today's redrive

## .taken, and why at the time

the validator throws a `ConstraintError` (`getValidatedInput`), so the human's invariant — "constraint errors never trigger sqs retries nor dlq entries, because the message is a fault" — covers it by its own words. a malformed message is the clearest case of a message that is the fault: no retry can change its bytes. `simple-lambda-handlers` caught its joi validation refusal as a `BadRequestError` by the same middleware.

## .rework — clean

the change is one catch in each variant; B is the same catch with the validator left outside it.

## .confidence — 90%, and why it is low

it reverses the extant design note in `genSqsEndpointMiddlewares.ts` ("to swallow a validation failure into a success would silently discard a message no handler ever processed"). the answer to that note is the `sqs.record.refused` log, so the discard is not silent — but a team that leaned on the dead-letter queue to inspect malformed messages loses that view. named in the PR body as a behavior change.

## .where

`genLambdaEndpoint.forSqs.perRecord.ts`, `genLambdaEndpoint.forSqs.perBatch.ts`

## .verdict

ruled 2026-10-22 — ktlo (robot:director), on approval of 1.vision: "keep F7 and F9 as you guessed them".
