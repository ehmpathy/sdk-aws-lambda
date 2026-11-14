# F1 — sqs: no new schema; `genLambdaEndpoint.forSqs` already serves it

## .the fork

- **A** ship `asLambdaEventSchema.fromSqs({ payload })`, as the wish lists sqs beside sns and kinesis
- **B** ship sns + kinesis only; the sqs doc points to `genLambdaEndpoint.forSqs.{perRecord,perBatch}`

## .taken: B

`forSqs` already validates the envelope and each record's body against `schema.input.payload`, and it
answers per message: a refused record is acknowledged, a server fault redrives
(`invariant.constraint-errors-never-redrive-sqs`). an sqs schema for `forAsk` would be a second sqs
path with worse failure semantics — one bad message refuses the batch. that is a parallel codepath
(`rule.forbid.parallel-codepaths`, `rule.require.widen-before-parallel`).

the issue (#13) predates `forSqs`; its sqs pain is already gone.

evidence: of the four handlers #13 cites, two are sqs (`executeTaskRhelayVoiceReceivedEvent`,
`executeTaskTranscribeVoiceCall`, per `ahbode/svc-notifications`
`PERF.tsc-inference-fix.ledger.md:91-116`), wired via `forAsk` with `z.ZodType<SQSEvent>`. half the
evidence for the wish is sqs, and its remedy is a move to `forSqs.perRecord`, which validates each
body and acknowledges a refused message one at a time.

## .rework: clean

`fromSqs` is additive on the family object. no caller hardens against its absence.

## .confidence: 70%, why low

the wish text, restated today, still names sqs. the wisher may want it for a reason not in view
(e.g. a consumer pinned to a pre-`forSqs` version, or sns→sqs fan-out). ask.

## .where

`1.vision.yield.md` § open questions, § evaluation.

## .verdict

**ruled B** — director, 2026-11-14 12:5xZ. sqs goes through `genLambdaEndpoint.forSqs`; no
`fromSqs`. the docs show the sqs path through `forSqs`, which meets the wish's sqs ask.
