# F11 — a browser preflight for `x-trail-exid` is not answered by the sdk, so no test can show it succeed

## .the fork

the vision's contract item 7 reads as a claim that a browser preflight for `x-trail-exid` succeeds. a
level-3 reviewer asks for a test that sends `OPTIONS` with `Access-Control-Request-Headers: x-trail-exid`.

- A. add that test: it can only assert what the sdk does today
- B. dispute the test, and record that the claim as worded cannot hold today
- C. fix the preflight limit in this change (answer `OPTIONS` before the body validation)

## .taken = B, and why at the time

`blackbox/local.httpResponse.acceptance.test.ts` `[case11][t0]` pins a pre-extant limit: a preflight falls
through the whole chain, the strict body schema refuses it with a 400, and the response carries no
`access-control-allow-origin` at all. the request header a browser asks about does not change that
outcome, so a test with `x-trail-exid` in it would assert the same 400 and prove naught about the allow
list.

what the change does hold: the allow list gains the header on every cors response the endpoint emits, and
four snapshots pin it (`genLambdaEndpoint.forApiGateway.test.ts.snap` ×3,
`local.httpResponse.acceptance.test.ts.snap` ×1), plus the unit cases of `asCorsHeadersWithTrail`.

C is a separate defect (`.dream/v2026_09_22.fix.no-cors-or-owasp-headers-on-error-responses.md` is its
neighbor) and #51 needs none of it.

## .rework = clean

A is a test; C is a middleware change with its own contract.

## .confidence = 75%, low because

- no deployed gateway was probed: an api gateway may answer `OPTIONS` itself with a mock integration, so
  a real browser may never reach this code (the `[case11]` docblock says the same)
- the vision's item 7 is worded wider than what a test can show today; the wisher may want the claim
  narrowed rather than the test added

## .verdict

open — for the wisher. keep the claim narrow ("the allow list names the header"), or take C.
