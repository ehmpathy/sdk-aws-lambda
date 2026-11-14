# F8 — the public return type is declared, with one documented cast

## .the fork

- **A** let zod infer the return type from `z.looseObject(...)`
- **B** declare `ZodType<SnsEventDecoded<TPayload>, SNSEvent>`; cast once inside, documented

## .taken: B

measured: a probe typed `z.input<typeof looseSchema>` and assigned an `SNSEvent` to it. tsc refused
(TS2322): `SNSMessage` has no string index signature. `looseObject` infers
`{ [x: string]: unknown; … }`, and the aws-lambda interfaces carry no index signature. under A the
consumer's handler would not accept an `SNSEvent` without a cast — the exact cast the wish removes.

so the cast moves from every consumer to one seam in the sdk, documented per `rule.forbid.as-cast`,
as `asApiGatewayResponseSchema` already does.

## .rework: clean

## .confidence: 90%

## .verdict

best-guessed.
