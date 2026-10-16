# invariant.ancient-vs-contemp-callers

## .what

a caller is **contemp only by explicit opt-in**. absent an opt-in, the caller is **ancient**, and gets the backwards-compatible response.

each transport carries the opt-in in its own metadata bag. one opt-in per transport — never two.

## .why

### incremental upgrade support

services upgrade at different times. a new handler may receive calls from:
- **contemp callers** — opted in; expect `ConstraintError` semantics and a propagated trail
- **ancient callers** — no opt-in; expect `BadRequestError` semantics

if handlers reject ancient callers or answer them in a shape they do not read, upgrades become all-or-none.

### aws owns the envelope

an aws-delivered event — api gateway, sqs, sns, cloudfront — arrives in an envelope aws builds. no caller can put a `{ event, trail }` wrapper around it. so the opt-in rides the envelope's metadata bag, `headers` (`domain.terms/headers.md`).

a direct invoke is the one transport where the caller owns the whole payload. it has no metadata bag, so the `{ event, trail }` wrapper stands in for one.

## .detection — per transport

dialect exists only where a caller awaits a reply. a one-way invoke returns to aws, never to the sender, so it has no dialect — its carrier holds the trail alone.

| family | reply awaited? | the carrier | carrier present | carrier absent |
|---|---|---|---|---|
| `forAsk` (direct invoke) | yes | `{ event, trail }` wrapper — `getIsWrappedPayload` | contemp + trail | ancient + fresh trail |
| `forApiGateway` | yes | our header, in the reconciled http `headers` | contemp + trail | ancient + fresh trail |
| cloudfront | yes | our header, in its request headers | contemp + trail | ancient + fresh trail |
| `forSqs.*` | no | our header, in the reconciled `messageAttributes` | trail | fresh trail |
| sns | no | our header, in its `MessageAttributes` | trail | fresh trail |
| kinesis | no | none — a record carries no metadata bag | — | fresh trail |

the http and sqs lifts may be unbuilt at a given moment — `trail.md` records which are built. an unbuilt lift means that family is ancient-only, never that a wrapper is honored in its place.

🟡 **one named debt: `forSqs.*` still reads a `{ event, trail }` wrapper.** that is how it ran before the headers carrier existed, and `runLambdaEndpoint` frames one for every event that is not a declared api gateway event, so a test of an sqs endpoint on the default dialect reaches its handler. aws never sends a wrapper to an sqs handler, so a deployed sqs endpoint reads no trail and mints a fresh one. the `messageAttributes` lift replaces the wrapper read (`.dream/2026_10_15.sqs-trail-lift-via-message-attributes.dream.md`).

the flag `isContempCaller` is stored in context by `genTrailMiddleware`.

## .the verdicts — settled, do not relitigate

> "contemp gets nested. no backcompat. if someone calls with dialect contemp, return dialect contemp."

> "for all events that come from aws directly, theres no way to send an { event, trail } - so we must always pull them from headers."

— the wisher, sdk-aws-lambda#51 (2026-10-15)

## .error response format

| caller | constraint error body | why |
|---|---|---|
| contemp | `{ error: { _serde, class: 'ConstraintError', message } }` | modern semantics; the caller opted in |
| ancient | `{ errorMessage, errorType: 'BadRequestError' }` | backwards compat |

this table applies only to the reply-awaited families above. a one-way family has no reply body, so it has no row here.

on a reply-awaited family, an opted-in caller always gets the contemp body. no such family answers ancient to an opted-in caller "to match what prod clients see" — a caller that wants the ancient body does not opt in.

## .the sdk's own calls

`runLambdaEndpoint` opts in by default, through the transport's own carrier — the wrapper for a direct invoke, our header for an api gateway event. `struct: { payload: 'ancient' }` opts out. a test then sends exactly the request a real contemp caller sends.

## .test coverage

each family with a carrier tests both arms:

| case | input | expected |
|---|---|---|
| carrier present | the family's carrier | reply-awaited: contemp body + trail propagated. one-way: trail propagated |
| carrier absent | no carrier | reply-awaited: ancient body + fresh trail. one-way: fresh trail |
| foreign carrier | a `{ event, trail }` wrapper at an aws-delivered family | not honored |

## .deprecation path

once all callers opt in:
1. monitor for ancient traffic (no opt-in)
2. when it drops to zero, remove backwards compat
3. always return `ConstraintError`

## .enforcement

- a caller treated as contemp with no explicit opt-in = **blocker**
- a `{ event, trail }` wrapper honored at an aws-delivered family = **blocker** — except the one named debt above (`forSqs.*`, deferred by the wisher until the send side is decided). a new family that honors the wrapper, or a widened sqs wrapper read, is still a blocker
- dialect inferred from the event's shape rather than a declared carrier = **blocker**
- an opted-in caller answered in the ancient body, on a reply-awaited family = **blocker**
- a dialect branch on a one-way family = **blocker** (no reply exists for it to shape)
- a second opt-in carrier for one transport = **blocker**

## .see also

- `domain.terms/headers.md` — the bag the opt-in rides
- `domain.terms/trail.md` — the value lifted out of it; which lifts are built
- `rule.require.contemp-contracts-default.md` — the default this invariant bounds
