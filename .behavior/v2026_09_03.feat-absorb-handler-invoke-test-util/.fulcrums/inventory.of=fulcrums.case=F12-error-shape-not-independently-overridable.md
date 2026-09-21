# F12 — the error shape derives from `struct.payload` and is NOT independently overridable

> 🔴 **raised at self-review r5, and it is the SECOND delegated fork left unitemized.** F9's bounds
> table named it and handed it forward — *"a live implementation question for the blueprint, not a
> settled point"* — and the implementation answered it by omission.

## the fork, stated fairly

F9's third bound:

> **the legacy family's third shape** — `createStandardHandler` emits `stackTrace` + `causeTrace` and
> no `details` (`badRequestErrorMiddleware.ts:93-103`), and has **0** `isContempCaller` matches.
> `struct.payload` describes our envelopes only, so case=7's actor — 19 repos / 314 sites — is
> unmodeled by this generic.
>
> ⚠️ it means the error type may need to be **independently overridable** rather than derived from
> `struct.payload` alone.

so: does `onReferenced` take a fourth parameter that lets an author name their own envelope shape?

| # | branch | cost |
|---|---|---|
| A | a fourth type parameter — `<TEvent, TOutput, TDialect, TError>` | a fourth knob on the drive's most-used call, to serve a family this wish exists to retire |
| B | derive from `struct.payload` alone | case=7's actor cannot type-read `stackTrace`/`causeTrace` |

## taken, and why at the time

**taken: B.** `LambdaEndpointRunOutput<TOutput, TDialect> = TOutput | Ancient | Contemp`, and there
is no fourth parameter.

⚠️ **the choice was made by omission rather than by argument**, which is why it owes this row.

### the evidence that makes it right, measured at r5

`rhx git.repo.get lines --repos 'ahbode/*' --words 'stackTrace'` → **8 matches in 3 repos**, and not
one is an assertion:

| repo | matches | what they are |
|---|---|---|
| `svc-heartbeat` | 1 | handler-side production code that **emits** it (`apiGatewayHandler.ts:43`) |
| `svc-images` | 2 | the same, in two handlers |
| `svc-jobs` | 5 | one test that **MASKS** it (`key === 'stackTrace' ? '[stack]' : held`), its snapshot, and a behavior doc |

🔴 **the single test in the population that meets `stackTrace` actively removes it**, and says why:
*"the envelope carries a `stackTrace` of absolute paths — this machine's"*. so it is unassertable by
nature, not merely unasserted.

⇒ **branch A would add a type parameter to serve zero measured assertions**, on a field the one
consumer who encounters it deletes. `rule.prefer.wet-over-dry`: wait for the third real usage; there
is not a first.

### what it costs, stated plainly

a case=7 migrant on a legacy handler who *does* want to read `res.stackTrace` gets a compile error.
their route is the same as any unmodeled shape — narrow it themselves. **the fields they actually
assert on — `errorMessage`, `errorType` — are modeled**, because the legacy envelope is structurally
assignable to `Ancient`.

## rework

**clean, and additive.** to reverse is to add a parameter with a default, which breaks no call
already written. this is the same shape as F9's own rework argument.

## confidence, and why 93%

high, and it sits exactly at the bar. the measurement is decisive on the question asked, and its
bound is honest: it is scoped to `ahbode/*` **local clones**, which is the same floor every reach
figure on this drive uses. a consumer outside that set could assert on `stackTrace` — and would then
be the first.

the 7%: branch A costs little (a defaulted parameter is invisible until used), so a maintainer who
weighs *future* legacy-family work above present simplicity could reasonably take it.

## where

- `src/domain.operations/runLambdaEndpoint/dialect/LambdaEndpointRunOutput.ts:36-39` — the two-parameter type
- `src/domain.operations/runLambdaEndpoint/runLambdaEndpoint.onReferenced.ts:86-89` — the signature that has no fourth knob
- [F9](inventory.of=fulcrums.case=F9-dialect-as-a-generic.md)'s third bound — where the question was raised and handed forward

## the verdict

_unruled — open for the council._
