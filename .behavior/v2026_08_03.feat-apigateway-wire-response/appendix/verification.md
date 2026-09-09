# appendix — verification

> every claim in `1.vision.yield.md` that rests on evidence rather than reason. cited from the
> yield at the decision it supports.

## empirical probe — what the extant chain actually emits

a read of the middleware is not proof of what it emits, so the extant `forApiGateway` was **run**.
one throwaway probe, since deleted.

| # | measured | drives |
|---|---|---|
| 1 | a handler that returns `'<Response><Say>aloha</Say></Response>'` emits `body: "\"<Response>…\""` with `Content-Type: application/json` — the exact pair twilio rejects with 11200 | the serializer decision; the "xml verbatim" row |
| 2 | `normalizeHttpResponse` defaults an absent status to **500** | why `{}` must be unrepresentable, and why the sdk defaults `status ?? 200` itself |
| 3 | the chain already emits a body-less response when a handler returns `undefined`: `{ statusCode: 200, headers: {...} }`, no `body` key | body-less output is not new machinery; only the *choice* of status and headers is |
| 4 | error responses carry **no** security headers — the 500 emitted only `Content-Type` | the out-of-scope find; F3 |

⚠️ **row 4's OBSERVATION held; the CAUSE i wrote beside it was false, and it stood for four
iterations.** i wrote *"because `httpSecurityHeaders` registers `after`, never `onError`"*. it registers
**both** (`http-security-headers/index.js:255-256`), and so does `@middy/http-cors`
(`http-cors/index.js:58-61`). the real cause is the hook-order reversal — both are registered after the
error builders, so their `onError` runs first, meets `request.response === undefined`, and no-ops. this
is F32, and the correction is a third instance of the family the stone's own rules name: **a measured
observation, paired with an inferred cause, where the cause was never measured.** the fix for that
class is `rule.require.sweep-the-defect-class`.

`statusCode ??= 500` confirmed in the installed `@middy/util@4.7.0` source.
`httpResponseSerializer` skip-when-`Content-Type`-preset confirmed in its installed source.

### the body-less response — the vision's own row, falsified

⚠️ the vision's edgecase table originally read *"handler omits `body` on a 204 → sdk emits
`body: ''`, since `APIGatewayProxyResult.body` is a required string."* that row rested on the AWS
type alone, never on a run. `.temp/probe.emptyBody.ts` ran the chain three ways:

| the logic returns | the wire carries | why |
|---|---|---|
| `body` omitted | `body: undefined` (the KEY is present, added by `normalizeHttpResponse`) | ✅ the correct wire form |
| `body: ''`, no `Content-Type` | `body: '""'` | ⛔ the serializer `JSON.stringify`d the empty string |
| `body: ''`, `Content-Type` preset | `body: ''` | the serializer returns early, so `''` survives |

so `body: ''` is only safe where the handler already set a `Content-Type` — and a 204 must not
carry one. **omission is the sole correct form**, which makes `body` genuinely optional on
`outputAfter`. the row is corrected in the yield, and `ApiGatewayResponsePayload` now declares
`body?: string` rather than let a cast hide the divergence from AWS's required-`string`.

## type-level probe — variance and the structural bind

`.temp/probe.variance.ts`, four cases compiled:

| case | result | drives |
|---|---|---|
| 2 | `never` in a **parameter** slot is contravariant and **accepts every function** | why the alias union + its `never` default were a footgun; F21 |
| 4 | a bag that omits one member fails the `extends` clause — **TS2344** | the structural bind is real, not asserted; F16 |

`never` CLOSES a union but OPENS a parameter slot. the tri-state removes every `never` from the
shape, so the hazard is gone rather than documented.

## external doc checks

> **method note.** `WebFetch` was credential-gated (`🔐 XAI_API_KEY locked`), so doc claims were
> verified via `WebSearch` summaries that quote those pages. the one external fact that drives a
> design decision is cross-checked against a source on disk.

- **api gateway proxy response format** — [AWS docs](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html):
  output is `{ isBase64Encoded, statusCode, headers, multiValueHeaders, body }`; headers may be
  omitted; a 204 uses `body: ""`.
  **cross-checked on disk:** `APIGatewayProxyResult.body` is a **required `string`** while
  `APIGatewayProxyStructuredResultV2.body` is optional
  (`@types/aws-lambda/trigger/api-gateway-proxy.d.ts:154-166, 320-330`) — which also proves the two
  versions' **output** shapes are not interchangeable, though this repo normalizes their **inputs**.
- **twilio** — [webhooks overview](https://www.twilio.com/docs/usage/webhooks/webhooks-overview),
  [error 11200](https://www.twilio.com/docs/api/errors/11200): inbound sms/voice expects TwiML xml;
  an empty 200/204 is acceptable when no reply is needed; **a `Content-Type` that does not match the
  body raises 11200**.
- **308 + `Location`** — standard http (RFC 7538). no repo-specific constraint.
- **`PickAny`** — verified in `ehmpathy/type-fns:src/types/PickAny.ts`, exported from its index; its
  own doc says it requires at least one key, or more. **not currently a dependency here** — zero
  `type-fns` imports in `src/`, absent from `package.json`. drives F11.
- **declastruct api-gateway support** — verified **absent** by exhaustive content search:
  `apigateway` (case-insensitive) returns **zero** matches across all of
  `node_modules/declastruct-aws/dist`. the search was calibrated first — the same grep for
  `DeclaredAwsLambda` returns 5 files — so the zero is trustworthy. drives F4 and
  `declastruct-aws#90`.

## vocabulary greps

| term | count in `src/` | reads as |
|---|---|---|
| `response` | **402** across 50 files | the value that goes back — the repo's own term |
| `result` | 701 across 51, but overwhelmingly `const result =` in tests + AWS's `result.Payload` | test-local noise, not domain vocabulary |
| `payload` | bidirectional — `sdkLambdaInvoke.ts:10,39` (a **response**), `asLambdaEndpointSchema.ts:6`, `LambdaIntrospectionNotSupportedError.ts:7`; and `WrappedPayload<TInput>` / `FlatPayload<TInput>` inbound | the wire-side representation, either direction |
| `event` | inbound only, post-translate | what `invoke({ event })` receives |
| `translate` | `logTranslate`, `IoLogTranslate`, `translateInput`, `translateOutput` (`genIoLoggerMiddleware.ts:3,17,23-25`) | extant vocabulary — grounds `Translator` |
| `member` | **6**, all local variables inside codegen that emits TypeScript object literals (`getTypescriptFromJsonSchema.ts:97`, `asResourceClassSource.ts:98,117`) | syntax jargon, never a domain term — why `TranslateMember` was cut (F24) |
| type parameters | **2** in the whole repo: `TInput`, `TOutput` | the invented set once outnumbered the real one 2:1 (F15) |
| `as*` transformers | 16, of which **14** take a destructured `input` object | why `asApiGatewayResponseSchema({ body })` is named, not positional |

the two positional `as*` exceptions — `asContractRecord(contracts)`, `asCacheWithoutSet(cache)` —
each take **the whole subject** they cast, which is the one case a positional reads honestly.

## the code sites this design touches

| claim | site |
|---|---|
| the hardcoded wire encode — the root defect | `genLambdaEndpoint.forApiGateway.ts:168-171` |
| the `as`-cast that asserted `inputAfter` ≡ a field of the envelope | `genLambdaEndpoint.forApiGateway.ts:158` |
| `IoLogTranslate` declared inline in both families | `forAskEndpoint.ts:58,90`; `forApiGateway.ts:69,132` |
| the trail read yields **three** values, so it cannot be replaceable | `getUnwrappedEventWithExid.ts:13-17` |
| `LambdaHandlerInput<TInput>` derives the payload from the input — the extant conflation | `forAskEndpoint.ts:35-37, 93-98` |
| `ApiGatewayResponse` already declared, as the **wire** shape | `genConstraintErrorMiddleware.ts:11-15` |
| the 400 body already carries errorMessage / errorType / causeMessage | `getErrorResponseBody.ts:50-63` |
| the 400 leaves the invocation a SUCCESS — `onError` sets `request.response`, never rethrows | `genConstraintErrorMiddleware.ts:55-68` |
| the 500 never echoes `error.message` | `genInternalServiceErrorMiddleware.ts:46-54` |
| introspection requires an object, so a form-encoded body never triggers it | `genIntrospectionMiddleware.isIntrospectionPayload.ts:6` |
| `HttpStatusCode` ships `NO_CONTENT_204` but not 308 | `HttpStatusCode.ts:12-17`, exported at `src/index.ts:18` |
| the unqualified variant export that forced its peer into a bare name | `src/index.ts:45` and `:56` |
| api-gateway callers are always **ancient** — the trail middleware sees no wrapper | `forApiGateway.ts:196-197`, `genTrailMiddleware.ts:24-27` |
| …and behaviorally: `expect(body.errorType).toBe('BadRequestError')` already passes | `genLambdaEndpoint.forApiGateway.test.ts:114` |

## coverage the design owes

| what | why it is new, not an update |
|---|---|
| a custom `payload.input` that still yields a correct `exid` and `isContempCaller` | the invariant the namespace must not break |
| a `translate.log` default that keeps a PII body out of the log record | F10's default is a new guarantee |
| `payload.output` absent → `{ status: 204 }` still lands as 204 with the body ABSENT | proves the default encode runs (`body: ''` was the falsified form — see above) |
| `payload.output` = a redaction wrapper → field stripped **and** the encode still ran | the footgun at awkwardness #4 |
| `payload.output: false` → `invoke` returns the wire payload, bytes untouched | adapter parity |
| a `.test-d.ts` (or expect-error fixture) for `{}` and for an omitted shape | both are **compile-time** promises; a runtime suite cannot verify either |

the extant suites both move: all 10 `forApiGateway` cases for the return type, and the
`forAskEndpoint` suite for the `logTranslate` → `translate.log` rename. `[case6]`
(`forApiGateway.test.ts:251-277`) is rewritten against the translator's option form.

## the wire-byte harness — what it proves and what it cannot

**proves:** at *this adapter's* boundary the bytes are right — a `node:http` server applies the
documented proxy map, hit with real `fetch`, asserts `res.status === 204` with
`await res.text() === ''`, `res.headers.get('location')` on a 308, and byte-identical xml with its
own content-type.

**cannot prove:** that AWS implements the map as documented — the map under test is this repo's own
code.

**why the limit is accepted:** `declastruct-aws` ships no api-gateway resource (verified above), so
deployed proof would mean a hand-rolled declaration outside this bound. per the wisher: *"an
acknowledged limit beats a silent one."* the limit now carries an exit —
`ehmpathy/declastruct-aws#90` asks for a rest/http-api resource, a route that targets a
`DeclaredAwsLambda`, a stage, and the invoke permission. once it ships, this test promotes from
local to deployed and the caveat is deleted.

### as built

- `src/__test_assets__/genApiGatewayProxyHarness.ts` — a `node:http` server that applies the proxy
  map, plus `getOneWireResponse` which reads one real request into plain data
- `blackbox/local.wireResponse.acceptance.test.ts` — 10 assertions across the three shapes plus the
  convenient default

**one harness constraint worth a note:** `useBeforeAll` hands back a PROXY that defers property
access, and a native `Response` cannot survive it — status reads `undefined` and `.clone` is not a
function. so the bytes must be read *before* the value is shared, which is why
`getOneWireResponse` returns `{ status, headers, text }` rather than the `Response` itself.

### the clamps, dogfooded

per `rule.require.clamp-edge-cases`, each clamp was proven to bite — reverted, watched go red,
restored, watched go green:

| the clamp | the defect reintroduced | it went red as |
|---|---|---|
| `@ts-expect-error` on `invoke: async () => ({})` | `PickAny` → `Partial` | **TS2578** unused directive, in `test:types` |
| `local.wireResponse.acceptance.test.ts` | the encode → `{ statusCode: 200, body: … }` | 204→200; 308→200 with no `Location`; xml→`"\"<Response>…\""` — the exact twilio-11200 pair the wish reported |

the second revert left `[case4]` (body-only, the convenient default) **green**, which is the
evidence that the widen adds a capability rather than moves the extant path.

---

## who reads `request.event` — the grep behind F31

the vision assigned `inputAfter` to no particular slot, and the natural middy seam for an input
translator is `request.event = translate(request.event)`. that seam is unavailable, and the reason
is a **read**, never a type:

| package | reads `request.event`? | the lines |
|---|---|---|
| `@middy/http-cors` | **yes** — in `after` | `index.js:38` and `:106` derive the http method from `request.event`; `:83` reads `request.event.headers` |
| `@middy/http-security-headers` | **no** | touches only `request.response` — `index.js:237,239,246,251` |

so an overwrite of `request.event` starves cors, and cors then emits **no headers at all** — an
absence, never an error. it surfaced because `[case3]` asserts cors headers are *present*; a suite
that asserted only status and body would have shipped the widen with cors silently dead.

⚠️ **the first draft of this note claimed BOTH packages read it.** that claim came from the two
packages' shared role in the chain, never from a grep, and it reached two code comments before this
table was built. the constraint stands on cors alone — one vendor reader is enough to make the slot
untouchable — but the false half is the defect, and it is why
`rule.require.read-the-slot-a-dependency-reads` exists.

```
# the commands, re-runnable after any middy bump
rhx grepsafe --pattern 'request\.event' --glob 'node_modules/@middy/http-cors/index.js'
rhx grepsafe --pattern 'request\.(event|response|internal)' --glob 'node_modules/@middy/http-security-headers/index.js'
```
