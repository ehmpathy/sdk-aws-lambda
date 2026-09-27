# event

## .the term

`event` — the field on `invoke`'s input that holds **the whole object that arrived**.

```ts
invoke: ({ headers, payload, event }) => …
//                           ^ FrozenDeep<ApiGatewayRequestEventUnified<…>>
```

for api gateway, v1/v2 are reconciled onto six keys — `method · headers · payload · codec · params
· _` (see `.readme.md`). the un-reconciled wire union sits at `event._.raw`; the url path string,
the request context, and the raw body string are reachable only there.

## .the etymology

aws's word. every lambda is `(event, context) => …`, and `event` is what aws calls the object any
trigger hands over. the sdk speaks the vendor's term for the vendor's slot.

| rejected | why |
|---|---|
| `request` | over-promises (no `cookies`, no `multiValueHeaders`); stutters (`request.requestContext`); invented; false at sqs, where one invoke carries N messages; and it rejects the vendor's word, which the case for `payload` relies on |
| `payload` | taken for the body (`payload.md`) |
| `rawEvent` | the value is reconciled, so *raw* is false |
| `envelope` | a mechanism-word with no domain source |

## .one sense, every family

| family | `event` | `payload` |
|---|---|---|
| `forApiGateway` | the reconciled http event | the validated body |
| `forAsk` | `{ payload, _: { raw } }` — the invoke with its wrapped/flat formats reconciled | the validated body |
| `forSqs.perRecord` | the sqs event, records decoded | the one record's body |
| `forSqs.perBatch` | the same | — per record: `records[i].payload` |

the cardinality question at sqs is settled by the variant name (`perRecord` / `perBatch`), not by
the word.

the sense is clamped: `InvokeInputSuperset`'s sense gate refuses an `event` that is not an envelope
which holds the body at `event.payload` or `event.records[i].payload`.

## .the overload inside middy

| site | holds | reach |
|---|---|---|
| `input.event` on a handler | the reconciled envelope | public — this brief's sense |
| `request.event` inside middy | whatever occupies middy's slot | sdk middleware only |

an sdk contributor who edits middleware holds both, e.g. `asInputAfter: (request) =>
request.event?.payload` in `genLambdaEndpoint.forApiGateway.ts`. cite a greppable symbol, never a
bare `file:line`.

## .projections

`headers === event.headers` and `payload === event.payload`. the validator writes the validated
value back into the envelope, so there is no unvalidated parsed body anywhere; the wire string is at
`event._.raw.body`, behind the `_` that marks it off the paved path.

## .the envelope is deep-frozen at the hand-off

```ts
event: FrozenDeep<ApiGatewayRequestEventUnified<{ headers: THeaders; payload: TPayload }>>
```

`FrozenDeep`, never `Readonly` — typescript's `Readonly` is shallow, so `event.headers.x = 1` would
type-check and then throw against the deep runtime freeze.

every family freezes through one `setEventFrozen`, because the envelope outlives the handler's turn
and a write through it corrupts what someone reads after `invoke` returns:

| family | a vendor reads it after | the sdk reads it after |
|---|---|---|
| `forApiGateway` | `@middy/http-cors`, `…response-serializer` (`after` hooks) | — |
| `forAsk` | — | — (frozen anyway, for parity; `[case11]`) |
| `forSqs.perBatch` | — | the failed ids, read off `event.records` (clamped by `[case17]`) |
| `forSqs.perRecord` | — | — (frozen anyway, for parity with its twin; `[case16]`) |

a freeze beats a defensive copy: both remove the mutation hazard, but a copy breaks
`headers === event.headers` and re-opens drift between bag and envelope.

measured safe: every sdk write to `request.event` is a `before` hook, and the installed `@middy/*`
packages read it 8 times and write it 0. the one exception, `@middy/http-json-body-parser`, writes
`request.event.body` and is imported nowhere in `src/` — the sdk parses the body itself.

## .invariants

- `event` is the whole object that arrived — never the body, never the wire form
- every `genLambdaEndpoint.*` family names that field `event`
- `event` is deep-frozen at the hand-off in every family, typed `FrozenDeep`
- the envelope carries no unvalidated parsed body; a handler reads its body from `payload`

## .enforcement

- `event` for a body or a wire form = **blocker** (that is `payload` or `*Onwire`)
- a family that renames its whole-object field away from `event` = **blocker**
- a handler that re-parses `event._.raw.body` where `payload` serves = **blocker** (bypasses the schema)
- a defensive copy in place of the freeze = **blocker**
- a middy plugin that writes `request.event` = **blocker** (it meets a frozen object)
- a runtime freeze handed over with the un-narrowed type = **blocker**
- a new post-invoke read of the envelope = check the freeze table above first
- `request` proposed for an envelope = **blocker**

## .see also

- `payload.md`, `headers.md` — the projections
- `rule.require.frozen-invoke-inputs` — the family-wide freeze
- `rule.require.read-the-slot-a-dependency-reads` — the vendor grep the freeze rests on
