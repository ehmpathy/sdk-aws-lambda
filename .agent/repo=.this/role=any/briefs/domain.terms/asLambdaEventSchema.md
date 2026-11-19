# asLambdaEventSchema

## .the term

`asLambdaEventSchema` — the family that builds the zod schema of the event an aws source delivers
to a lambda, optionally with the schema of the message inside it.

```ts
asLambdaEventSchema.fromSns({ payload: schemaOfNotice })   // ZodType<SnsEventDecoded<X>, SNSEvent>
asLambdaEventSchema.fromKinesis()                          // ZodType<KinesisStreamEvent, KinesisStreamEvent>
```

a transformer family (`[verb][...noun]`): `as` + `LambdaEvent` + `Schema`, with `.from$Source`
leaves.

## .the etymology

| part | why |
|---|---|
| `as` | a cast: it takes a source and returns a value, with no identity or persistence (`rule.require.get-set-gen-verbs`) |
| `LambdaEvent` | the noun its peer `asLambdaEvent` already spends: the object aws hands a lambda (`event.md`) |
| `Schema` | names what it returns, so it never collides with `asLambdaEvent`, which returns the event itself |
| `.from$Source` | provenance, as in `asLambdaEvent.from$Source` (`define.lambda-event-source`) |

| rejected | why |
|---|---|
| `asAwsLambdaSnsEvent` | mashes the source into the noun; no family, so a third source is a third bare export (`rule.forbid.unqualified-variant-exports`) |
| `genSnsEventSchema` | `gen` is findsert; a schema has no identity to find |
| `schemaOfSnsEvent` | no verb, so not an operation (`rule.require.treestruct`) |
| `asLambdaEvent.schemaOfSns` | puts two directions (construct, validate) on one family; the return kinds differ |

## .evidence

- the peer: `asLambdaEvent.from$Source` constructs the same envelopes; the pair walks one axis in
  two directions (`define.lambda-event-source`)
- the consumers: svc-notifications' sns and kinesis handlers hand-derived the envelope or
  rubber-stamped it with `z.object({ Records: z.array(z.any()) })` (wish, #13)
- the set: sqs, sns, and kinesis — every record source, each paired with its `genLambdaEndpoint.forX`
  (`rule.require.event-source-symmetry`). api gateway validates its own reconciled input under
  `forApiGateway`, a direct invoke has no envelope, and s3 carries no payload
  (`define.lambda-event-source`)

## .refused

the warn line's verb: `lambda.event.refused`, peer of `sqs.record.refused`. an event-source
endpoint *refuses* an event when a caller fault (a schema refusal, or a `ConstraintError` /
`BadRequestError` the handler throws) means aws drops it. `rejected` was declined: a promise
rejection is a server-side throw here, the opposite fate.

## .invariants

- each leaf returns a schema whose input face is the aws-lambda type, so `forAsk` needs no cast
- each leaf stamps its source on the schema, data only (`{ name }`); `forAsk` reads it to decide
  the warn
- every leaf has an endpoint peer, and the reverse, save the declared one-sided list;
  `eventSourceSymmetry.test.ts` holds it, and `index.test.ts` clamps the key set
- `fromSqs` under `forAsk` refuses a whole batch for one bad message, and sqs deletes every message
  in it; `forSqs` refuses the one message alone. the leaf ships for symmetry, with the caution on it

## .see also

- `define.lambda-event-source` — the axis and its two directions
- `event.md`, `payload.md` — the object it validates, and the slot it decodes
