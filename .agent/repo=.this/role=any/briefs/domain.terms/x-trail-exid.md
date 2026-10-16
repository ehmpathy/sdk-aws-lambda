# x-trail-exid

## .the term

`x-trail-exid` — the key, in a transport's `headers` bag, that carries the caller's `trail.exid`.

```
x-trail-exid: exid:3f2c…
```

one key, one form, every bag: an http header, an sqs/sns message attribute. lowercase always.

its **presence** is the contemp opt-in on a reply-awaited family (`invariant.ancient-vs-contemp-callers.md`). on a one-way family it carries the trail alone.

## .the etymology

`trail.exid` is the value, named by `ehmpathy/sdk-logs` (`LogTrail.exid`); the key writes that path in header form.

- `x-` marks a private, non-standard header, so a reader knows no rfc owns it
- `trail` namespaces it to ehmpathy's own term, so no generic proxy sends it by accident
- `exid` names the one field that crosses; the stack never does

precedent: `ehmpathy/sdk-logs` `.behavior/v2026_04_28.trace-id/1.vision.md:281` names `x-trail-exid` for http.

| rejected | why |
|---|---|
| `x-amzn-trace-id` | aws injects it — on every alb request, and on api gateway requests where x-ray is on. read it as the opt-in and real browser requests turn contemp — prod moves |
| `traceparent` | w3c trace-context. otel and proxies forward it, and its shape is a span context, never an exid |
| `x-request-id`, `x-correlation-id` | generic. load balancers mint and forward them, so a stranger's proxy would flip the error body |
| `x-lambda-dialect: contemp` | a second carrier beside the trail — two opt-ins for one transport. meaningless on a one-way family |
| `x-trail` with json `{ exid, stack }` | the stack never crosses (`asFramedPayload.ts` sends `{ exid }` alone). a json value carries a shape no reader reads |
| `x-trail-exid` + `x-trail-stack` | sdk-logs' pair. the stack half has no reader, and sqs caps a message at 10 attributes |
| `trail.exid` | sdk-logs' sqs key. a second form for one concept, and http names with `.` are rare |
| `trail-exid` | rfc 6648 drops `x-`. it would break the sdk-logs precedent for a style point |
| `x-ehmpathy-trail-exid` | `trail` already namespaces it; the org name adds length, no sense |

## .the evidence — dimensional decomposition

the axes a carrier key varies on, and the cell each rejected name sits in:

| axis | values | chosen |
|---|---|---|
| owner of the name | rfc/w3c · aws · generic convention · ehmpathy | ehmpathy — the only owner whose header no stranger sends |
| what it carries | exid · `{ exid, stack }` · a dialect flag | exid — the one field the wrapper already sends |
| keys per bag | one · two | one — one opt-in per transport |
| form across bags | one · per transport | one — sqs keys are case-sensitive, http keys get lowercased, so lowercase-hyphen survives both |

forbidden cells:
- owner = aws or generic → the opt-in flips without intent
- carries = dialect flag → a second opt-in, and dead on one-way families
- keys = two → the second has no reader

## .the evidence — the timeline

1. svc-orders holds `context.log.trail.exid = 'exid:abc'`. it calls svc-invoices' http endpoint via the sdk's api gateway caller
2. the caller spreads the header builder's output into the request: `x-trail-exid: exid:abc`
3. api gateway delivers it — v2 lowercases, v1 passes the case through
4. `forApiGateway` normalization folds the keys lowercase (`headers.md`)
5. trail reads `headers['x-trail-exid']` → `context.log.trail.exid = 'exid:abc'`, contemp
6. a refused body answers nested; a 500's `correlationId` reads `exid:abc`. svc-orders' logs and svc-invoices' share one exid
7. a browser calls the same endpoint with no such header → ancient, fresh exid, flat 400 — as today

## .attributes

| attribute | value |
|---|---|
| key | `x-trail-exid`, lowercase, everywhere |
| value | the caller's exid, a non-empty string |
| bags | http headers (api gateway, cloudfront); sqs/sns message attributes, `DataType: 'String'` |
| absent | ancient (reply-awaited) · fresh exid (all) |
| empty value | treated as absent |
| value bound | 1 to 128 printable ascii characters (`TRAIL_EXID_LENGTH_MAX`), else treated as absent |

the bound exists because the value is written into every log line and error the endpoint emits, and a
stranger controls it. a longer value, or one with a control character, is never adopted: the endpoint
mints a fresh exid and stays ancient. the sender side refuses such a value with a `ConstraintError`, so
a request never opts out in silence. sdk-logs mints a uuid-based exid well inside the bound.

## .invariants

- one key per bag, written `x-trail-exid` in every bag
- the key is lowercase in every write and every read
- its presence, with a non-empty value, is the only opt-in at an aws-delivered family
- the value is an exid within its bound; the stack never rides it
- the sender always supplies the value — the pure header builder mints no exid; the orchestrator above it does
- no generic or aws-owned header is ever read as the opt-in

## .enforcement

- a second key or a second form for the trail in any bag = **blocker**
- a capitalized `X-Trail-Exid` written or read anywhere in this sdk = **blocker**
- a generic correlation header (`x-amzn-trace-id`, `traceparent`, `x-request-id`) read as the opt-in = **blocker**
- a stack or a dialect flag sent in the value = **blocker**

## .see also

- `headers.md` — the bag this key rides
- `trail.md` — the value it carries
- `invariant.ancient-vs-contemp-callers.md` — what its presence means, per family
