# F6 — the inner-schema key is `payload`

## .the fork

`message` (sns's word) · `data` (kinesis's word) · `body` (sqs's word) · `payload` (this repo's word)

## .taken: `payload`

`domain.terms/payload.md`: payload = the body of a message, parsed and validated. that is exactly what
the key describes, at every source. one key across sources (`rule.require.consistent-variant-contracts`);
`forSqs` and `asApiGatewayResponseSchema` already name it `payload`.

## .rework: clean

## .confidence: 85%

## .verdict

best-guessed.
