# records

## .the term

`records` — the field on `genLambdaEndpoint.forSqs.perBatch`'s `invoke` input that holds **the
messages of one batch that passed validation**, each decoded, in delivery order.

```ts
invoke: ({ records, event }, { log }) => …
//         ^ SqsRecordDecoded<…>[]
```

## .the etymology

aws's word at this boundary, lowercased. the trigger hands over `{ Records: [ … ] }`, each element
an `SQSRecord`. sqs's own api says *message* one layer up (`SendMessage`, `messageId`); this sdk
stands at the lambda layer, so it speaks the key it reads.

| rejected | why |
|---|---|
| `messages` | names what the producer sent; the trigger delivers records |
| `items` | a container-word; aws uses it only for failure refs (`itemIdentifier`) |
| `batch` | names the collection, and `perBatch` already spends the word |
| `payloads` | narrower than the value — each element has four slots |
| `events` | taken for the whole object (`event.md`) |

## .the reach — `perBatch` alone

| family | carries `records`? | why |
|---|---|---|
| `forSqs.perBatch` | ✅ | N messages per invoke |
| `forSqs.perRecord` | ⛔ | cardinality 1; lifts the one record's `headers` / `payload` instead |
| `forApiGateway`, `forAsk` | ⛔ | one message per invoke |

both sqs variants still receive `event.records`.

## .a subset, not a projection

every other lifted field equals its envelope slot. `records` is the survivors:

```ts
records.length <= event.records.length
```

a refused record has no valid `payload`, so to include it would put an unvalidated value under a
name that promises a validated one. a refused record is never a success, so it is always retried;
a handler that claims one from `event.records` is refused (`[case9]`).

the subset is a **filter**, so identity survives:

```ts
records[i] === event.records[j]   // every survivor; clamped by [case1] with toBe
```

a copy would read identical and diverge on the first write; only an identity check can tell.

## .one record

```ts
interface SqsRecordDecoded { id; headers; payload; _: { raw: SQSRecord } }
```

| key | sense | vendor's name |
|---|---|---|
| `id` | the message id sqs issued | `messageId` |
| `headers` | the sender's `messageAttributes`, flattened, keys verbatim (sqs names are case-sensitive) | `messageAttributes` |
| `payload` | the body, parsed and validated | `body` |
| `_` | `{ raw }` — `receiptHandle`, `attributes`, `md5OfBody`, the typed attribute bag | — |

## .the answer names successes, so it fails safe

```ts
invoke: async ({ records }) => ({ successes: recordsThatSucceeded })
```

`SqsRecordSuccessRef` is `{ id: string }`, and a record satisfies it as-is. every record not named
is retried, so a forgotten record redrives rather than vanishes (`[case4]`). an answer the sdk
cannot read — no array, an entry with no `id`, an id it did not hand over — throws, so the whole
batch is retried (`[case9]`, `[case11]`, `[case16]`).

⚠️ the inverse contract, `{ failures }`, fails open: a forgotten failure is deleted.

## .invariants

- `records` is the validated subset — never the whole batch; that is `event.records`
- `records` is a filter over `event.records`, never a copy
- `records` is deep-frozen with the envelope
- only `forSqs.perBatch` names it
- record `headers` keys are verbatim
- the vendor array is at `event._.raw.Records`

## .enforcement

- `records` for the whole delivered batch = **blocker**
- a copy of the members in place of a filter = **blocker**
- `records` on a variant whose invoke carries one message = **blocker**
- a capitalized `Records` indexed off the decoded shape = **blocker**
- a case-fold on an sqs record's `headers` = **blocker**
- a batch answer that lists failures rather than successes = **blocker** (it fails open)
- a doc or example that returns bare ids or a hand-built ref from `successes` = **blocker**

## .see also

- `event.md` — the object `records` is drawn from
- `payload.md`, `headers.md` — the two slots each record carries
- `rule.require.consistent-variant-contracts` — the superset `records` belongs to
- `rule.require.frozen-invoke-inputs` — why one freeze seals both routes
