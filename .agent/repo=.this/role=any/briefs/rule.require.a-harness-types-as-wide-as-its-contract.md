# rule.require.a-harness-types-as-wide-as-its-contract

## .what

a test harness's input type must be **as wide as the contract it fronts**. when a harness is typed
narrower than the public type, the arms it omits become **unreachable by every case that harness will
ever host** — so the gap is structural, and no amount of added coverage can close it.

```ts
// 👎 the harness fronts a union, typed as one arm
type ApiGatewayHandler = (payload: APIGatewayProxyEvent, …) => …;
//                                ^ the public contract is
//                                  `APIGatewayProxyEvent | APIGatewayProxyEventV2`.
//   so every case this harness hosts runs the v1 arm, and a v2 case cannot be
//   WRITTEN without a cast. 11 wire cases, 22 review rounds, one arm proven.

// 👍 the harness is as wide as the contract, and picks an arm by value
type ApiGatewayHandler = (payload: ApiGatewayRequestPayload, …) => …;
genApiGatewayProxyHarness({ handler, version: 'v2' });
```

## .why

a narrow harness is the quietest coverage gap there is, because **it does not look like a gap** — it
looks like a suite. every case is green, every case is real, and the absent arm has no absence to
notice: no skipped test, no `todo`, no red. the count of cases even argues *against* the question —
eleven wire proofs read as thorough.

three costs, and they compound:

- **it caps the ceiling silently.** a reviewer who asks *"is this covered?"* counts cases and finds
  many. the right question is *"what shapes CAN this harness deliver?"*, and no part of the suite
  prompts it.
- **the fix is not a test, it is a type.** so a reviewer who spots the gap and adds a case discovers
  the case will not compile, and may conclude the arm is untestable rather than that the harness is
  wrong.
- **it hides behind the contract's own widening.** the harness was typed correctly when the contract
  was narrow. the contract widened, the harness did not, and no compiler complains — a narrow
  parameter accepts fewer inputs, so it stays type-valid forever.

measured on the case that produced this rule: `ApiGatewayRequestPayload` is
`APIGatewayProxyEvent | APIGatewayProxyEventV2`, and the wire harness typed its handler
`APIGatewayProxyEvent`. **all 11 wire acceptance cases — the entire proof of the wish's central
claim — ran only the v1 arm, for 22 iterations of peer review.** the gap survived nine l1 reviewers
and two l3 reviewers, and the reviewer who found it did so by an argument about *inference*, never by
a count of cases.

and the arm was defended by exactly the reasoning this repo already forbids: *"aws accepts that shape
from an http-api integration too, so it's very likely fine."*

## .the test — for the proposer

when you write or touch a harness, ask: **"what is the widest input the contract accepts, and can
this harness deliver it?"**

| the harness's input type is | verdict |
|---|---|
| identical to the public contract's | ✅ |
| one arm of the contract's union | **widen it, and add a selector** |
| a supertype (looser) than the contract | fine — the cases bound it |
| the contract's type, but the BUILDER only ever emits one shape | **the same defect, one level in** — see below |

⚠️ **the type is necessary and not sufficient.** a harness may be typed on the union and still build
only one arm, which is the identical gap with a correct signature. so check the **builder** too: count
the shapes it can emit, and compare that count to the arms of the contract.

then pick the arm **by value, at one dispatch**, never by a second harness — two harnesses is
`rule.forbid.parallel-codepaths` and the second will drift.

## .the test — for the reviewer

do not count cases. **read the harness's signature, and compare it to the public type it fronts.**

- same width → the suite *can* prove the contract
- narrower → every case below it is bounded, whatever the count

the tells:

- a harness parameter that names **one member** of a union exported from `src/index.ts`
- a builder function whose return type is a single concrete shape, where the contract is a union
- a suite whose cases all pass one `version` / `kind` / `format` and never vary it
- a reviewer's note that an arm is *"very likely fine"*, *"accepted in compatibility mode"*, or
  *"the same in practice"* — that is the inference this rule turns into a run
  (`rule.require.measure-the-value-you-emit`)

and one structural tell: **the contract widened in this diff, and the harness did not appear in it.**
a widen is exactly when this defect is created, and the compiler is silent by construction.

## .the caveat

- **not every arm owes a full case matrix.** the demand is that the harness *can* deliver each arm,
  and that the claims which differ per arm are proven per arm. an arm whose behavior is provably
  identical may share cases — say so, and say why.
- **a deliberately narrow harness is fine when the narrowing is the point** — a v1-only regression
  harness for a v1-only defect. name the bound so the next reader does not mistake it for the whole
  contract.
- **a private, internal contract owes less than a public one.** the rule bites hardest where the
  union is exported, because a consumer may supply either arm.
- **a widened harness with a defaulted selector costs the extant cases zero** — that default is what
  makes this fix cheap, and its absence is what makes a second harness tempting.

## .enforcement

- a harness typed as one arm of the public union it fronts = **blocker**
- a harness typed on the union whose builder emits only one arm = **blocker** (same gap, correct
  signature)
- an arm covered by an argument that it behaves like another arm, with no run = **blocker**
  (`rule.require.measure-the-value-you-emit`)
- a second harness added for the second arm, rather than a selector on the first = **blocker**
  (`rule.forbid.parallel-codepaths`)
- a deliberately narrow harness whose bound is named = false positive
- arms that share cases, with the sameness argued and the argument recorded = false positive

## .see also

- `rule.require.measure-the-value-you-emit` — the parent: a claim owes a run, not a read. this rule
  names the one place where a run is **impossible to write** until a type changes first
- `rule.require.positive-control-before-absence-claims` — how to confirm the absent arm is really
  absent rather than a grep artifact; the find that produced this rule was verified that way
- `rule.require.retest-the-model-on-every-family` — the same discipline at model grain: derived from
  one consumer, applied to two
- `rule.forbid.parallel-codepaths` — why the fix is a selector rather than a second harness
- `rule.require.review-attempts-deletion` — *"what shapes can this harness never deliver?"* is a
  deletion question, and a count of cases is not
