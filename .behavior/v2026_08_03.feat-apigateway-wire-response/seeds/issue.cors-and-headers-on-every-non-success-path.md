# seed — fix: cors is unusable from a browser, on two independent paths

> **status: staged, NOT pushed.** `rhx radio.uses get` reports `global: blocked`, which is
> human-only to lift. once lifted, this seeds in one command:
>
> ```sh
> cat .behavior/v2026_08_03.feat-apigateway-wire-response/seeds/issue.cors-and-headers-on-every-non-success-path.md \
>   | rhx radio.task.push --via gh.issues --into @this \
>       --title 'fix: cors is unusable from a browser — preflight unanswered, and headers dropped on every error' \
>       --description @stdin
> ```
>
> staged rather than fixed because **neither defect is in this wish's bound** — no acceptance
> line asks for cors, and `main` ships both. the diagnosis is fully paid for; only the write-up
> was absent, and review r11 (i016) was right that once this branch merges the vision archive
> becomes the only place the diagnosis lives.

## .what

`cors` on a `forApiGateway` handler has **two limits** that compound. each is measured; neither
is introduced by this branch.

| # | limit | reach |
|---|---|---|
| 1 | a **preflight** (`OPTIONS`) is answered by the HANDLER, never short-circuited by cors — so it is refused by body validation wherever `schema.input` rejects a body-less request | non-simple cross-origin requests, **where the preflight reaches the lambda at all** |
| 2 | cors + owasp headers are **absent from every error response** (400 and 500) | every error a browser sees |

## ⚠️ .the bound of these claims — read before you size the work

**both were measured against the LOCAL harness**, where every request reaches the handler.
neither has been measured against a deployed api gateway, and that gap matters most for limit 1:
a REST api commonly answers `OPTIONS` at the gateway with a MOCK integration, so a preflight may
never reach the lambda. **that is the likeliest reason no consumer has ever reported limit 1** —
verify it before you treat limit 1 as a live outage.

**neither limit is a regression.** `ehmpathy/simple-lambda-handlers` — the prior art this family
follows — has the identical structure: it registers `httpCors` with no preflight option
(`createApiGatewayHandler.ts:193`, `corsInputToCorsConfig` at `:91-96` sets only
`origin`/`origins`/`credentials`/`headers`) AND validates input
(`joiEventValidationMiddleware`, `:197`). its preflight test
(`createApiGatewayHandler.test.ts:164`) asserts *cors headers on a **successful** response* to an
`OPTIONS` request — it never asserts a 204 short-circuit. so "cors worked in the prior art" means
its schema accepted the preflight payload, not that the vendor answered it.

## .why it matters

where limit 1 IS reachable, a browser blocks the real request **client-side**, so the endpoint is
unreachable with **no server-side log**. that is the worst diagnostic shape: the lambda reports
success, cloudwatch is clean, and the caller sees only a cors error.

## limit 1 — the preflight is answered by the handler

`@middy/http-cors@4.7.0` defaults `disableBeforePreflightResponse: true` (`index.js:17`), and
its `before` hook early-returns on that flag (`index.js:37`). so an `OPTIONS` request is **not**
short-circuited; it continues down the chain to `genZodBodyValidationMiddleware`, which has no
`OPTIONS` exemption. any `schema.input` stricter than `z.any()` refuses the body-less preflight
with a **400** — and by defect 2 that 400 carries no cors headers at all.

**measured:** `[case11]` of `blackbox/local.wireResponse.acceptance.test.ts`. every prediction
held on the first run: status `400` rather than `204`, no `access-control-allow-origin`, and the
handler never invoked.

**the fix is one key, and its blast radius is pre-measured:**

```ts
httpCors({ ...corsInputToCorsConfig(config.cors), disableBeforePreflightResponse: false })
```

- yields `204` + `access-control-allow-origin: *`
- **blast radius is ONE case** (`[case11]`) — the `OPTIONS` path alone. stated as a radius
  rather than as `N of M`, since a suite total decays the moment a case is added
- ⚠️ **it needs NO middleware reorder.** `before` hooks run in FORWARD array order (middy
  `push`es them; only `after`/`onError` are `unshift`ed), so cors at index 5 already precedes
  validation at index 10. **this is the opposite of defect 2**, whose repair moves every
  response's header contract — that contrast is the whole reason the two are separable.

**not applied here** because it changes `OPTIONS` behavior for every cors-configured handler,
which is a contract change no acceptance line asks for.

## defect 2 — cors + owasp headers are dropped on every error path

both `@middy/http-cors` (`index.js:54-61`) and `@middy/http-security-headers`
(`index.js:250-256`) declare an `onError` hook, and each opens
`if (request.response === undefined) return`. middy runs `after`/`onError` in **REVERSE** array
order, so both run **before** the error builders that set `request.response` — and both see
`undefined` and no-op.

so **every 400 and every 500 ships with no cors headers and no owasp headers.**

⚠️ **this is the 3rd and 4th instance of one defect class on this branch** (a hook placed on the
wrong side of the value it reads). the repair is an array reorder, and unlike defect 1 it moves
the header contract of **every** response — so it wants its own round with its own coverage.

### ⚠️ and one claim to distrust, recorded because it was wrong for four iterations

the vision yield stated the cause as *"`httpSecurityHeaders` registers `after`, never
`onError`"*. **that is false** — it registers both. the true cause is the order reversal above.
a claim sourced to a vendor's role rather than to a read of its dist
(`rule.require.read-the-slot-a-dependency-reads`).

## .acceptance

- an `OPTIONS` preflight against a handler with `cors` and a strict `schema.input` answers
  **204** with `access-control-allow-origin`, and the handler is **not** invoked
- a **400** and a **500** from a `cors`-configured handler each carry the cors headers and the
  owasp headers
- coverage asserts the **wire bytes** on both paths, with the success path as the positive
  control (`rule.require.positive-control-before-absence-claims`) — an absent header and a
  never-wired middleware are otherwise the same observation
- the snapshots are **denylists** (`rule.require.snapshots-deny-volatile-not-allow-expected`):
  the eleven allowlist snapshots on this branch could not see a header nobody predicted, which
  is exactly how a false `Content-Type` shipped green through seven review rounds

## .ground — where the diagnosis lives

- `src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway.ts`
  — the `corsInputToCorsConfig` `.defect` block (defect 1) and the middleware-array invariant
  block, which now states **both** hook-order axes
- `blackbox/local.wireResponse.acceptance.test.ts` `[case11]` — the preflight clamp
- `.behavior/v2026_08_03.feat-apigateway-wire-response/1.vision.yield.md` — fulcrum **F32**
- `.agent/repo=.this/role=any/briefs/rule.require.sweep-the-defect-class.md` — the rule both
  defects produced, plus the axis trap that hid defect 2's `before`-side twin

## .note — one defect NOT in this issue, deliberately

`corsInputToCorsConfig` also handed the vendor `origins: undefined`, which clobbered its `[]`
default and threw a `TypeError` from `after` — so **every success response of every handler
configured with the documented `cors: { origins: '*' }` wildcard was a 500**. that one is
**already fixed** on this branch. it is named here only so a reader of this issue does not
rediscover it and assume it is open.
