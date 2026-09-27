# payload

## .the term

`payload` — **the body of a message**, parsed and validated.

```ts
invoke: ({ headers, payload, event }) => …
//                  ^ the body the handler acts on
```

## .http's sense governs, never aws's

| source | "payload" means |
|---|---|
| http (rfc 9110, *"payload body"*) | the body — this repo's sense |
| aws (`InvokeCommand.Payload`) | the whole message bytes |

> *"http = api gateway, we treat the body as the payload, event is the whole object"* — the wisher

the transport form is qualified `Onwire` (`ApiGatewayRequestEventOnwire`, `ApiGatewayResponseOnwire`),
never suffixed `Payload`. `Onwire` names a position, as `Unified` names a reconciliation.

| rejected | why |
|---|---|
| `body` | narrower, and leaves `payload` free to be overloaded. it survives as aws's key on `ApiGatewayResponseOnwire` — the rename stops at the wire |
| `event` | taken for the whole object (`event.md`) |
| `data` | vague, no domain source |
| `input` | the `(input, context)` contract owns it |

## .the pipeline

```
ApiGatewayRequestEventOnwire ──▶ ApiGatewayRequestEventUnified ──▶ payload
   the wire form                   the whole object, reconciled      the body, parsed + validated
```

## .`event.payload` holds the validated value

```ts
payload === event.payload   // one object, two paths
```

the chain writes the validated value back (`genZodInputValidationMiddleware` —
`event.payload = result.data.payload`), so the envelope carries the wire string at `_.raw.body` and
the validated body at `payload`, and naught between. that one slot removes the `as`-cast the
hand-off once needed, and keeps `payload` a projection exactly as `headers` is.

`forAsk` holds the same projection by another route: its validator builds the envelope after the
parse (`genZodEventValidationMiddleware` — `{ payload: result.data, _: { raw } }`), so its
`payload` slot is the validated body from the start.

break the write-back and a validated value sits beside an unvalidated one under one name — the
two-types trap.

## .invariants

- `payload` is the body, parsed and validated
- `payload` **is** `event.payload` — never a copy, never a second parse
- `payload` never names the whole message; that is `event`
- no `*Payload` type suffix for a wire form; that is `*Onwire`

## .enforcement

- `Payload` as a type suffix for a wire form = **blocker**
- `payload` for the whole message or envelope = **blocker**
- an unvalidated parsed body exposed anywhere = **blocker**
- a validator that parses into a side bag rather than writes back = **blocker**
- an envelope with no `payload` slot = **blocker**
- ⚠️ known exemptions: `WrappedPayload<TInput>` and `FlatPayload<TInput>` in `forAsk` name a
  whole wire object in aws's sense — the two arms of `LambdaHandlerInput`

## .see also

- `event.md` — the whole object
- `headers.md` — the peer projection and the shared write-back
- `rule.forbid.as-cast` — the cast the envelope's slot deletes
