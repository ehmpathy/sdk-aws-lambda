# F4 — public names and home: `asApiGatewayHeaders`, `askLambdaEndpoint.viaApiGateway`, in this sdk

## .the fork

two new exports need names and a home:

- the header builder — `asApiGatewayHeaders` · `asTrailHeaders` · `getTrailHeaders`
- the http caller — `askLambdaEndpoint.viaApiGateway` · `askApiGatewayEndpoint` · `askHttpEndpoint` · a separate package

## .taken, and why

the wisher proposed both names; taken over the driver's first guesses (`asTrailHeaders`,
`askApiGatewayEndpoint`).

- **`askLambdaEndpoint.viaApiGateway`**
  - the noun stays what is asked: a `forApiGateway` endpoint IS a lambda endpoint. only the
    transport differs, so the transport is a modifier, not a new noun
  - the driver's guess `askApiGatewayEndpoint` coined a second `ask*` noun, which read as a peer of
    the direct-invoke family. that weak spot dissolves
  - one autocomplete prefix for every way to ask; it mirrors `runLambdaEndpoint.onReferenced` and
    `genLambdaEndpoint.forApiGateway`
  - `via` names the road the call travels — distinct from `for` (the endpoint family) and `on`
    (the run boundary), so no preposition takes a second sense
- **`asApiGatewayHeaders`**
  - a pure cast (`as*`, `rule.require.get-set-gen-verbs`); `get*` would claim a lookup
  - names the bag it emits, which matches `viaApiGateway`. each bag owes its own cast: a later sqs
    cast emits `{ 'x-trail-exid': { DataType: 'String', StringValue } }`, a different shape, so one
    transport-blind `asTrailHeaders` could never serve both

## .rework = clean

pre-release names; a rename is a sedreplace.

## .confidence = 85%, low because

- ~~a function with a member is new to this sdk~~ — **false, and made with no search.** the sdk
  ships three family objects (`genLambdaEndpoint`, `runLambdaEndpoint`, `asLambdaEvent`), and
  `rule.forbid.unqualified-variant-exports` rules this case: an extant family whose bare name
  shipped is `Object.assign(viaInvoke, { viaInvoke, viaApiGateway })` — callable, so no consumer
  breaks, and the default is itself a key. the lesson is enbriefed in
  `rule.require.positive-control-before-absence-claims` (a novelty claim is an absence claim)
- the direct-invoke key needs a name. best guess `viaInvoke` — the aws lambda api's own verb.
  `viaAsk` repeats the family verb
- the target differs: the direct invoke takes `which: { service, function }`; an http call needs a
  url, or a way to derive one from `which`. a blueprint choice
- `asApiGatewayHeaders` could read as "the whole wire header set" (`host`, `accept`, …). its input
  `{ trail }` disambiguates at the call site; `asApiGatewayHeadersFromTrail` is the long form if not

## .where

`src/domain.operations/askLambdaEndpoint/` — the caller as a member; the cast beside it.

## .verdict

names: proposed by the wisher, adopted.

inputs: **ruled** — the wisher, 2026-10-15, verbatim:

> askLambdaEndpoint.viaApiGateway should use its own inputs. i.e., the `uri, method, headers, body, ...` whatever is standard

so the url-vs-`which` point closes: no `which`. the standard is fetch's request (whatwg fetch;
axios matches) — `{ url, method, headers, body }`, query in the `url`. `url` over `uri`: fetch,
axios, and ky all name it `url`. the trail comes from `context.log`, as for the direct invoke; the
caller merges `asApiGatewayHeaders({ trail })` over the given `headers`.

shape: settled by `rule.forbid.unqualified-variant-exports` — `Object.assign(viaInvoke, { viaInvoke, viaApiGateway })`.
still open: the direct-invoke key's name (best guess `viaInvoke`).
