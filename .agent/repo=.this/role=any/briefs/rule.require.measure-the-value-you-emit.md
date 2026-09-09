# rule.require.measure-the-value-you-emit

## .what

a claim about a value **your** code emits must come from a **run**, never from the type of the
system you emit it into. a vendor's declaration constrains what they will **accept**; it says
not one word about what your pipeline actually **produces**.

```ts
// 👎 the alias asserts conformance no one measured
export type ApiGatewayResponsePayload = APIGatewayProxyResult;
//                                      ^ aws declares `body: string`, REQUIRED.
//   so the design concluded "a body-less 204 must emit body: ''" — from the type alone.
//   a run showed the serializer turns '' into '""'. the emit was body-ABSENT all along.

// 👍 the alias states the one measured divergence, and why
export type ApiGatewayResponsePayload = Omit<APIGatewayProxyResult, 'body'> & {
  body?: string; // a body-less response reaches the wire with the key ABSENT, never ''
};
```

## .why

an alias to a third-party type is the quietest claim in a codebase. `type X = VendorType` reads as
*"we add no field"*, and that reading is what stops anyone from raising the one question that
matters: **does our value actually conform?**

when it does not, three costs land at once:

- **a cast absorbs the divergence.** the boundary already holds an `as unknown as` for other
  reasons, so a shape that violates the alias compiles anyway. the type is now decorative, and the
  next reader trusts it.
- **the prose inherits the error.** the vision that produced this rule wrote *"the sdk emits
  `body: ''` — `APIGatewayProxyResult.body` is a required string"* into an edgecase table, a
  doc-comment, and a coverage plan. one unmeasured claim, propagated three times, each citation
  lending it more apparent provenance.
- **the wrong fix looks correct.** `body: ''` is a *reasonable* read of the vendor type. it is also
  the exact value that becomes `'""'` and raises twilio 11200 — the defect the work existed to fix.
  a design derived from the declaration produced a bug shaped like a fix.

## .the test — for the proposer

for every value your code hands to an external system, ask: **"have I run this, or have I read a
type?"**

| what you hold | verdict |
|---|---|
| a run whose output you inspected | ✅ claim it |
| a vendor type, a doc page, an sdk `.d.ts` | that is what they **accept** — go measure what you **emit** |
| a run of *one* case | measure the edge cases too; the divergence usually lives at an edge |

the shortcut tell: **your sentence holds "since" followed by a type.** *"emits `''`, since the type
requires a string"*, *"returns `null`, since the field is nullable"*. that "since" stands in for a
probe.

## .the test — for the reviewer

grep for `type X = <VendorType>` and, for each, ask: **"what proves our value conforms?"** if the
answer is the vendor's own declaration, the alias is unmeasured.

then look one line further, for the tell that makes it dangerous: **a cast at the same boundary.**
an alias plus an `as`-cast means the compiler cannot enforce the alias, so nothing does.

the tells:

- an alias whose doc-comment says *"we add no field; we add a NAME"* — a true and irrelevant
  statement that answers a different question than conformance
- a claim about emitted bytes, sourced to a `.d.ts` rather than to a probe
- an edge case (empty, absent, zero, one-element) whose behavior was **derived** rather than run
- a vendor type used for BOTH directions, where the two directions differ — most vendors declare
  input and output asymmetrically (`APIGatewayProxyResult.body` is required while
  `APIGatewayProxyStructuredResultV2.body` is optional, in the same package)

## .the fix ladder

1. **run it.** one throwaway probe, every case, printed. cheap.
2. **if you conform, keep the alias** and cite the probe where the design records evidence.
3. **if you diverge, declare the divergence** — `Omit<V, 'k'> & { k?: T }` — with a `.note` that
   states what you emit and why. now the compiler enforces the truth rather than a wish.
4. **never let the boundary cast absorb it.** a cast that exists for one reason must not quietly
   cover a second.

## .the caveat

- **this is not "distrust every vendor type".** vendor types are usually right about what they
  accept, and an alias that names a shape for your own vocabulary is valuable
  (`rule.prefer.names-by-position-over-claim` relies on exactly that).
- **the rule fires on a claim about YOUR emitted value**, not on a claim about their input contract.
  "aws accepts a `string` body" owes no probe. "we emit `''`" does.
- **a measured divergence is no defect** — it is a find, and a declared divergence is the fix. the
  defect is the *unmeasured* claim.
- **an input type you only consume** owes no emit probe; you do not produce that value.

## .the paired cost — a truthful type carries downstream friction, and that friction IS the point

a narrowed alias turned 24 `JSON.parse(result.body)` sites into type errors. that is no reason to
keep the untruth: each of those sites really can meet a body-less response. the correct resolution
is **one named reader that fails loud**, never a non-null assertion at each site
(`rule.require.named-transformers`, `rule.forbid.as-cast`). if the churn feels too large, that is a
measure of how far the untruth had already spread.

## .enforcement

- a claim about an emitted value, sourced to a type rather than a run = **blocker**
- an alias to a vendor type where the emitted value diverges, with the divergence undeclared =
  **blocker**
- an alias plus a boundary cast that lets a non-conforming shape compile = **blocker**
- a non-null assertion added to quiet a newly-truthful optional = **blocker** (name a reader)
- an alias whose conformance was measured, and the probe recorded = false positive
- a claim about what the vendor **accepts** = false positive

## .see also

- `rule.require.read-the-slot-a-dependency-reads` — the twin. this rule: a claim about a value you
  **emit** owes a run. that one: a claim about a slot you **share** with a dependency owes a grep of
  its source. both fire when a vendor's declaration is mistaken for verification, and both were
  measured on the same stone
- `rule.require.positive-control-before-absence-claims` — the third of the family: a claim that a
  symbol is **absent** owes a positive control, because a tool's silence is not a result. together
  the three name one defect — **a claim sourced to other than a verified observation** — with three
  sources: a vendor's type, a shared role, and a tool's zero
- `rule.require.trust-but-verify` (mechanic) — the general form; this names the one source that
  most often masquerades as verification
- `rule.require.shapefit` (mechanic) — types must fit; an alias plus a cast is the fit not held
- `rule.forbid.as-cast` (mechanic) — the cast that absorbs the divergence
- `rule.require.clamp-edge-cases` (mechanic) — once measured, clamp it; the edge is where the
  divergence lives
- `rule.require.named-transformers` (mechanic) — the reader that pays for a truthful optional
- `rule.require.retest-the-model-on-every-family` — the peer defect: a model measured on one
  consumer, applied to two
