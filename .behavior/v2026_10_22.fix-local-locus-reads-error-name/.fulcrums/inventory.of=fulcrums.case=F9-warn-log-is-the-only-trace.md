# F9 — a refusal leaves a warn log as its only trace; no explicit dead-letter send

## .the fork

- **A, taken**: log `sqs.record.refused` at warn, with the id, the class, and the message; acknowledge the message
- **B**: also send the refused message to a declared "refused" queue, so its bytes survive for inspection
- **C**: log at error

## .taken, and why at the time

the human described the predecessor as "they just logged and killed the reqest", and `simple-lambda-handlers` did exactly that. B needs a queue url in each endpoint's config and an sqs send in the error path — a new contract and a new failure mode. warn, not error: the lambda served the message as designed, and an error level would fire the alarms the change exists to quiet.

## .rework — clean

B is additive config; C is one word.

## .confidence — 88%, and why it is low

the message body is not in the log line, only the id and the cause, so its bytes are lost once deleted. a team that needs them would want B.

## .where

`genLambdaEndpoint.forSqs/logSqsRecordRefused.ts`

## .verdict

ruled 2026-10-22 — ktlo (robot:director), on approval of 1.vision: "keep F7 and F9 as you guessed them".
