# headers

## .the term

`headers` — the field on `invoke`'s input that holds **the metadata bag beside the body**.

```ts
headers: ApiGatewayRequestEventUnified['headers']   // Record<string, string | undefined>, keys lowercased
```

at api gateway it is the **same object** as `event.headers` — a projection, never a copy.

## .the etymology

http's own word, and already the field name on the envelope. the open question was never the word
but whether it earns a slot of its own.

## .the evidence — why one field earned a lift

measured on `ahbode/svc-gateway`, the sdk's largest consumer:

| read | files | lines |
|---|---|---|
| `rawEvent` at all | 78 | 268 |
| `rawEvent.headers` | 65 | 129 |
| `rawEvent.httpMethod` / `.path` / `.queryStringParameters` / `.pathParameters` / `.requestContext` | 0 | 0 |

83% of the files that touch the envelope touch it for headers alone; every other field scores zero.
the positive control: the same query form returns 129 and 268 for the first two rows, so the zeros
are real.

## .the validator writes back — and headers MERGE

`headers` stays a projection only while the validator writes into the envelope rather than parse
into a side bag. `genZodInputValidationMiddleware` writes the two slots differently:

| slot | write | why |
|---|---|---|
| `payload` | replace — `event.payload = result.data.payload` | the body is wholly the handler's |
| `headers` | **merge** — `event.headers = { ...event.headers, ...result.data.headers }` | zod strips undeclared keys, and `@middy/http-cors` reads `origin` from this slot |

the merge is required. a replace strips `origin`, and with `origins: [a, b]` cors then answers
`origins[0]` to a caller from `b` (`@middy/http-cors/index.js:2-14`), so the browser refuses a
response the sdk allowlisted. clamped by `[case17]` (no headers declared) and `[case18]` (partial
declaration, two origins); `[case3]` cannot tell, since its one-entry allowlist makes echo and
fallback equal.

an author who declares no `headers` gets `result.data.headers === undefined`, and a spread of
`undefined` is a no-op — one rule, both arms.

⛔ a pre-parse default for absent keys does **not** work: zod strips by the schema's shape, so a key
absent from the shape is stripped whatever value you feed in.

## .keys are lowercased, both api-gateway arms

```ts
headers: asHeaderKeysLowercased({ headers: input.wire.headers }),
```

rfc 9110 §5.1: http field names are case-insensitive.

the hazard it closes is live: callers send `Authorization:` capitalized, api gateway v1 passes the
case through and v2 lowercases it — so a handler that indexes one case is green on one version and
broken on the other. `@middy/http-response-serializer` reads `headers?.Accept ?? headers?.accept`
(`index.js:25`), a vendor that has met both. the fold makes one read correct on both.

## .optional key — enforcement is opt-in

```ts
input: z.object({
  headers: z.object({ authorization: z.string() }),   // optional key
  payload: z.object({ to: z.string() }),              // required key
})
```

`payload` is required because 78 sites already get body validation; `headers` is optional because
headers were never validated. so no request that succeeds today can be refused.

## .footgun 1 — `.strict()` refuses all traffic

the sdk hands the **whole wire bag** to the parse, and api gateway always injects keys no author
declares (`host`, `x-forwarded-for`, `x-amzn-trace-id`):

```ts
headers: z.object({ authorization: z.string() }).strict()   // ⛔ 400s every request
headers: z.object({ authorization: z.string() })            // ✅
```

| slot | who else writes into it | `.strict()` safe? |
|---|---|---|
| `headers` | api gateway; middy vendors read it | ⛔ no |
| `payload` | no one | ✅ yes |
| `schema.output` | no one (validated before the wire widens it) | ✅ yes |

the failure is loud and total, so the remedy is the error message: `getValidationError` names the
fix (`[case5]`, `[case6]`). a doc that says the schema governs *only* the keys it declares, with no
note that the parse sees the whole bag, is what makes `.strict()` look harmless.

## .footgun 2 — `.optional()` on the bag is inert

```ts
headers: z.object({ k: z.string() }).optional()   // ⛔ k stays required
headers: z.object({ k: z.string().optional() })   // ✅
// or omit the `headers` key                      // ✅ validate no header
```

the sdk always supplies a `headers` object (`{}` when the transport carried none), so an outer
`.optional()` only fires on `undefined`, which never arrives. both parse sites supply it
unconditionally — `genZodInputValidationMiddleware.ts` and `setSqsRecordValidated.ts`; the control
`genZodEventValidationMiddleware.ts` has no `headers` slot.

stakes are worse at sqs: a validation failure fails the invocation, so the message redrives and
dead-letters. a fixture whose messages all carry the header cannot tell the two forms apart — only a
message with **no** attributes can. clamped by `forSqs.perRecord` `[case9]`; move `.optional()` onto
the object and `[case9]` goes red.

## .the reach — any transport that carries a bag

| family | the bag |
|---|---|
| `forApiGateway` | http headers, lowercased |
| `forSqs.*` | the sender's `messageAttributes`, keys verbatim (sqs names are case-sensitive) |
| `forAsk` | — a direct invoke carries no metadata bag |

http, kafka, and amqp call it headers; mqtt v5 calls it user properties; sqs and sns call it
`messageAttributes`. one concept, one word here.

## .`trail` is not `headers`

`headers` is the raw bag; `trail` is one reconciled value lifted out of whatever bag held it (see
`trail.md`). to rename one to the other is a synonym-collapse. the test is *"is it the same
concept?"*, never *"is the value reachable another way?"*.

## .invariants

- `headers` **is** `event.headers` — one reference, never a copy
- the validator merges back into the envelope; never a side bag, never a replace
- api-gateway keys are lowercased; sqs keys are verbatim
- the bag is deep-frozen at the hand-off
- a further field lifted out of the envelope owes its own measured reach, with a positive control

## .enforcement

- `headers` fed from a source other than `event.headers` = **blocker**
- a header validator that parses into a side bag, or **replaces** rather than merges = **blocker**
- a pre-parse `headers` default offered as the cure for the strip = **blocker** (inert)
- a capitalized header key indexed anywhere in this sdk = **blocker**
- a verbatim api-gateway passthrough in place of the fold = **blocker**
- another envelope field lifted with no measured reach = **blocker** (`rule.require.widen-before-parallel`)
- a doc that says the schema governs only declared keys, with no note that the parse sees the whole bag = **blocker**
- a `.strict()` header schema, or `.optional()` on the header object, in any example, doc, or fixture = **blocker**
- a fixture that declares an optional header and only sends messages that carry it = **nitpick**

## .see also

- `event.md` — the envelope and the freeze
- `payload.md` — the peer projection
- `trail.md` — the value lifted out of this bag
- `rule.require.read-the-slot-a-dependency-reads` — why `headers` is the only slot that merges
