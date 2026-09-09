# rule.require.explicit-optout

## .what

when a config field carries a guarantee, declare it **required** and give the caller an
explicit opt-out **value**. never make the field optional and let its absence disable the
guarantee.

```ts
// 👍 required; opt out by value
schema: { input: ZodSchema<TInput>; output: ZodSchema<TBody> }   // z.any() = opt out, on the page

// 👎 optional; opt out by absence
schema?: { input: ZodSchema<TInput>; output: ZodSchema<TBody> }  // absent = validation off, silently
```

## .why

an optional field whose absence disables a guarantee buys one keystroke and costs three real
things:

- **two code paths** — every consumer of the field must branch on presence. in the case that
  produced this rule, absence would have branched *validation* AND *introspection* at once, so
  one omitted field silently moved two guarantees (`rule.avoid.unnecessary-ifs`).
- **an unreviewable choice** — a caller who forgot the field looks identical to a caller who
  chose to skip it. no reviewer can tell a deliberate opt-out from an oversight, so neither can
  a future reader.
- **the wrong default** — absence is the path of least resistance, so the unguarded shape
  becomes the common shape (`rule.require.safe-by-default`).

a required field with a visible opt-out value collapses both paths, keeps the safe shape as the
default, and puts the choice where a reviewer can see it.

## .the test — for the proposer

for each optional field ask: **"if a caller omits this, does the operation still make the same
guarantee?"**

| answer | verdict |
|---|---|
| yes — absence changes only decoration (a label, a color, a log prefix) | optional is fine |
| no — absence turns a guarantee off, or forks a code path | **required, with an explicit opt-out value** |

## .the test — for the reviewer

read every `?:` in the proposal. for each, ask what the code does when the field is absent. if
the absent branch skips a validation, a guard, a log, or a report, flag it: the field must be
required and the opt-out must be a value.

a second tell: the proposal justifies the option by **caller convenience** ("spares the author
the ceremony"). convenience is not a guarantee, so it never pays for a code path.

## .the shape of an opt-out value

the opt-out must be a real value that states the choice, not a hole:

| guarantee | opt-out value |
|---|---|
| schema validation | `z.any()` |
| a retry policy | `{ attempts: 1 }` |
| a cache | `{ ttl: 0 }` |
| a redaction projection | an identity projection, declared |

each of those reads as a decision. `undefined` reads as an accident.

## .the bonus

a required field with a sentinel keeps the **report** honest. an endpoint declared `z.any()`
introspects as `any` — a true statement of its contract. an endpoint with the field absent
introspects as no contract at all, which is a gap that reads like an outage.

## .examples

### 👎 bad — absence disables two guarantees at once

```ts
const forApiGateway = <TInput, TBody>(config: {
  schema?: { input: ZodSchema<TInput>; output: ZodSchema<TBody> };
  invoke: ...;
}) => {
  // path A vs path B, forked on presence
  if (config.schema) chain.use(genValidationMiddleware(config.schema));
  if (config.schema) chain.use(genIntrospectionMiddleware(config.schema));
  // a caller who forgot `schema` gets neither, and no one can tell they forgot
};
```

### 👍 good — required, opt out by value, one path

```ts
const forApiGateway = <TInput, TBody>(config: {
  schema: { input: ZodSchema<TInput>; output: ZodSchema<TBody> };  // z.any() to opt out
  invoke: ...;
}) => {
  chain.use(genValidationMiddleware(config.schema));     // always
  chain.use(genIntrospectionMiddleware(config.schema));  // always
};

// the caller's opt-out is legible at the call site
forApiGateway({
  schema: { input: z.any(), output: z.undefined() },  // form blob in, no body out
  invoke: async ({ event }) => ({ status: 204 }),
});
```

## .enforcement

- an optional config field whose absence disables a guarantee or forks a code path = **blocker**
- an optional field justified only by caller convenience, where a sentinel value would serve = **blocker**
- an optional field whose absence changes only decoration = false positive

## .see also

- ⚖️ **`rule.forbid.opposite-senses-on-undefined-and-null` — the COUNTERWEIGHT.** this rule says
  the opt-out must be a **value**; that one says **which** value. applied alone, this rule permits
  `null` as an off-state beside an `undefined` that means default-**on** — inverse senses on the two
  most confusable values in the language. read the pair together
- `rule.require.safe-by-default` (ergonomist) — why the easy path must be the guarded path
- `rule.forbid.undefined-inputs` (mechanic) — the internal-contract twin: null over absent
- `rule.avoid.unnecessary-ifs` (mechanic) — the code path this deletes
- `rule.require.illegal-states-unrepresentable` — hold the shape in the type once the field is required
