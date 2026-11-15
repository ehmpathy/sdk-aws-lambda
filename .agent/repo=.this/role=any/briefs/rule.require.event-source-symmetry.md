# rule.require.event-source-symmetry

## .what

every event source this package serves has **both halves**, in one shape:

| half | family | asks |
|---|---|---|
| endpoint | `genLambdaEndpoint.forX` | serve this source's event as a handler |
| schema | `asLambdaEventSchema.fromX` | validate this source's event inside a handler you wire yourself |

a source with one half and not the other is a defect, unless it sits on the declared one-sided
list below with an axis that explains why its other half cannot exist.

## .the sources, as they stand

| source | endpoint | schema |
|---|---|---|
| sqs | `forSqs.{perRecord, perBatch}` | `fromSqs` |
| sns | `forSns` | `fromSns` |
| kinesis | `forKinesis.{perRecord, perBatch}` | `fromKinesis` |
| apiGateway | `forApiGateway` | ⛔ one-sided |
| ask | `forAsk` | ⛔ one-sided |

## .one consistent shape

symmetry is more than a key pair. the record sources share one contract:

- `schema.input` describes **one record's** slots: `{ headers?, payload }`, or `{ payload }` at
  kinesis, which carries no metadata bag
- `invoke` gets that record's slots plus the whole `event`, or the `records` that passed plus the
  whole `event` at a `perBatch` leaf
- a caller fault is acknowledged with a `${source}.record.refused` warn line; any other fault
  escapes, so the source redelivers
- the cardinality is the trigger's: a source that delivers N records per invoke (sqs, kinesis) is a
  sub-family with `perRecord` and `perBatch` leaves; a source that delivers one (sns) is a plain
  variant, since a sub-family of one leaf is a variant with an extra hop

⇒ the slot vocabulary is clamped by `rule.require.consistent-variant-contracts`; this rule clamps
the **set of sources**.

## .the declared one-sided list

| source | the half it lacks | axis |
|---|---|---|
| ask | `fromAsk` | a direct invoke has no envelope: the event IS the payload, so `fromAsk(schema)` would equal `schema` |
| apiGateway | `fromApiGateway` | `forApiGateway` validates its own reconciled v1/v2 input; a schema of the raw event would be a second, unreconciled path to the same handler (`rule.forbid.parallel-codepaths`) |

🟡 a list entry is a **claim that one half cannot exist**. so the clamp goes red on a stale
entry too — a source on the list that has gained its absent half, or a source on the list the
package no longer serves.

## .the test — for the proposer

before you add a source to either family, ask: **"does its other half exist, and if not, which
axis forbids it?"**

| answer | verdict |
|---|---|
| both halves ship together | ✅ |
| the other half follows in this pr | ✅ |
| an axis forbids the other half | add the source to the one-sided list, with the axis |
| neither | ⛔ ship the other half first |

## .the test — for the reviewer

- a `forX` key with no `fromX` key, or the reverse, with no list entry = **blocker**
- a list entry with no axis, or an axis that is a preference rather than an impossibility =
  **blocker**
- a list entry whose source now has both halves = **blocker** (the clamp catches it)

## .the clamp

`src/eventSourceSymmetry.test.ts` reads the runtime key sets of both families, off the public barrel,
pairs `forX` with `fromX` by source, and asserts the one-sided set is exactly the declared list.

## .not in scope

`asLambdaEvent` — the test-factory family — is a third face of the same axis, and it reaches a
source neither family serves (`fromS3`). a factory builds a fixture, so it is not bound to the pair;
a source gains an endpoint and a schema together or not at all.

## .see also

- `define.lambda-event-source.md` — what an event source is
- `domain.terms/genLambdaEndpoint.md` · `domain.terms/asLambdaEventSchema.md`
- `rule.require.consistent-variant-contracts.md` — one vocabulary across the variants
- `rule.forbid.unqualified-variant-exports.md` — every variant rides on its family
