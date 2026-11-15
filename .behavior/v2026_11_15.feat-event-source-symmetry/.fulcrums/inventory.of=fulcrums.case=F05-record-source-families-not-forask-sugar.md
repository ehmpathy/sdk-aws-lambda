# F05 — forSns and forKinesis are full record-source families, not sugar over forAsk

- fork: `forSns(x)` = `forAsk({ schema: { input: fromSns(x) } })` (thin), or a record-source family like `forSqs` (deep)
- taken: deep. the wish says "one consistent shape across sources", and the extant sqs shape is the record-source family; `forAsk` carries a caller contract (introspection forces `schema.output`, a constraint-error body, dialect) that no record source has a caller for
- inferred, not said: the commander named the members, not their depth
- rework: clean — the thin form is far smaller, so a reversal deletes most of the work; yet no caller exists until the pr merges, so it is a deletion, never a teardown
- confidence 92% (was 85%): the wish's "one consistent shape across sources" excludes sugar by logic — `forAsk` demands `schema.output` and a dialect that `forSqs` lacks. the residue: the commander may still have pictured sugar
- where: `genLambdaEndpoint.forSns.ts`, `genLambdaEndpoint.forKinesis/*`
- verdict: best-guessed; named in the pr body
