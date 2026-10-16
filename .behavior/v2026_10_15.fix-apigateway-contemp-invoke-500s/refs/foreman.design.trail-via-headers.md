# foreman design — the contemp opt-in rides each transport's `headers`

decided with the human. supersedes the middleware-swap fix for #51.

## .the principle

an aws-delivered event has an aws-owned envelope. no caller can put `{ event, trail }` around it. so the contemp opt-in — and the trail it carries — rides the transport's metadata bag: `headers` (`domain.terms/headers.md`).

direct invoke is the one transport where we own the whole payload. it has no bag, so the `{ event, trail }` wrapper stands in for one.

the invariant holds unchanged on the families where a caller awaits a reply (direct invoke, api gateway, cloudfront): our header present = contemp, opted in. absent = ancient.

a one-way family (sqs, sns, kinesis) returns to aws, never to the sender. no one reads its response shape, so it has no dialect. its carrier holds the trail alone, and it carries no dialect branch (`invariant.ancient-vs-contemp-callers.md`).

## .per family

| family | opt-in rides | scope |
|---|---|---|
| `forAsk` | `{ event, trail }` wrapper | built — unchanged |
| `forApiGateway` | http header | build now — this is the #51 fix |
| `forSqs.*` | `messageAttributes` | build now if the read is one codepath with api gateway; else record as next |
| sns, cloudfront | their bags | record as next |
| kinesis | no bag | ancient only — record as a known gap |

`forApiGateway` no longer honors the wrapper. one opt-in per transport.

on sqs/sns the header carries the trail alone — no dialect, no response-shape branch.

## .the read — one codepath

trail reads our header from the family's reconciled `headers`. for api gateway that bag exists only after normalization, so trail stays after it — the current order. no swap.

## .the surface

1. **a pure header builder** — trail in, `{ [name]: value }` out. any http client (fetch, axios, ky) spreads it in. `as*` per `rule.require.get-set-gen-verbs`.
2. **our api gateway caller** — sends the request with (1), and casts a nested 400 back into a thrown `ConstraintError`, as `getParsedResponse` does for `forAsk`. the payoff of contemp over http.
3. **`runLambdaEndpoint` sets the header by default.** `struct: { payload: 'ancient' }` opts out: raw event, no header. it learns the event is http from `asLambdaEvent.fromApiGateway`'s output, declared by the builder — never a sniff of the event's shape. tests then send the exact request (2) sends.

## .open — settle in discovery, persist in `domain.terms/`

- **the header name** — a new term. needs discovery evidence on file. must be lowercase: sqs keys are case-sensitive, http keys get lowercased.
- **trace vs opt-in** — one header for both? a generic correlation header forwarded by a proxy must not flip an error body. our own namespaced header keeps the opt-in deliberate.
- **cors** — a custom header from a browser triggers a preflight. a browser caller of (2) needs the header in the endpoint's `allowHeaders`.
- **where (2) lives** — this sdk, beside `askLambdaEndpoint` (the lean), or a separate http client.
- **`struct.payload` reads as "request body" on http** (`payload.md`). a `struct: { dialect }` rename is a separate decision for the human. note it; do not fold it in.

## .the knock-on edits

- `invariant.ancient-vs-contemp-callers.md` — detection per transport, by the table above.
- `rule.require.contemp-contracts-default.md:27` — "if caller type is unknown, assume contemp" contradicts its own line 22 and the invariant. fix to: absent opt-in = ancient.
- `trail.md` — the per-transport lift moves from unbuilt to built, for each family that ships.
- declapract#650 — its workaround becomes "no `struct`" for every family. its 400 assertions move from `errorType` to `error.class`.

## .still in force from the F1 verdict

- clamp first: the regression test goes red on 0.7.1, green after. revert the fix alone, watch red, restore.
- real api gateway requests with no header: zero snapshot diffs. any diff = stop and tell the foreman.

---

@:foreman
