# F06 — the twin (`forAskEndpoint`) does not follow

**rework** clean · **status** open · **confidence** 🔴 **98%** (was 95% — a production consumer of
the twin was measured; see below)

the wish's **open question 1**, answered in the drive rather than escalated.

## the fork, stated fairly

| option | |
|---|---|
| **A** `forAskEndpoint` keeps `{ event }` | **taken** |
| **B** it grows a peer field for parity | |

## taken, and why at the time

**A**, and the reason is that no value exists to put there.

`forAskEndpoint` is invoked **directly**, never through api gateway. its whole input is
`LambdaHandlerInput<TInput>` — the caller's event, optionally wrapped with a trail
(`forAskEndpoint.ts:21-38`). there is no http envelope, no headers, no method, no path. **B** would
have to invent a field with no value behind it.

⇒ the asymmetry is not an inconsistency. it is **two boundaries with different affordances**:

| family | boundary | what exists to hand over |
|---|---|---|
| `forAskEndpoint` | direct invoke | the event |
| `forApiGateway` | http | the event, plus all that http carries |

## ⚠️ the part that is NOT merely "no change"

the wish's question 1 asks for this *"said out loud rather than left unexplained, since the current
asymmetry is what motivated this task"*. that is a real deliverable:

⇒ **the twin's `EndpointOperation` earns a `.note`** that states why it holds one field and its
peer holds three. without it, the next reader meets the same puzzle that produced this task and
re-asks it from scratch.

a change of zero lines in behavior, one doc block at `forAskEndpoint.ts:44-47`.

## rework, and why clean

**B** stays purely additive forever — a peer field could be added to the twin in any later release
without a break. so **A** forecloses naught.

## 🔴 the measurement that raised it — a real consumer uses the twin, and is untouched

⚠️ **added after the stone arrived**, when a background sweep of `ahbode/*` finished and reported
what an earlier run had silently missed (5 repos had **failed to fetch**, and it warned me in
stdout i had not read).

⇒ the re-run found a **second consumer repo**, and it consumes the twin:

```
git.repo.get lines --in ahbode/svc-home-services --words 'forApiGateway' --paths 'src/**'  ->  0
  positive control, same form:  --words 'sdk-aws-lambda' --paths 'src/**'                  ->  5 ✅
```

> `src/contract/handlers/public/getServiceBySlug.ts:1` → `import { genLambdaEndpoint }`
> `src/contract/handlers/public/getAllLeadCaptureForms.ts:1` → same
> `src/contract/handlers/public/getLeadCaptureFormByService.ts:1` → same
> `src/contract/handlers/public/getServiceByUuid.ts:1` → same
> `src/access/sdks/svcImages.ts:2` → `import { askLambdaEndpoint }`

⇒ **four production handlers on the twin, zero on `forApiGateway`.** so this fulcrum's claim — that
the twin does not follow — is no longer an argument from affordances. it is a **measurement**: a
real consumer sits entirely on the twin, and option **A** leaves every one of those four sites
untouched while option **B** would hand them a field with no value behind it.

⚠️ the zero carries its control, because a bare zero is the one observation this drive has already
been burned by three times (`rule.require.positive-control-before-absence-claims`).

## confidence

🔴 **98%**, raised from 95%.

the original 5% was *"the wisher may want the two signatures to look alike for its own sake"* — which
the wish's own text argues against (*"whatever shape lands here must be argued on its own merits,
never by parity"*). the measurement above removes most of what remained: **parity would now cost
four real handler sites a meaningless field**, so the aesthetic case has a price attached to it.

⇒ the residual 2% is that same wisher preference, which no measurement can settle — it is a taste
call, and it stays the wisher's.

## where

- `1.vision.yield.md` → *open questions → 1*, *groundwork → how the other endpoints accept these args*

## the verdict, once ruled

_open — awaits the fulcrum council._
