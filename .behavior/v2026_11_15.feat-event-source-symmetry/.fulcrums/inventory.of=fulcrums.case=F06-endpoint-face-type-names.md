# F06 — endpoint-face type names, beside the schema-face names v0.8.0 shipped

- fork: `SnsEventDecoded` and `KinesisStreamEventDecoded` already name the SCHEMA face (the aws envelope with its bodies parsed, public since v0.8.0). the endpoint face needs its own names, and `SqsEventDecoded` already names the sqs ENDPOINT face. so one word, `Decoded`, spans two faces
- taken: keep every shipped name. the new endpoint faces take `<Source>EventRecords` / `<Source>Record` names (`SnsEventRecords`, `SnsRecord`, `KinesisEventRecords`, `KinesisRecord`). the new sqs schema face is `SqsEventBodyDecoded`, which parallels the two schema faces in shape and avoids a clash with the endpoint face
- why: a rename of either shipped name is a break, and the wish asks for no break. the asymmetry gets one sentence in `domain.terms/asLambdaEventSchema.md`
- rework: clean — names only, before merge
- confidence: 80% — the names are defensible, but the cleaner end state (one word per face across all three sources) costs a major version
- where: `src/index.ts` type exports; the new families' type files
- verdict: best-guessed, to the commander as a note in the pr body
