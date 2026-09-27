# rule.require.consistent-variant-contracts

> **every `genLambdaEndpoint.for*` variant speaks one vocabulary. a variant may carry FEWER slots
> than its peers — an exclusion. it may never carry an extant concept under a different word, an
> extant word under a different shape, or an extant word in a different sense — a divergence.**

```ts
// 👍 exclusion — forAsk lifts no `headers`, because a direct invoke carries no bag
invoke: ({ payload, event }, { log }) => …             // forAsk
invoke: ({ headers, payload, event }, { log }) => …    // forApiGateway

// 👎 divergence in word — the same concept, a second word
invoke: ({ attributes, payload, event }) => …          // the concept is `headers`

// 👎 divergence in sense — the right word, the wrong concept
invoke: ({ event }) => event.name                      // `event` holds the body, not the envelope
```

## .why

an author who moves between variants carries a habit, not a footnote. a divergence makes the sdk
teach the wrong word, breaks the autocomplete payoff of one family object, and hides behind the
real exclusions: a reader who meets `records` concludes "this family is different" and no longer
checks which difference is real.

exclusions and divergences look alike by eye and differ by construction: an exclusion is a slot
absent from a subset; a divergence is a slot the superset does not name.

## .the shape — one superset, every variant a subset

```ts
type InvokeInputSuperset<TShapes> = {
  headers: FrozenDeep<TShapes['headers']>;
  payload: FrozenDeep<TShapes['payload']>;
  event:   FrozenDeep<TShapes['event']>;
  records: FrozenDeep<TShapes['record'][]>;
};
```

a superset, never a base type every variant extends — a base would force every variant to carry
every slot, so an exclusion could not be expressed.

`trail` is absent on purpose: it rides `context.log.trail`, and a superset that named it would make
the forbidden `input.trail` legal (`domain.terms/trail.md`).

## .the audit, as it stands

| slot | `forAsk` | `forApiGateway` | `forSqs.perRecord` | `forSqs.perBatch` |
|---|---|---|---|---|
| `event` | ✅ | ✅ | ✅ | ✅ |
| `payload` | ✅ | ✅ | ✅ | ⛔ excluded |
| `headers` | ⛔ excluded | ✅ lowercased | ✅ verbatim | ⛔ excluded |
| `records` | ⛔ excluded | ⛔ excluded | ⛔ excluded | ✅ |
| `context` | `ContextLogTrail` | same | same | same |
| `schema.input` | `ZodSchema<TInput>` | `ZodSchema<{headers?,payload}>` | same | same |
| `schema.output` | `ZodSchema<TOutput>` | `ZodSchema<ApiGatewayResponse>` | ⛔ excluded | ⛔ excluded |
| `logTranslate?` | ✅ | ✅ | ✅ | ✅ |
| `deserialize?.payload` | ⛔ excluded | ✅ | ✅ | ✅ |
| `cors?` | ⛔ excluded | ✅ | ⛔ excluded | ⛔ excluded |

every ⛔ traces to an axis, stated at the variant's declaration:

| exclusion | axis |
|---|---|
| no `headers` at `forAsk` | a direct invoke carries no metadata bag beside its body |
| no `records` outside `perBatch` | the others carry one message per invoke |
| no `headers` / `payload` at `perBatch` | N messages; the pair rides per record |
| no `schema.output` at sqs | an sqs handler answers no one — sqs reads success or failure only |
| no `deserialize` at `forAsk` | the runtime hands it a parsed object; no wire string |
| no `cors` outside `forApiGateway` | cors is http's |

two rows look like divergences and are exclusions under an axis:

| looks like | axis |
|---|---|
| `headers` lowercased at http, verbatim at sqs | rfc 9110 makes http names case-insensitive; sqs names are case-sensitive |
| `schema.input` names a value at `forAsk`, a pair elsewhere | the schema describes the slots a caller may constrain; `forAsk` has one |

## .the test — for the proposer

before you add or rename a slot: **does the family already have a word for this concept?**

| answer | verdict |
|---|---|
| yes | use that word, whatever the transport calls it |
| no, and peers carry it too | add it to the superset first |
| no, and it is this trigger's alone | an exclusion on the peers — state the axis at the declaration |

## .the test — for the reviewer

read the four `invoke` input declarations side by side. the tells:

- a slot word on exactly one variant with no axis stated
- a doc-comment that explains why this variant's word differs (`rule.forbid.defended-exceptions`)
- a slot added to a variant with no edit to `InvokeInputSuperset.ts`
- an axis stated as *"this family does not need it"* — need is not a property of the trigger

## .the clamp

`InvokeInputSuperset.test.ts` sits at the family root, since the claim is about the variants together:

| half | catches |
|---|---|
| type gate | a slot whose name or value type diverges; tsc prints this rule's sentence |
| sense gate | an `event` that is not an envelope which holds the body, or a lifted `payload` that is not that body. it reads the contract's own input type, so no supplied shape can satisfy it |
| runtime read | the same, plus a slot that vanishes (`Record<keyof …, true>` per variant) |
| config read | a config member (`schema`, `invoke`, `logTranslate`, `cors`, `deserialize`) that diverges or vanishes |
| bite checks (`[case2]`) | the gate itself gone toothless — synthetic divergences under `@ts-expect-error` |
| audit read | this page's table gone stale |

`InvokeInputSuperset.integration.test.ts` parses the table under `## .the audit, as it stands` and
reads each ✅ cell back against the contract's `keyof`. edit a variant's slots without this table,
or the table without the contract, and it goes red; move or drop the section and it throws a
`ConstraintError` that names the anchor.

⚠️ why the sense gate exists: the type gate compares each variant against shapes the test
supplies. `forAsk` once bound `event` to the validated body, the test supplied the body as the
event shape, and word and type both matched. the sense gate reads what `event` holds; `[case2][t3]`
is that old shape, held under `@ts-expect-error`.

⚠️ limits:

- the sense gate cannot tell a body that happens to hold a `payload` key from an envelope. each
  family's `payload === event.payload` identity case closes that at runtime
- the audit read covers the invoke-slot rows only; the config rows (decorated names) stay a
  reviewer find
- the superset does **not** clamp the freeze: typescript ignores `readonly` in assignability, so a
  variant that drops `FrozenDeep` still satisfies it. each variant's own depth arm catches that
  (`rule.require.frozen-invoke-inputs`). `[case2][t2]` asserts the limit, so it goes red if
  typescript ever starts to compare `readonly`
- the exclusion list is asserted by name, since a bare subset check passes on an empty bag

## .the caveat

- the return type is out of scope — each variant answers a different transport
- `context` is already one shape (`ContextLogTrail`) on all four
- inner shapes of optional config members are not clamped
- a genuinely new concept earns a new word and a new superset slot

## .enforcement

- a slot that names an extant concept with a new word = **blocker**
- a slot the superset does not name = **blocker**
- an exclusion with no axis at its declaration, or with *"not needed"* as its axis = **blocker**
- a slot added, renamed, or dropped with the audit table unedited = **blocker**
- a `trail` slot added to the superset = **blocker**

## .see also

- `InvokeInputSuperset.ts` — the superset and its verdict type
- `rule.require.frozen-invoke-inputs` — the peer invariant this gate cannot hold
- `domain.terms/.readme.md` — the terms
- `rule.forbid.unqualified-variant-exports` — the family object this consistency pays out through
