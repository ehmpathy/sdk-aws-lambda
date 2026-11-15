# record-source

## .the term

`record source` — a lambda event source whose aws trigger hands over **a batch of records**, each
one message a producer sent. today: `sqs`, `sns`, `kinesis`.

in code it is `RecordSource` (`record/RecordSource.ts`): the facts a source supplies to the shared
serve, as data — its `name`, its `noun`, the consequence lines its warn and error carry, and its
trail `carrier`. each source declares one constant: `RECORD_SOURCE_SQS`, `RECORD_SOURCE_SNS`,
`RECORD_SOURCE_KINESIS`.

## .the etymology

aws's own shape at this boundary. each of these triggers delivers `{ Records: [ … ] }`, and the
sdk's endpoint serves one record at a time or the batch whole. the word names what the source
hands over, which is what the shared serve is built around.

| rejected | why |
|---|---|
| `event source` | a wider set: it also holds `apiGateway` and `ask`, which hand over one request, and `s3`, whose `Records[]` no record-source family serves yet (`define.lambda-event-source.md`) |
| `queue` | sqs alone; sns is a topic, kinesis a stream |
| `stream source` | kinesis alone, and it collides with dynamodb streams |
| `message source` | sns and sqs say message, kinesis says record; the trigger says record for all three |

## .the evidence — the dimensions that make a source a record source

| source | trigger shape | metadata bag | trail carrier | cardinality leaves |
|---|---|---|---|---|
| sqs | `Records[]` | `messageAttributes` | `wrapper` | `perRecord`, `perBatch` |
| sns | `Records[]`, always one | `MessageAttributes` | `none` | one variant (`forSns`) |
| kinesis | `Records[]` | none | `none` | `perRecord`, `perBatch` |
| apiGateway | one request | `headers` | `headers` | — not a record source |
| ask | one payload | none | `wrapper` | — not a record source |

the first three share the record contract (validate per record, acknowledge a caller fault with a
`<source>.record.refused` warn, retry any other throw). the last two do not, so they sit outside.

## .the invariant

every record source has, together:

- a `RecordSource` constant, the data the shared serve reads
- a `genLambdaEndpoint.forX` (a variant, or a `{ perRecord, perBatch }` sub-family)
- an `asLambdaEventSchema.fromX`

the last two are the symmetry law (`rule.require.event-source-symmetry`), clamped by
`src/eventSourceSymmetry.test.ts`.

## .refs

- `src/domain.operations/genLambdaEndpoint/record/RecordSource.ts`
- `src/domain.operations/genLambdaEndpoint/record/genRecordEndpointPerRecord.ts`
- `src/domain.operations/genLambdaEndpoint/record/genRecordEndpointPerBatch.ts`
- `define.lambda-event-source.md` — the wider set this term narrows
