# define.blackbox-suite-grains

## .what

this repo's product is a **function**, never a service. so its contract boundary is
`src/index.ts`, and an acceptance test crosses that boundary by calling an export from it.

`blackbox/` holds two families, and the axis between them is the **transport**, never the
boundary:

| family | the action | what it proves | what it cannot prove |
|---|---|---|---|
| `local.*` | invoke the produced handler in-process, with AWS's own `(event, context)` signature | the handler's own behavior — its validation, its introspection, its serialized return | any property of the AWS transport |
| `deployed.*` | invoke a real lambda through the AWS sdk | the transport, the bundle, the cold path, the deployed schema | — |

**both families cross the same boundary.** measured: every suite in `blackbox/` reaches
`src/index` — 9 of 13 import it directly, the other 4 through a fixture in
`blackbox/__test_assets__/` that does (`grepsafe --pattern "from '\.\./src/index'" --path blackbox`
→ 14 hits across 14 files; the same form returns hits, so the scope is reachable).

## .why this brief exists

`rule.require.acceptance.blackbox` (ehmpathy/mechanic) states the boundary rule for a **service**:

> the operation under test must be invoked through `@/contract/`

every example it carries is service-shaped — an http endpoint, a `request(app).post(...)`, a dao.
so a reader of this repo looks straight past it and cannot answer the one question that matters
here: *for a library whose deliverable is a function, what IS the contract boundary?*

⇒ this is the specialization that rule defers to. it does not soften the rule — it names the
subject the generic examples do not reach.

**the harm it prevents is real, and it landed:** a peer reviewer read `invokeHandlerForTest(handler, …)`
as *"the action drives an internal handler"* and raised it as a blocker twice. the driver refuted
it twice with an argument about a convention **nobody had written down** — and an unwritten
convention is an assertion, never a thing a reviewer can defer to
(`rule.require.reread-the-subject-a-repeated-find-names`).

## .the boundary, precisely

```ts
// blackbox/__test_assets__/surfboardContractHandler.ts
import { genLambdaEndpoint } from '../../src/index';   // <-- THE public export (src/index.ts:63)

export const handler = genLambdaEndpoint({ schema, invoke }, { env: { access: 'prep' } });
```

```ts
// blackbox/local.dobjWire.acceptance.test.ts
invokeHandlerForTest(handler, { event: { uuid: 'u-1' } });
//                   ^ calls handler(event, context) — the signature AWS itself calls
```

a consumer of this sdk writes **exactly** those two lines: they call `genLambdaEndpoint`, export
the result, and AWS invokes it as `handler(event, context)`. so the action crosses the contract in
both directions a consumer can observe.

| the generic rule's enforcement row | does a `local.*` suite trip it? |
|---|---|
| action via internal operation | **no** — `genLambdaEndpoint` is `src/index.ts:63` |
| import from `domain.operations/` for the test subject | **no** — the subject arrives via `src/index` |
| direct dao call as the test subject | n/a — this repo has no dao |

## 🔴 .the bound — and it is LIVE, not hypothetical

**a `local.*` suite proves no property of the AWS transport.** so a claim about the transport owes
a `deployed.*` twin, and the twin must exist rather than be asserted.

⇒ worked: `local.dobjWire` claims the surfboard fixture's wire bytes are unchanged. that fixture is
deployed and covered by `deployed.codegen`, `deployed.codegen.refs`, and `deployed.awsLambda`
(`grepsafe --pattern 'urfboard' --path blackbox` → 11 files, 3 of them `deployed.*`).

**two defects in this family are open, measured, and dreamed. this brief NAMES them; it does not
license them:**

| defect | status | record |
|---|---|---|
| every `blackbox/` suite imports `src`, never `dist` — so no suite tests the **built artifact**, which is what `rule.forbid.unit.remote-boundaries`' own classification table asks of an acceptance test | **LIVE, NOT FIXED** | `.dream/v2026_09_18.fix.the-blackbox-suite-imports-src-never-dist.md` |
| four `local.*` suites hold `jest.fn()` transport fakes, against `rule.forbid.acceptance.mocks` | **LIVE, NOT FIXED** | `.dream/v2026_09_18.fix.the-local-acceptance-gates-fake-the-lambda-transport.md` |

both predate any one branch, and both are repo-wide. a reviewer who finds either is **correct** —
this brief tells them where the record is, never that the finding is wrong.

## .the test — for the proposer

when you add a suite to `blackbox/`, answer both:

1. **does the action reach `src/index`?** directly, or through a `__test_assets__/` fixture that
   does → the boundary is crossed. anything else → you are testing an internal, and the generic
   rule binds unchanged.
2. **does the claim depend on the transport?** — the bytes AWS actually carries, a cold start, a
   bundle, a deployed schema
   - **no** → `local.*` is the right family, and its name says so
   - **yes** → it owes a `deployed.*` twin. **name the twin in the suite's `.why`**, so a reviewer
     can check it rather than take it

## .the test — for the reviewer

do not read `invokeHandlerForTest(...)` as an internal call. **follow the handler to its origin.**

- it came from `genLambdaEndpoint` / `forApiGateway` / `genServiceSdk` — an `src/index` export →
  the boundary is crossed, and this brief is the specialization to defer to
- it came from anywhere else → the generic rule binds, and the find stands

the tells that a `local.*` suite is genuinely mis-graded:

- it asserts a property of the **transport** — a status line, a lambda envelope, a cold-start
  timing — with no `deployed.*` twin named
- it reaches into `src/domain.operations/…` for the subject rather than for a harness
- it fakes the transport **and** makes a claim about the transport in the same case (the two
  together are the defect; either alone is the dreamed state above)

## .the caveat

- **this brief moves no severity.** a `local.*` suite that claims a transport property with no twin
  is still a blocker — under this brief, for a sharper reason than the generic rule could give.
- **`src/__test_assets__/` is a harness, not a subject.** `invokeHandlerForTest` supplies the lambda
  `Context` a real invocation would; `rule.require.acceptance.blackbox`'s own summary table permits
  internals in **setup** and **verify**, and this is setup.
- **the two dreamed defects are not exceptions.** when they close, this brief's `local.*` row
  changes and the bound narrows. until then the row is honest about what it does not prove.

## .enforcement

- an acceptance test whose action reaches a subject **outside** `src/index` = **blocker**
  (the generic rule, unchanged)
- a `local.*` suite that claims a transport property with no `deployed.*` twin named in its `.why`
  = **blocker**
- a `local.*` suite that both fakes the transport and asserts a transport property = **blocker**
- a new `jest.fn()` transport fake added to any `.acceptance.test.ts` = **blocker** (the dreamed
  defect is a bound on the extant four, never a licence for a fifth)
- a `local.*` suite whose action reaches `src/index` through a `__test_assets__/` fixture = **false
  positive** — that is this brief satisfied
- a suite that imports `src` rather than `dist` = **false positive at the suite grain**; it is the
  repo-wide dreamed defect above, and belongs to that record

## .see also

- `rule.require.acceptance.blackbox` (ehmpathy/mechanic) — the generic rule this specializes
- `rule.forbid.acceptance.mocks` (ehmpathy/mechanic) — the rule the four fakes violate
- `rule.forbid.unit.remote-boundaries` (ehmpathy/mechanic) — the classification table whose
  "blackbox via built artifact's contract" row the `src`-vs-`dist` dream is about
- `rule.require.a-harness-types-as-wide-as-its-contract` — the peer discipline on a harness: it must
  deliver every arm of the contract it fronts
- `rule.require.reread-the-subject-a-repeated-find-names` — why an unwritten convention loses to a
  written rule, and why this brief exists rather than a third refutation
