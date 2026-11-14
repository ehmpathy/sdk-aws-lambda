# F5 — kinesis rides `forAsk`: one refused record refuses the batch

## .the fork

- **A** ship the kinesis schema for `forAsk`; name the all-or-none hazard in its doc
- **B** also build `genLambdaEndpoint.forKinesis.{perRecord,perBatch}` with per-record verdicts
  (`batchItemFailures`), as `forSqs` does
- **C** ship no kinesis schema until B exists

## .taken: A

the wish asks for schema generators, not a family. under `forAsk`, a schema refusal is a caller fault:
the body returns, the invoke succeeds, and kinesis advances past the whole batch — good records with
the bad one. today's rubber-stamp refuses no batch, so the hazard is new to a consumer who adds a
`payload` schema. the doc must say so, and name the envelope-only form as the safe one for a mixed
stream.

## .evidence

the one evidenced kinesis consumer (`ahbode/svc-notifications`,
`consumeShortUrlCloudfrontLogFromKinesis.ts:28-31`) refuses a batch of more than one record, by
design. at batch size one, all-or-none is per record, so the hazard does not bite it. the hazard is
real for a consumer at a larger batch size, and none is evidenced. that, plus the consumer's own
batch-of-one guard, points at a `forKinesis.perRecord` shape as the true need (dream
`forsns-forkinesis-families`).

## .rework: clean

a `forKinesis` family is additive, and could reuse the record-level schema this ships.

## .confidence: 65%, why low

a schema that silently skips good records on one bad one is a sharp default. the wisher may prefer C,
or B now. ask.

## .verdict

**ruled A** — director, 2026-11-14 12:5xZ. kinesis rides `forAsk`; one refused record refuses the
batch, and the doc carries the caution (envelope-only for a mixed stream). a `forKinesis` family with
per-record verdicts is a dream (`forsns-forkinesis-families`), not this wish.
