# F2 — name: `asLambdaEventSchema.from{Sns,Kinesis}`

## .the fork

- **A** `asAwsLambdaSnsEvent(inner?)` — the issue's illustrative names, positional arg
- **B** `asLambdaEventSchema.fromSns({ payload? })` — a family object, the mirror of `asLambdaEvent.fromSns`

## .taken: B

- `define.lambda-event-source` names #13 "the schema half of the event-source axis … one source list,
  two directions". `asLambdaEvent.from$Source` constructs; `asLambdaEventSchema.from$Source` validates
- `as…Schema` has precedent: `asApiGatewayResponseSchema({ payload })`
- a family object is the repo's shape for variants (`rule.forbid.unqualified-variant-exports`); a new
  family is a plain object
- `AwsLambda` is redundant in `sdk-aws-lambda`, and `asAwsLambdaSnsEvent` reads as a cast INTO an
  event (that is `asLambdaEvent.fromSns`), not a schema
- named input, never positional (`rule.require.input-context-pattern`)

## .rework: clean

unreleased; a rename is a sed.

## .confidence: 80%

`as` on a schema builder is a stretch of "cast"; precedent carries it.

## .verdict

best-guessed.
