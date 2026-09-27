# genLambdaEndpoint

## .the term

`genLambdaEndpoint` — the **family** of operations that generate a lambda handler, and the one symbol
this package exports for them.

```ts
genLambdaEndpoint.forAsk({ … })               // a direct invoke
genLambdaEndpoint.forApiGateway({ … })        // http
genLambdaEndpoint.forSqs.perRecord({ … })     // one queue message per invoke
genLambdaEndpoint.forSqs.perBatch({ … })      // the whole batch per invoke
```

never one of its variants. ⛔ no variant is exported beside it. `forSqs` is a sub-family: the sqs
trigger forces a cardinality choice no other trigger does, so the trigger names an object and the
cardinality names its leaves.

## .the etymology

| part | source |
|---|---|
| `gen` | the findsert verb (`rule.require.get-set-gen-verbs`) — it builds a handler from a config |
| `LambdaEndpoint` | the core entity of `define.lambda-endpoint-ubiqlang`; one concept, not a mash |
| `for*` | the variant qualifier, one per **trigger**. the names mirror the sources of `asLambdaEvent.from{Source}` (`ask · apiGateway · sqs · …`) |
| `per*` | the cardinality qualifier, under a trigger that forces the choice (`forSqs` only) |

`for…` is a preposition that qualifies a noun it does not carry, which is why a variant may never be
exported bare (`rule.forbid.unqualified-variant-exports`).

## .the shape

```ts
// domain.operations/genLambdaEndpoint/genLambdaEndpoint.ts
export const genLambdaEndpoint = {
  forAsk,
  forApiGateway,
  forSqs,           // { perRecord, perBatch }
};
```

| demand | what it buys |
|---|---|
| the family object exists | a peer can be added with no break |
| every variant is a key | `genLambdaEndpoint.` autocompletes the whole family |
| a plain object, no callable default | one call form per variant, so every call site names its trigger |
| no variant exported beside it | the bare peer cannot return |

| rejected | why |
|---|---|
| a callable default (`genLambdaEndpoint(…)` = `forAsk`) | two call forms for one variant, and a call site that hides which trigger it serves |
| rename the peer `genLambdaEndpointForApiGateway` | mashes the trigger into the name, and the family stays nameless |
| bare `forAsk` + `forApiGateway`, no family | no common prefix to discover them by |

## .members

| member | trigger | `invoke` input |
|---|---|---|
| `forAsk` | direct invoke | `{ payload, event }` |
| `forApiGateway` | http | `{ headers, payload, event }` |
| `forSqs.perRecord` | one sqs message | `{ headers, payload, event }` |
| `forSqs.perBatch` | an sqs batch | `{ records, event }` |

a new trigger earns a new `for*` leaf on the object and no edit to `src/index.ts`. every member's
input is a subset of `InvokeInputSuperset`, and every value in it is deep-frozen.

## .invariants

- `genLambdaEndpoint` is the family, never a variant
- every variant is a key on the object
- the object is not callable
- no variant is exported from `src/index.ts` beside it
- each variant lives in its own file under its own name, unit-tested by that name
- blackbox suites import `src/index`, never a variant file
- a sub-family exists only where a trigger forces a choice; a `for*` object with one leaf is a variant with an extra hop

## .enforcement

- `genLambdaEndpoint` bound to a single variant, or callable = **blocker**
- a `for*` variant exported bare from `src/index.ts` = **blocker**
- a variant absent from the object's key set = **blocker**
- a family clamp that reads only call sites, not the module's key set = **nitpick**
- a unit test that reaches a variant through the family = **nitpick**
- a blackbox suite that deep-imports a variant file = **blocker**

## .see also

- `rule.forbid.unqualified-variant-exports` — the general rule
- `rule.require.consistent-variant-contracts` — one superset for every member
- `rule.require.frozen-invoke-inputs` — every value handed over is frozen
- `event.md` · `payload.md` · `headers.md` · `records.md` · `trail.md`
