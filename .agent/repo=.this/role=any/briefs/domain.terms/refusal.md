# refusal

## .the term

`refusal` (noun) · `refused` (state) — **an endpoint declines a request as a caller fault**: the
request is wrong, the endpoint is fine, and a retry of the same bytes fails the same way.

| shape | name | where |
|---|---|---|
| the error an asker throws when a peer refuses | `LambdaEndpointRefusedError` | `[...noun][state]`: the endpoint, refused |
| the asker's opt that names that error's class | `LambdaEndpointRefusal` — `{ as }` | `askLambdaEndpoint`, `.viaApiGateway` input key `refusal` |
| an sqs message the schema declines | `sqs.record.refused`, `logSqsRecordRefused` | `forSqs.*` |
| the cast from a peer's verdict | `asErrorFromPeerRefusal` | both ask roads |

## .the etymology

the repo already said `refused` for one sense — the sqs family's `sqs.record.refused` line, written
when an endpoint declines a message as the producer's fault. a peer that answers `ConstraintError` or
`BadRequestError` does exactly that to its asker, so the word carries over with no second sense.

| rejected | why |
|---|---|
| `rejected` | a promise rejects on any fault, a server fault included; it cannot tell a refusal from a crash |
| `constraint` / `ConstraintError` | names the class a caller fault wears *at the endpoint that holds it*. the whole defect was that a peer's constraint wore the asker's class; a second sense for the same word is the bug, renamed |
| `badRequest` | http's word for one status; the invoke road has no status, and the ancient name the repo retires |
| `declined` | true, but unused here; `refused` already holds the sense |
| `peerError`, `downstreamError` | name the position, not the verdict; a peer's crash is also a peer error, and stays `LambdaEndpointError` |

## .the evidence — the narrative

svc-gateway asks svc-notifications to send an email it composed. svc-notifications answers
`ConstraintError: template id absent`. that is a **refusal**: svc-notifications is healthy, and the
request was wrong. whose fault? not the browser's — it sent a valid form. svc-gateway built the bad
request, so the refusal is svc-gateway's own malfunction. thrown as svc-gateway's `ConstraintError`, it
became a 400 the browser could not fix, and it hid from every alarm (sdk-aws-lambda#77: 24 prod
failures).

the narrative fixes the two facts the term encodes:
- a refusal is a verdict **about the request**, made by the endpoint that received it
- whose fault it is depends on **who composed the request**, which only the asker knows. so the
  asker names the class (`refusal: { as }`), and the default assumes it composed the request

## .the evidence — the decomposition

| who composed the request the peer refused | the asker should throw | opt |
|---|---|---|
| the asker itself (the common case) | `LambdaEndpointRefusedError` — a `MalfunctionError`; its caller gets a 5xx | default |
| the asker's own caller, forwarded verbatim | `ConstraintError` — its caller gets the 4xx | `{ as: 'ConstraintError' }` |
| the test author, via `runLambdaEndpoint.onSerialized` | `ConstraintError` — no peer stands between | fixed by the runner |

## .invariants

- a refusal is a caller fault **at the endpoint that refused**; it is never a caller fault at the asker by default
- `getIsConstraintError` reads `LambdaEndpointRefusedError` false, so every consumer family treats it as a server fault (a 5xx, a failed invoke, an sqs redrive)
- a peer's server fault is never a refusal; it stays `LambdaEndpointError` (invoke) or `MalfunctionError` (http)
- a throttle (http 429) is never a refusal: the same bytes succeed after `retry-after`, so it is a `MalfunctionError` under either opt
- under the default opt, the refusal carries the peer's verdict in `errorType`: its class where it sent one, else `http <status>`. the pass-through `ConstraintError` keeps the shape it had before the opt existed, with no `errorType`
- under the default opt, the refusal's message names the peer, its reason, and the opt that restores `ConstraintError`. the pass-through message is the peer's reason alone, as before
- the throttle carve-out names one status, 429, the one rfc 9110 defines as "retry later". a 408 (request timeout) is also transient, and still reads as a refusal; widen the carve-out to a named predicate if a peer is seen to answer 408
- the opt-in hint reads every refusal as a request the caller composed. a 401, 403 or 405 points at credentials or a route, not the request body: the default (a server fault) is right for it, and pass-through would hand the consumer's caller a 400 it cannot fix. a caller that opts in owns that call; narrow the hint per status if a peer is seen to answer one

## .enforcement

- an ask road whose default throws a peer refusal as the asker's own `ConstraintError` = **blocker**
- `refused` / `refusal` for a server fault = **blocker** (one sense)
- a boolean opt in place of `{ as }` = **blocker** (`rule.require.explicit-optout`: the call site names the class it gets)

## .see also

- `invariant.badrequesterror-not-lambda-error` — why a refusal is not a lambda error at the endpoint
- `invariant.constraint-errors-never-redrive-sqs` — `.the bound` on a downstream refusal
- `records.md` — the sqs sense, a refused record
