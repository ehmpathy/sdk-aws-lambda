# F7 — the util is handler-agnostic, not `genLambdaEndpoint`-bound

> 🔴 **found at self-review r1**, from adoption data the wish did not have. it reframes the util's
> value from "the last mile of a finished migration" to "the on-ramp to one barely begun."

## the fork, stated fairly

the wish frames the util as the companion to `genLambdaEndpoint`: "sdk-aws-lambda should own the way
you TEST a `genLambdaEndpoint` handler". that framing admits two builds:

- **endpoint-bound** — the input type is `middy.MiddyfiedHandler<…>`, the util knows the envelope
  contract, and only a `genLambdaEndpoint` handler type-checks
- **handler-agnostic** — the input type is `(event, context) => Promise<unknown>`; any lambda
  handler works, and the endpoint-awareness lives in the **return type** (**F9**) rather than in
  the invoker's input type

## the adoption data that forced the question

measured across the org, at self-review r1:

| | repos | sites |
|---|---|---|
| legacy `invokeHandlerForTesting` | **20** | **318** |
| `genLambdaEndpoint` | **1** | **4 handlers** |

`rhx git.repo.get lines --repos 'ahbode/*' --words 'genLambdaEndpoint'` → 12 matches in
**one** repo (`ahbode/svc-home-services`), of which 4 are actual handler definitions
(`getAllLeadCaptureForms.ts:24`, `getLeadCaptureFormByService.ts:29`, `getServiceBySlug.ts:29`,
`getServiceByUuid.ts:29`).

meanwhile 19 of 20 repos still define handlers with `createStandardHandler` from
`simple-lambda-handlers` — e.g. `ahbode/svc-notifications` has **24 matches across 12 handler
files** on `origin/main`, and **zero** `genLambdaEndpoint`.

⇒ **an endpoint-bound util would be adoptable by 4 handlers in 1 repo on day one.** the other 314
call sites would have to wait for their repo's handler migration before they could even swap the
test import.

## taken, and why at the time

**taken: handler-agnostic.** the util accepts any `(event, context) => Promise<unknown>`; the
endpoint-specific knowledge lives in the dialect generic (**F9**), which shapes the **return** type
and constrains the **input** type not at all.

⚠️ **this read *"lives in `asLambdaErrorForTest` (F5)"* until the wisher superseded F5 on
2026-09-08 — and the successor makes the argument STRONGER, not merely current.** a runtime reader
was an extra symbol a legacy-handler author had to know to reach for; a return-type generic costs
them naught and stays out of their way, which is exactly what "handler-agnostic" promised. ⇒ but
note F9's own third bound: `struct.payload` describes **this sdk's** envelopes, and the legacy
family emits a third shape (`stackTrace` + `causeTrace`, no `details`). so the error type may need
to be independently overridable rather than derived from `struct.payload` alone — a live blueprint
question, and it is this actor's question specifically.

1. **it decouples two migrations the wish assumed were sequenced.** the wish's model is
   handler-migration-first, test-migration-second ("a repo migrated to `genLambdaEndpoint` can
   delete…"). the data says the handler migration has barely started. a handler-agnostic util lets a
   repo drop the legacy **handler-test import** now, independent of its handler state — which turns
   the wish's done-when from a trailing cleanup into a leading move.

   > ⚠️ **the import, not the `package.json` entry — corrected at r4.** the legacy package exports
   > a peer util (`invokeLambdaForTesting`, 24 repos / 519 sites) used by acceptance tests, which
   > this wish does not touch. F7's claim to decouple is about the handler-test import and holds
   > exactly as argued; the dep itself needs the acceptance migration too (→ Q10).
2. **it costs no ground to give up.** the extant in-repo util is already agnostic:
   `invokeHandlerForTest.ts:9-11` types its handler as
   `(event: TInput, context: Context) => Promise<TOutput>`. so agnostic is the status quo, and
   endpoint-bound would be *added* narrowness with no stated benefit — the envelope-awareness the
   wish actually wants lives in the reader, which is where it can be applied selectively.
3. **the legacy util was agnostic too**, which is why one package serves ask-endpoint handlers,
   api-gateway handlers, and raw SQS/SNS/Kinesis consumers across those 20 repos
   (`svc-notifications/consumeSESEmailEventFromSNS.integration.test.ts:60`,
   `consumeShortUrlCloudfrontLogFromKinesis.integration.test.ts:55`). a drop-in replacement must
   accept the same range or it is not a drop-in.

## rework, and why clean

**clean, and one-directional-cheap.** agnostic → bound is a type narrowing that would break
callers, so it is the dirty direction; bound → agnostic is a widening and is free. i took the one
that keeps the cheap reversal available. a maintainer who later wants type-level endpoint safety can
add an overload or a branded wrapper without a break.

## 🔴 the soundness argument, corrected at r2

> the rationale under this fulcrum changed even though the **choice** did not. recorded, because a
> fulcrum whose stated reason is wrong is a fulcrum a reviewer cannot check.

when case=7 was written to demo F7, i argued it holds because *"both handler families split on the
same predicate, so they agree."* **that is false.** `genLambdaEndpoint` uses its own
`getIsConstraintError` (`:11-34`), a strict **superset** of the legacy `decideIsBadRequestError`:
both catch `BadRequestError`, but only the endpoint one catches **`ConstraintError`**, which the
legacy handler *throws*. the families genuinely diverge there.

**the correct argument is simpler and stronger: the util applies no predicate at all.** it strips,
awaits, and relays whatever the handler's own middleware decided. it holds no opinion, so it cannot
disagree with either family — **regardless of what the predicates do.** F7 rests on a structural
property of the util itself, never on an empirical agreement between two packages.

⇒ this *raises* the fulcrum's robustness: the reason i first gave would have made F7 fragile to any
future divergence between the families. the real reason is immune to it.

## confidence, and why 91%

high. the adoption figures are measured with a cited command, the extant util's own signature
already agrees, and the legacy util's cross-event-source usage is visible in the same data.

**held at 91% after r2, and the composition of the doubt changed** — one component shrank and a new
one replaced it:

- ⬇️ **the soundness doubt shrank.** the correction above moved F7 from an empirical claim about two
  packages to a structural claim about one function — a firmer base.
- ⬆️ **a new doubt, from r2's issue 4 → Q8: the name may defeat the reach F7 buys.**
  `askLambdaEndpointForTest` reads endpoint-bound, so the 19 repos F7 exists to serve are the ones
  most likely to conclude the util is not for them. F7 wins the *capability*; **F2 may lose the
  *adoption*.** the two fulcrums interact, and that interaction was invisible until case=7 existed.
- the original 9% stands unchanged in kind: a maintainer may deliberately *want* the narrow type as
  a nudge toward `genLambdaEndpoint` adoption — a trade of reach for pressure. that is a legitimate
  product call and the wisher's to make, not mine.

## where

- the util's handler parameter type
- the yield's value story — this is why the util is an on-ramp, not a last mile
- **the util's name** — see Q8; F7's reach is only realized if the name does not deter it
- demoed at
  [case=7](../1.vision.experience.case=7.the-legacy-handler-migrant-crosses-families.md), added at
  r2 (the actor F7 serves had no demo until then)

## the verdict

_unruled — open for the council._
