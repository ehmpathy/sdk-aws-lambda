# F10 — the event factories are wire-faithful by default

> raised at i015, when the D6 axis was declared and both peer lanes graded the factory family's
> absence a blocker.

## the fork, stated fairly

the wisher ruled the event-factory family in scope (wish **A2**, 8 repos / 254 sites). the
incumbent hardcodes every aws-specific field of every envelope to one sentinel:

```ts
// eventMetadataWhichShouldNotBeNeeded.ts:10
export const EVENT_METADATA_WHICH_SHOULD_NOT_BE_NEEDED = undefined as any;
```

and it carries a **documented argument** for that choice (`:5-8`):

> *"because it would couple the contract of a lambda too closely with aws-specific +
> event-trigger-specific + lambda-api-specific metadata … contract should be based on request
> **data**, not environment specific **metadata**"*

so the fork is:

- **preserve the position** — the successor keeps the sentinel, and a handler that reads aws
  metadata fails loudly in its tests, which is the incumbent's stated intent
- **be wire-faithful** — the successor supplies what aws actually sends, and a handler that reads
  metadata is caught by review rather than by an undefined deref

## taken

**taken: wire-faithful by default, with per-field override.** the factory emits what aws sends;
the author overrides only the field their test is about.

## why, at the time

**1 — the position is coherent and mis-aimed, and the correction is narrow.** the argument is a
claim about what a **handler** should read. it is not a claim about what a **fixture** should send.
a fixture that withholds what aws sends does not *enforce* the position — it hides the handlers that
violate it behind a `TypeError`.

**2 — the incumbent is measurably broken by this, today.** `forApiGateway` reads
`requestContext.requestId` while it reshapes a v1 event, before any schema runs. with the sentinel
that deref throws, and `genInternalServiceErrorMiddleware.ts:39-58` answers a **500** — so the
schema never runs and every assertion past the status check is unreachable. this is on record as
`ehmpathy/sdk-aws-lambda#18`, open against this repo.

**3 — three consumers have already voted with a fork.**

| repo | the fork |
|---|---|
| `ahbode/svc-gateway` | `blackbox/createExampleApiGatewayEvent.ts` — supplies `requestContext` + `Accept`; its doc-note calls itself *"the local half of the repair"* and names `#18` as the upstream half |
| `ahbode/svc-funnel-comms` | `src/__test_utils__/createExampleSQSEvent.ts` |
| `ahbode/svc-quotes` | `src/__test_utils__/createExampleSQSEvent.ts` |

⇒ **a fixture three consumers fork is a fixture whose contract is wrong**, not a fixture they
misused. to re-publish the incumbent shape under a new name would import a known defect into the
sdk that also owns the handler it breaks.

**4 — it satisfies `rule.prefer.prevent-over-correct` at a higher rung.** the sentinel is rung 4
at best (report the failure), and it does not even manage that — the report blames the handler.
wire-faithful defaults are rung 1: the failure cannot occur.

**5 — the `Accept` header is the same defect, second instance.** middy picks a response serializer
by a match against `Accept` (`/^application\/json$/`). no header, no serializer, so `body` is handed
back as an **object** where api gateway requires a string. one omission, two failures.

## 🔴 what it does NOT decide

| bound | why |
|---|---|
| **which fields count as "what aws sends"** | the full v1/v2 api-gateway envelope is wide. the blueprint must pick a floor — `requestContext` and `Accept` are proven necessary; the rest is unmeasured |
| **whether the incumbent's position gets a home** | the argument is good and should probably become a **lint rule on handlers**, not a fixture behavior. that is a separate wish |
| **the sqs/sns/kinesis/s3 envelopes** | E2–E5 are itemized alterpaths — no live defect is on record for them, so `rule.prefer.wet-over-dry` says match the incumbent until one appears |

### 🔴 the four non-api-gateway sources inherited a CONCLUSION, never the probe

raised at i038 r010 `enroll-impl-behavior-intent`, verbatim:

> *"the bound of 'what counts as wire-faithful' per source (sqs/sns/kinesis/s3) beyond api-gateway
> is unmeasured/itemized-as-alterpath rather than demoed. If a consumer's sns/kinesis/s3 handler
> reads a metadata field the factory doesn't supply, there's no snapshot that would catch the gap
> before it manufactures a defect the way api-gateway's did (`#18`)."*

🔴 **taken, because it names an ASYMMETRY the bound above states as a uniformity.** the row reads
*"no live defect is on record"* for all four, which is true and hides how the api-gateway row earned
its evidence:

| source | why its field set is what it is |
|---|---|
| **api-gateway** | 🔴 **measured** — `#18` manufactured a defect, three repos forked a fixture, and the probe was forced |
| **sqs · sns · kinesis · s3** | ⚠️ **inherited** — the same *conclusion* applied, with no equivalent probe run |

⇒ **"no defect is on record" and "no defect exists" are different claims**, and only the first is
measured. api-gateway had no defect on record either, until `#18` put one there.

⚠️ **and the charge's second clause is the sharper half: there is no clamp to write.** a snapshot
of a factory's own output asserts what the factory emits, never what aws emits — so it would go
green on an unfaithful default. the only real probe is a measured population per source, which is a
measurement pass of its own.

⇒ recorded as an open bound over repaired here, per `rule.always.fix-forward-under-scouts-honor`:
CLEAN fails, not SAFE.

## rework, and why clean

**clean.** the factory is unbuilt surface — no consumer holds it. and the direction of safety helps:
a test written against a wire-faithful default still passes if the defaults later grow a field, so
long as the override path exists. the reverse would not hold.

⚠️ **the one way it could go dirty** is if a consumer's handler comes to *depend* on a metadata
field the factory supplies. that is the very hazard the incumbent's position warns against — so the
mitigation is the lint rule in the bounds table, not a change to this call.

## confidence

**94%.** the evidence is unusually strong for a vision-stage call: an open bug, a documented
consumer fork that names it, and a second independent failure (`Accept`) from the same omission.

the residual 6% is that the incumbent's author may hold context i do not — the sentinel is
deliberate and argued, never careless, and a wisher who weighs the contract-purity position more
heavily could rule that the *handler* should be fixed and the fixture left alone. ⇒ that verdict
would keep `#18` open, so i judge it unlikely.

## where

- `asLambdaEvent.fromApiGateway` — the field set it supplies by default
- every test in the 187 api-gateway sites that today works around the omission
- `ehmpathy/sdk-aws-lambda#18`, which this closes

## the demo

[case=11 — the fixture manufactures the defect it was meant to report](../1.vision.experience.case=11.the-fixture-manufactures-the-defect.md)
