# F8 — `askLambdaEndpoint.viaApiGateway` returns `{ status, headers, text, body }` and sets no timeout

## .the fork

the wisher decided the caller's inputs (`{ url, method, headers, body }`, as fetch takes them) and
left its output open. a direct invoke returns the handler's payload alone.

- A. return the body alone, as `viaInvoke` does
- B. return `{ status, headers, text, body }` — `text` is the raw answer, `body` its json or null

## .taken = B, and why at the time

- over http the status and headers carry sense a body cannot: a 201 against a 200, a `location`
  on a 3xx, a 204 with no body
- a fault still throws (4xx `ConstraintError`, 5xx `MalfunctionError`), so a caller that wants only
  the payload reads `.body`
- redirects and the `accept` header follow fetch's own defaults; the caller adds neither, since the
  wisher asked for the standard request

## .also decided, as part of the same shape

- **no timeout.** fetch with no signal waits as long as the server does. the harness bounds its own
  requests; a caller bound is a new input the wisher has not asked for
- **a network fault is named.** `executeHttpRequest` catches fetch's bare `TypeError: fetch failed`
  and throws a `MalfunctionError` that holds the url, method, exid, and the cause's text
- **the runtime's global `fetch`**, which node supplies from 18. `package.json` declares
  `engines.node >=8.0.0`, so the declared floor is older than the sdk's own aws-sdk v3 use already
  implies; no guard is added for a runtime that lacks `fetch`
- **the cloud locus of `onSerialized` for a declared api gateway event** sends the carried event on
  the ancient struct, so the header is the only opt-in. it has no deployed-fixture test (rows 12-13
  of the inventory); `asCarriedPayload` is unit-tested, and the call into `askLambdaEndpoint` is not

## .rework = clean

the return shape is pre-release. no consumer holds it.

## .confidence = 65%, low because

- A is simpler and symmetric with `viaInvoke`
- the cloud path is correct by construction and unproven by a run

## .where

`askLambdaEndpoint.viaApiGateway.ts`; `runLambdaEndpoint.onSerialized.ts` (cloud branch).

## .verdict

open — for the fulcrum council.
