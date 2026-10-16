# F2 — the carrier key is `x-trail-exid`

## .the fork

the header that carries the trail and the opt-in needs a name. candidates and rejections:
`domain.terms/x-trail-exid.md`. the live alternatives were `x-trail` (json value) and `trail-exid`
(no `x-`).

## .taken = `x-trail-exid`, and why at the time

- precedent: `ehmpathy/sdk-logs` names `x-trail-exid` for http
- the wire carries the exid alone (`asFramedPayload.ts`), so a key that names `exid` names what crosses
- `trail` namespaces it to ehmpathy; no proxy or aws service sends it, so no stranger flips the dialect
- lowercase-hyphen survives both a case-folded http bag and a case-sensitive sqs bag

## .rework = clean

one constant, pre-release. no consumer holds it yet.

## .confidence = 80%, low because

- the sdk-logs precedent is a vision, never shipped code
- rfc 6648 deprecates `x-`; a reviewer may prefer `trail-exid`

## .where

`domain.terms/x-trail-exid.md`; the header builder; the `forApiGateway` trail read.

## .verdict

open — for the fulcrum council.
