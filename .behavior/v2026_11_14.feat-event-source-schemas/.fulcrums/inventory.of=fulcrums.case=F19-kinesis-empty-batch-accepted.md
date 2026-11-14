# F19 — the kinesis schema accepts an empty batch; the sns schema refuses one

## .the fork

- **A** (shipped) `fromKinesis` accepts `Records: []`; the source note and the readme tell a handler
  to check the length before `Records[0]`. `fromSns` keeps `.min(1)`
- **B** (an earlier 5.1 round, i004 r011 nitpick.3; re-raised at 5.3 by enroll-verif-test-intent)
  both sources refuse `Records: []`, so the documented `Records[0]!` idiom can never meet an empty
  batch

## .taken: A

- aws's own kinesis sample handlers guard an empty batch, so aws treats one as a possible delivery
- under tumble windows the final invoke of a window may carry no records, and an answer with no
  `state` fails the invoke; a refusal there suspends the shard rather than advance it, a harm B
  would ship to every tumble-window consumer
- sns invokes once per message, so an empty sns batch is no delivery (c17); `.min(1)` there costs
  naught and spares the `Records[0]!` reader

## .for B, fairly

a kinesis handler that reads `Records[0]!` meets an empty batch as a TypeError, a server fault aws
retries until the records expire, and the schema could have refused it first. a readme caution is
weaker than a schema that enforces it. B was the criterion an earlier round set and tested; A
reversed it on a later round's evidence, with no verdict above the driver.

## .rework: clean — restore `.min(1)` on the kinesis `Records` array, flip `[case10][t1]` to refuse,
drop the readme bullet and the catalog row c33's verdict

## .risk: low — no credential, no prod write

## .confidence: 75%, why not higher

both harms are real and land on different consumers: B harms a tumble-window consumer; A harms a
consumer who skips the length check. which population is larger is a product call.

## .where

- `src/domain.operations/asLambdaEventSchema/asLambdaEventSchema.fromKinesis.ts` (the `Records` array)
- `asLambdaEventSchema.test.ts` [case10]
- `readme.md` sns / kinesis section; `1.vision.experience.case=_.md` c33

## .verdict

open — best-guessed; the council rules at close.
