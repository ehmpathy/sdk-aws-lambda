# trail-carrier

## .the term

`TrailCarrier` — where a family's caller puts its trail exid and its contemp opt-in. a dobj: a closed set of two values, `'wrapper' | 'headers'`.

## .the etymology

a carrier is what carries a signal across a transport (a carrier wave carries a signal it does not make). the trail is the signal; the transport's own slot is the carrier.

| rejected | why |
|---|---|
| `lift` | a lift is the act, not the slot that holds the result. `getTrailLift` already names the act |
| `transport` | overloaded: sqs, sns, http are transports, and one transport can offer many slots |
| `channel` | overloaded with radio and log channels in this repo |
| `frame` | names the `{ event, trail }` shape alone; `headers` is not a frame |
| `mode`, `kind` | state no sense: a carrier says what it holds |
| `none` (a third value) | a family that reads no trail is a gap, not a carrier. `forSqs.*` keeps `wrapper` as it ran before, since a test runner frames one; the deployed lift is recorded as next |

## .the evidence — dimensional decomposition

axes a family varies on, as to its trail:

| axis | values |
|---|---|
| owns its whole payload | yes (direct invoke) · no (aws builds the envelope) |
| holds a metadata bag the caller writes | yes (http headers) · not yet (sqs/sns attributes, unsent) |
| awaits a reply | yes · no |

cells:

| owns payload | caller-written bag | the carrier | family |
|---|---|---|---|
| yes | — | `wrapper` | `forAsk` |
| no | yes | `headers` | `forApiGateway` |
| no | no | `wrapper`, read from a test runner's frame only | `forSqs.*` (until the send side decides its bag) |

forbidden cells:
- `wrapper` at a family where aws builds the envelope, read as if aws sent it: aws never sends one, so a deployed endpoint of that family reads no trail from it
- `headers` where the envelope has no `headers` bag

## .the evidence — the timeline

1. `runLambdaEndpoint.onSerialized` holds an event and a trail
2. it asks for the carrier. the endpoint a `genLambdaEndpoint` builder returned declares its own (`getOneTrailCarrierOfHandler`), so any event handed to it is framed for its family. for a plain handler, and at the cloud locus, which holds no handler, `getOneTrailCarrierOfEvent` decides: an event the builder declared as api gateway is `headers`, any other is `wrapper`. the contents of an event never choose its carrier
3. `wrapper` sends `{ event, trail }`; `headers` sends the event with `x-trail-exid` added
4. the endpoint's `genTrailMiddleware({ carrier })` reads the same slot: `wrapper` unwraps, `headers` reads the header
5. a mismatch (a wrapper at a `headers` family) is refused by name, with the remedies

## .attributes

| value | reads | writes |
|---|---|---|
| `wrapper` | `{ event, trail }` | `asCarriedPayload` wrapper arm |
| `headers` | `x-trail-exid` in the reconciled headers | `asCarriedPayload` headers arm |

## .invariants

- every family declares exactly one carrier, in its middleware chain
- `genTrailMiddleware` requires the carrier: no default, so no family inherits a slot silently
- its read is exhaustive over the type: a third carrier fails to compile until it is handled
- the writer and the reader of one family name the same carrier: one constant per family feeds both its `genTrailMiddleware({ carrier })` and the stamp on the handler it returns
- an event's contents never choose its carrier: the builder's declaration does

## .see also

- `x-trail-exid.md` — the key the `headers` carrier writes
- `trail.md` — the value it carries
- `invariant.ancient-vs-contemp-callers.md` — what the opt-in means, per family
