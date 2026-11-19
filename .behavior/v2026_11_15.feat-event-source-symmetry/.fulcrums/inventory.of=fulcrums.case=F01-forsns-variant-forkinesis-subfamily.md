# F01 — forSns is a variant; forKinesis is a `{ perRecord, perBatch }` sub-family

- fork: `forSns` vs `forSns.perRecord`; `forKinesis` flat vs `forKinesis.{perRecord, perBatch}`
- taken: sub-family exactly where the source batches. kinesis batches and supports partial batch failure (`itemIdentifier` = `sequenceNumber`); sns delivers one record per invoke
- why: `domain.terms/genLambdaEndpoint.md` — "a sub-family exists only where a trigger forces a choice; a `for*` object with one leaf is a variant with an extra hop"
- rework: clean — a rename of one key path before release
- confidence 85%: the wish says "super symmetric"; the commander may read call-form parity (`forSns.perRecord`) as the symmetry asked for
- where: `src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.ts`
- verdict: open — pr body question 3
