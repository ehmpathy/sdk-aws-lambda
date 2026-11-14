# F9 — a refused sns/kinesis event must leave a trace at info level

## .the fork

- **A** ship the schemas; leave `forAsk`'s logs as they are; name the gap
- **B** `forAsk` logs a warn line when it answers a caller fault (every ask caller gains it)
- **C** wait for `forSns` / `forKinesis` families, which would log a refusal as `forSqs` does

## .the measured gap

`forAsk` answers a schema refusal with an error body and a successful invoke. the only log line is
`handler.output` at **debug** (`genIoLoggerMiddleware.ts:59-72`). sns and kinesis then drop the event.
at a prod log level of info, the event vanishes with no trace. `forSqs` logs the same fault as
`sqs.record.refused` at warn (`invariant.constraint-errors-never-redrive-sqs`: "a caller fault
acknowledged with no refusal line = blocker" — written for sqs; the harm is the same here).

## .taken: B

a refusal is a sharp critipath (inventory c2, c4, c20). under A it fails silent, so it does not fail
safe — the experience-coverage bar refuses that. B makes it loud: one warn line with the error class,
message, and zod issue paths, the same fields `sqs.record.refused` carries.

the cost to direct-invoke callers is one added warn line per caller fault. no response changes.

## .rework: clean

a log line; no contract a caller reads.

## .confidence: 70%, why low

B widens a shared family's log surface for every direct-invoke caller, which the wish did not name.
the wisher may prefer to scope it to event-source schemas only.

## .verdict

**ruled B, narrowed** — director, 2026-11-14 12:5xZ. the warn line fires only when a schema built
by `asLambdaEventSchema.*` refuses. every other `forAsk` caller keeps its current log level (debug
only). the blueprint picks how `forAsk` tells an event-source schema apart (e.g. a mark the
schema carries); no response changes in either case.
