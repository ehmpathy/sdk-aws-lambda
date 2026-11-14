# F17 — the sns refusal line carries the MessageId, not the message

## .the fork

- **A** (shipped) the line carries `ids` (sns `MessageId`), the class, the cause, and the issues;
  no copy of the message
- **B** (enroll-impl-arch-defects, i006 nitpick.1, graded urgent) the sns line carries the record
  as delivered, as `sqs.record.refused` carries the message, so an operator can republish it

## .taken: A

- F9 was ruled as a line with the ids, the cause, and the issue paths; a message body in the logs
  is a new scope (what lands in cloudwatch, for every sns endpoint) and a data-exposure call that
  belongs to the director, not the driver
- an sns message may run to 256 KB; carried whole, the line itself would breach cloudwatch's event
  limit, the hazard the line caps exist to prevent
- the `MessageId` finds the delivery in sns's own delivery logs and in a subscribed archive (an
  sqs queue or firehose on the same topic), where a consumer chooses retention on purpose

## .for B, fairly

sns keeps no copy of a delivered message, so under A a schema bug of ours drops every message with
only an id left; the line traces the loss but cannot undo it. `forSqs` already logs the body for
the same reason, so B is consistent with the peer family.

## .rework: clean — one more entry in the per-source table in `logLambdaEventRefused.ts`, one
snapshot; the record is already in hand

## .risk: low — no credential, no prod write

## .confidence: 70%, why low

the peer `forSqs` precedent leans B; only the scope and size concerns hold A.

## .where

- `src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.forAsk/middleware/logLambdaEventRefused.ts`

## .verdict

open — best-guessed; the council rules at close.
