# F03 — fromSqs ships despite the whole-batch refusal under forAsk

- fork: keep "no fromSqs" (the prior stated choice) or add it
- taken: add it. the wish names `fromSqs` outright, and its pr title must name it
- cost carried: under `forAsk`, one refused body refuses the batch and sqs deletes all of it. the doc warns and points at `forSqs.perBatch`; `forAsk`'s `lambda.event.refused` warn lists every message id
- rework: clean
- confidence 95%
- where: `asLambdaEventSchema.fromSqs.ts`, `LambdaEventSchemaSource.ts`, `index.test.ts`
- verdict: settled by the wish
