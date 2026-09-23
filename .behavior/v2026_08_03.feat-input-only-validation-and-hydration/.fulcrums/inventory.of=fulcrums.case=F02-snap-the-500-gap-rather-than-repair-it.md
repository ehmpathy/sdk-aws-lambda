# `F02` — the 500 a bad schema position raises is snapped as a gap rather than repaired

| field | value |
|---|---|
| **rework** | dirty |
| **status** | open |
| **confidence** | 82% |
| **where** | `genLambdaEndpoint.forApiGateway.test.ts [case17][t1]` · `genInternalServiceErrorMiddleware.ts` |
| **dream** | `.dream/v2026_09_18.fix.the-500-a-bad-schema-position-raises-names-no-field.md` |

## .the fork, stated fairly

a peer asked what an engineer reads when an unrenderable schema position 500s introspection. i
measured it, and the envelope names neither the endpoint nor the position at fault. so:

| option | what it means |
|---|---|
| **A — repair now** | widen `genInternalServiceErrorMiddleware` to carry the schema path onto the wire, or into a legible log line |
| **B — snap the gap, defer the repair** | clamp the envelope exactly as it is, with a note that it IS a gap, and catch a dream |

## .taken, and why at the time

**B.** the reason is scope shape rather than effort:

- the envelope is **every** 500 this sdk emits, across both families and every consumer. it is not
  this case's envelope, it is the shared one
- so option A opens a surface this bound never asked about, and its blast radius is every error
  path rather than the schema-publish path
- the wisher's wish names an input-only contract and dobj hydration. a 500's body text is neither

⚠️ **and there is a call inside A that is not the driver's**: whether a 500 body may name an
internal schema position at all. it leaks no caller data — it is our own contract text — but it
does name internals to whoever holds the endpoint. that is a disclosure call, and a disclosure
call belongs to the wisher.

⇒ so option A is not merely large; it is **gated on a decision i am not the one to make**, which
is what turns a size judgment into a fulcrum.

## .rework, and why it is dirty

reversal is a teardown rather than a rename:

- a change to the shared envelope moves every 500 snapshot in the repo
- both families' acceptance suites assert against that envelope
- any consumer whose alarms key off `errorMessage` would meet a new string

⇒ once callers harden against a widened envelope, the walk-back costs them rather than us. that is
the definition this route uses for **dirty**.

## .confidence, and why it is not higher

**82%**, and the 18% is one specific doubt: a reviewer could hold that the *log* half of option A
is SAFE and CLEAN — it adds a line rather than changes a contract, and no snapshot asserts a
cloudwatch entry. if that read holds, then half of A was fix-forward work i deferred, and the
correct verdict is a split rather than a defer.

i did not take that half because the log line is emitted from the same middleware whose shape the
other half changes, so a partial edit there leaves the next traveler with one of two seams done
and no record of which. but i can be argued out of it in one round, and the rework would be clean.

## .the 18% MATERIALIZED, in the very next round — and it was right

`r10` @ `i009` raised the log half as a blocker, in the words this entry had already written: a 500
carries only a correlation id, so an engineer has no path from symptom to endpoint.

⇒ **so the doubt above was not hypothetical.** i wrote *"i can be argued out of it in one round, and
the rework would be clean"*, and one round is exactly what it took.

**the log half is now SHIPPED**, per `rule.always.fix-forward-under-scouts-honor`'s two tests, both
of which answer ✅ for that half alone:

- `handler.error` carries `endpoint`, read off aws's own `functionName`, `null` when aws named none
- clamped by a **new** spec file — `handler.error` had zero assertions anywhere in the repo before
- the bite is measured: struck the key → **2 red, 1 green**, and the green one is the positive
  control, which proves the clamp is scoped rather than broadly coupled

⚠️ **my stated reason to hold it back was WRONG, and the record should say so.** i held that a
partial edit leaves the next traveler with one seam done and no record of which. that reason assumed
the record would be absent — but the record is this entry plus the doc block at the middleware,
which now states out loud that the wire half is `F02` and unrepaired. **a partial repair with its
boundary declared is not the hazard i described.**

## .what remains, and it is the whole original question

the **WIRE body** is still bare. whether a 500 may name an internal schema position at all is a
**disclosure** call — it widens what an unauthenticated caller learns — and that is the wisher's,
not a reviewer's and not mine. status: **LIVE, NOT FIXED**
(`rule.require.deferred-defect-records-lead-with-status`).

⇒ the gap is snapped at `genLambdaEndpoint.forApiGateway.test.ts [case17][t1]`, so a future repair
meets a red test rather than a silent change.

## .the verdict, once ruled

_(unfilled — awaits the fulcrum council. the LOG half is no longer part of the question; the WIRE
half is the whole of it)_
