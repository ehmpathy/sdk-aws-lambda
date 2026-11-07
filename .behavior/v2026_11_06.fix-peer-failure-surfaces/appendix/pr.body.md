closes #77

## .what

two behaviors that hid 24 prod failures in svc-gateway (2026-10-08T21Z → 2026-10-11T22:24Z) now surface at cause.

1. **a failed endpoint logs loud.** `handler.output` on a failure logs at **warn** for a caller fault (`getIsConstraintError`) and at **error** for all else — never at debug beside a success. a failure thrown before trail sets a `log` falls back to `console`. a success stays at debug
2. **a peer refusal is the asker's malfunction, not its caller's fault.** when a peer answers `ConstraintError` / `BadRequestError` (or an http 4xx), `askLambdaEndpoint` now throws `LambdaEndpointRefusedError` — a `MalfunctionError` — by default. an api-gateway consumer answers its caller 500 + correlationId, never a 400 the caller cannot fix. the message names the peer, its reason, and the opt-in:

```
💥 LambdaEndpointRefusedError: svc-notifications-prep-sendNotification refused the request: template id absent

this caller composed the request. if it forwards its own caller's input verbatim, opt in with refusal: { as: 'ConstraintError' }
```

pass-through to the old class is one key away, per call:

```ts
await askLambdaEndpoint({ which, event, refusal: { as: 'ConstraintError' } }, context);
await askLambdaEndpoint.viaApiGateway({ url, body, refusal: { as: 'ConstraintError' } }, context);
await svcJobs.getJob(event, context, { refusal: { as: 'ConstraintError' } }); // a generated sdk, after a regen
```

`runLambdaEndpoint.onSerialized` keeps `ConstraintError` — its caller composed the event, so no peer stands between.

an unknown `refusal` value fails fast with a `💥 MalfunctionError` (the asker's own defect) that lists the two it honors, before any request is sent. an http **429** is a throttle, not a refusal: it is a `MalfunctionError` under either opt, its `retry-after` kept in metadata (F8).

## ⚠️ contract break

- a consumer that catches `ConstraintError` from `askLambdaEndpoint` / `.viaApiGateway` no longer catches a peer refusal. catch `LambdaEndpointRefusedError`, or opt into pass-through where the request forwards the caller's own input
- an sqs `perRecord` consumer whose peer refuses now redrives the message, then dead-letters it (it was acknowledged). `invariant.constraint-errors-never-redrive-sqs` `.the bound` is revised; the opt restores the acknowledgement
- under the pass-through opt, an http 429 was a `ConstraintError` and is now a `MalfunctionError` (F8: a throttle is a wait, never a fix for the caller)
- every failure an endpoint observes now logs `handler.output` at warn (caller fault) or error (else), with its message and stack. it was at debug, so it now shows at `LOG_LEVEL=info`: a warn-keyed alarm or metric filter will see more volume
- a peer refusal is now a server fault, so the invoke fails where it used to answer. an async invoke that fails is retried by aws (twice, by default), and a consumer retry wrapper that retries a `MalfunctionError` retries it too. opt in where the refusal is the caller's to fix
- svc-gateway's stopgap catch at its svc-notifications boundary can be deleted once it upgrades

version: a `feat` commit → please-release cuts **v0.8.0** (prior 0.x breaks shipped as `feat`, e.g. #46). say the word if this should be `break` → v1.0.0.

follow-ups, not in this pr:
- the failure line logs the raw message and stack; a `logTranslate` for the error branch would let an endpoint redact it. caught as `.dream/2026_11_06.v2026-11-06-feat-log-translate-for-error-branch.dream.md`
- the opt-in hint names every 4xx save 429 as a request the caller composed. a 401, 403 or 405 points at credentials or a route instead, and pass-through would answer the consumer's caller 400 for it. noted in `domain.terms/refusal.md`
- under pass-through, an api-gateway consumer's 400 body carries the peer's `url`, `status` and response headers, byte for byte as before this pr. the default 500 body holds none of it. whether pass-through should trim them is a separate call; caught as `.dream/2026_11_07.passthrough-body-carries-peer-detail.dream.md`

tests whose default arm changed class: `askLambdaEndpoint.roundtrip` (ancient + contemp `[t0]`), `viaApiGateway.integration [t0]`, `asErrorFromHttpResponse` (4xx), `local.askApiGateway [case1][t1]`, `deployed.awsLambda [case1][t2]`. each keeps its old `ConstraintError` assertion verbatim in a twin under `refusal: { as: 'ConstraintError' }`. `getParsedResponse [case1..9]` run under pass-through, so their assertions are unchanged.

## 🔱 for the commander — three calls to rule

### F1 — the refusal class: `LambdaEndpointRefusedError extends MalfunctionError`

- **lean**: keep it. distinct by class, and a `MalfunctionError`, so every consumer family reads it as a server fault. `refused` already means "an endpoint declined a request as a caller fault" in this repo (`sqs.record.refused`), so the word keeps one sense (`domain.terms/refusal.md`)
- **why not `extends LambdaEndpointError`** (the vision's draft): the http road (`viaApiGateway`) has no `LambdaEndpoint` to carry, and one class must serve both roads. cost: a `catch (e instanceof LambdaEndpointError)` does not catch a refusal — but it never did; a refusal was a `ConstraintError` before
- **clean rework**: swap the parent in one file (`src/domain.objects/LambdaEndpointRefusedError.ts`); every throw site builds it through `asErrorFromPeerRefusal`. a rename is the same file + the opt's union value

### F2 — the opt-in shape: `refusal: { as: 'ConstraintError' | 'LambdaEndpointRefusedError' }`

- **lean**: keep it. a named value, never a boolean, so the call site states the class it gets (`rule.require.explicit-optout`). it sits beside `struct`, not inside it: `struct.payload` names the wire dialect, `refusal.as` names the error class — two dimensions, two keys
- **clean rework**: one type (`src/domain.objects/LambdaEndpointRefusal.ts`), two input keys (`viaInvoke`, `viaApiGateway`), and the generated fn's `options.refusal` (`asMechanismFnSource`); a move under `struct` or a rename touches those plus `REFUSAL_OF_RUN` in `onSerialized` and the tests

### F8 — an http 429 is a `MalfunctionError` under either opt

- **lean**: keep it. a refusal is a verdict on the request: the same bytes fail the same way. a 429 breaks that sense, since the same bytes succeed after `retry-after`. so it is a wait, never a fix for the caller. as a `ConstraintError`, a throttled sqs consumer would acknowledge and delete the message (`invariant.constraint-errors-never-redrive-sqs`)
- **the cost**: the wish scopes pass-through to the old behavior of a peer `ConstraintError` / `BadRequestError`. a 429 is neither, yet a pass-through caller got `ConstraintError` for one before this pr and gets `MalfunctionError` now. a peer reviewer asked for your sign-off on this break
- **clean rework**: delete one branch in `asErrorFromHttpResponse.ts` (`getIsHttpThrottle`) and the 429 follows the refusal opt, as every other 4xx does; flip the two `[case2]` / `[case3]` unit arms and `viaApiGateway.integration [case1][t6]`

## .proof

each behavior is clamped by a test that fails without the fix (fix reverted → red, restored → green):

| clamp | red on revert |
|---|---|
| `genIoLoggerMiddleware.test.ts` `[case3]`, `[case4]`, `[case9]` — level per class | 5 |
| `genIoLoggerMiddleware.test.ts` `[case10]` — console fallback | 2 |
| `getParsedResponse.test.ts` `[case10]`, `asErrorFromHttpResponse.test.ts` — the refusal class per arm and opt | 13 |
| `genLambdaEndpoint.forApiGateway.test.ts` `[case29]` — consumer answers 500, body free of peer text, a loud line names peer + reason + opt-in | 3 |

integration, against deployed prep lambdas and a real http server: `askLambdaEndpoint.roundtrip` `[case2]` (contemp + ancient peers) and `viaApiGateway` `[case1][t0]`, each under the default and the pass-through opt.
