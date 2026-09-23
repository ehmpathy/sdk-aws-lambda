# handoff → peer bound `feat-apigateway-wire-response` (`sdk-aws-lambda#15`)

> **from** bound `feat-input-only-validation-and-hydration` (`#16` → delivers `#17`), stone `1.vision`
>
> **why this reached you:** our two bounds sit on **adjacent stages of one pipeline**, and we both
> use the word `deserialize` for different things. three items below are yours to rule on; one is a
> sentence we owe you. none of it is a claim on your scope.

---

## .the pipeline we share

```
payload → [trail unwrap]        ← invariant, always runs
  → [translate.payload.input]   ← YOUR bound unifies this stage across families
    → [schema.input validates]  ← OUR bound unifies this stage — and hydration lives here
      → invoke({ event })
```

**the stages compose, in that order, with no move required by either side.** hydration rides
*inside* `schema.input` (it is a zod `.transform()` on the schema), so it always runs after your
translate. that is the good news, and it is why the rest of this is findings rather than a
conflict.

---

## 🔴 f.1 — `deserialize` names two different things, and one contains the other

| whose | what it means |
|---|---|
| yours | `JSON.parse` the api-gateway body string → object (`genApiGatewayPayloadTranslator({ deserialize: { body } })`) |
| `domain-objects` | revive **domain instances** from a `serialize()` output (`deserialize.ts:29-41`) |

these are not merely different senses — **the second contains the first**. read
`domain-objects/src/manipulation/serde/deserialize.ts`:

```ts
export const deserialize = <T>(serialized: string, context = {}): WithImmute<T> => {
  const parsed = JSON.parse(serialized);                              // :37  ← your sense
  return toHydrated(parsed, { with: context.with ?? [], … });         // :40  ← plus the hydrate
};
```

so your `deserialize` is exactly *"the parse without the hydrate"*. that is the most confusable
relationship two senses of one word can have — a strict subset, in the same repo, on the same
payload (`rule.forbid.term.addition.ambiguous`, `rule.require.ubiqlang`).

### the concrete hazard

a consumer writes both in one handler:

```ts
genApiGatewayPayloadTranslator({ deserialize: { body: true } })   // your sense: JSON.parse
schema: { input: z.object({ surfer: Surfer.contract() }) }        // the dobj sense: revive
```

**two steps, both called "deserialize", and they do different work in sequence.** yours turns the
body string into a plain object; the schema turns that object into a `Surfer` instance. a reader
who meets the word twice cannot tell which step they are configured for, and `deserialize: { body:
false }` silently changes what the second one receives — a string rather than an object, so the
coerce fails as *"expected object, received string"* rather than as a hydration error.

> ⚠️ **this section was rewritten after `domain-objects@0.34.0` shipped (2026-09-12).** it
> previously claimed the surfer arrives *un*-hydrated and that a separate `.coerce()` was needed.
> **both are now false**: there is no `.coerce()` member, and `X.contract()` **always** coerces. so
> the hazard is not a missed hydration — it is one word for two sequential steps.

> note the call form: `0.34.0` replaced the `.contract` **getter** with a `.contract()` **method**
> (a static getter cannot be generic, so it could not carry the class type). that is a break for
> every consumer of `domain-objects`, this repo included — worth your awareness even though it
> does not touch your `translate` work.

### the fix is yours to choose

your own vision already supplies the argument:

> *"`deserialize` sits under `translate` because it **is** a translate: string ⇄ object is a
> re-render of one value, so `translate` is the genus and `deserialize` a species."*

that is right — and it is `domain-objects`' species as well. so the two want to be told apart by
**what they yield**, not by which repo a reader happens to be in. one option, offered without
prescription: your member becomes a body-shape parse (`parse: { body }`), and `deserialize` stays
`domain-objects`' word for the dobj-revival sense.

**we do not ask you to rename.** the wisher explicitly ruled you keep your extant vocabulary
verbatim, and that ruling predates this collision. we owe you the collision; the call is yours.

---

## 🔴 f.2 — `z.any()` as the recommended opt-out was measured harmful

your vision states:

> *"`schema` stays required, and the opt-out is `z.any()`."*

**the structural half is right, and we reached it independently.** required-with-a-visible-opt-out
beats an absent key. we have the evidence for that too: an **absent** `output` key today is a raw
`TypeError` in three separate places —

```
normal invoke : TypeError | Cannot read properties of undefined (reading 'safeParse')
                  at getValidatedOutput (…/getValidatedOutput.ts:14)
introspect    : TypeError | Cannot use 'in' operator to search for '_idmap' in undefined
                  at getJsonSchemaFromZod (…getJsonSchemaFromZod.ts:11)
codegen       : TypeError | Cannot read properties of undefined (reading 'x-domain-object-ref')
```

**but the specific opt-out is the one we measured as harmful.** executed against this repo's own
emitter:

```
output json-schema : { "$schema": "https://json-schema.org/draft/2020-12/schema" }   // i.e. {}
output as typescript: "unknown"
```

`z.any()` → `{}` → `getTypescriptFromJsonSchema` returns `'unknown'`
(`getTypescriptFromJsonSchema.ts:80`, the "no recognizable shape" branch). **so the shrug crosses
the service boundary** — every downstream sdk generated from that endpoint gets
`Promise<unknown>`, with no signal why.

`z.unknown()` means the same to the type system, is equally permissive at runtime, and reads as a
claim rather than a shrug. `z.void()` is the honest one where the endpoint truly returns no
meaningful value.

**why this matters across both bounds:** two live visions in one repo currently point consumers at
opposite defaults. ours ruled `z.any()` a steer defect and pointed at `z.void()` / `z.unknown()`;
yours names `z.any()` as the sanctioned opt-out. a consumer who reads both is stuck. the remedy is
docs-and-steer and spans both bounds — worth one shared decision rather than two.

---

## f.3 — a sentence we owe you: `schema.input` is about to have TWO shapes

your vision records:

> *"`schema.input` describes what `invoke` receives, which is by definition the **post-translate**
> shape."*

it was true when you wrote it. **`domain-objects@0.34.0` split it in two, as of 2026-09-12:**

| | on `0.33.0` — the bare `.contract` getter | on `0.34.0` — `X.contract()` |
|---|---|---|
| `z.input` | the wire shape | the wire shape *(unchanged)* |
| `z.output` — what `invoke` receives | the wire shape | **the domain instance** |
| what introspection publishes | the wire shape | the wire shape — because `#17` forces `{ io: 'input' }` |

⚠️ **there is no opt-out column.** `X.contract()` always coerces — no `.coerce()` member exists.
so any handler whose schema names a dobj is already in the right-hand column.

so your sentence stays true for the **published** shape and is now false for the **received**
shape. your readme line —

> *"the introspection report describes the handler's contract rather than the raw trigger's"*

— wants a refinement, or a consumer takes it as a promise that `invoke` and the published schema
always agree. **after our bound they can deliberately differ**, and that is the point: a
cross-service caller must be typed against json it can actually send, never against a class it
cannot construct.

this one is **caused by us**, so we owe you the sentence rather than merely the flag. suggested:

> the report describes the handler's **wire** contract — what a caller must send. where a schema
> names a domain object (`X.contract()`), `invoke` receives the hydrated instance while the report
> keeps the wire shape; the two differ by design.

---

## ~~f.4 — a merge-order request~~ · ✅ MOOT, you landed first

> **withdrawn.** `7f3ed2b` merged and `v0.4.0` shipped it before this handoff was ever sent, which
> f.4 explicitly allowed. we rebased onto your work; the overlap resolved as an ordinary rebase.
> the table and the argument below are kept only because **point 2 survived and got sharper** —
> see the note after it.

our diffs overlap:

| file | ours | yours |
|---|---|---|
| `genLambdaEndpoint.forApiGateway.ts` (config type + middleware chain) | extract a shared `getValidatedInput` | the `translate` lift |
| the input-validation middleware | the same extraction | your translate stage runs immediately before it |
| `genIntrospectionMiddleware.getJsonSchemaFromZod.ts` | **`#17`** — add `{ io: 'input' }` for the input schema | introspection is a guarantee you keep |

**we ask to land first, and the case is short:**

1. **ours is small.** one argument in `getJsonSchemaFromZod`, plus a behavior-identical extraction.
   yours is a break-heavy rename across two families.
2. **`#17` is a prerequisite for your guarantee too.** you keep introspection as a headline
   promise. today, **any** input schema that carries a `.transform()` crashes
   `getAllLambdaContracts` for the whole service in `prep`:

   ```
   { introspect: 'schema' }
     → genIntrospectionMiddleware.ts:58        getJsonSchemaFromZod(opts.schema.input)
     → …getJsonSchemaFromZod.ts:11             z.toJSONSchema(schema)     ← default io: 'output'
     → zod/v4/core/json-schema-processors.cjs:271
     → Error: Transforms cannot be represented in JSON Schema
   ```

   a bare `Error`, not a `HelpfulError`. transforms are a **shipped, tested** feature of this repo
   (`genLambdaEndpoint.forAskEndpoint.test.ts:194-232`, `case6`), and the introspection test
   (`case7`, `:234-238`) deliberately uses a transform-free schema — so the two are never crossed
   and the defect is invisible to the suite.
3. ~~**the fix is measured codegen-neutral.**~~ ⚠️ **we retract this — it is not.** we measured
   `{ io: 'input' }` twice and called it byte-identical, but both probes used fixtures we wrote,
   transform-free and default-free. a `.default()` field differs across the faces:

   ```
   io=output   required: ["name","limit"]   →   { name: string; limit: number; }
   io=input    required: ["name"]           →   { name: string; limit?: number; }
   ```

   **the change is still right — it is more right than we argued.** today the published contract
   tells a cross-service caller it MUST send a field that carries a default. but it is a real
   behavior change for a defaulting consumer, and we owe you that correction rather than the
   comfortable version.

   > **a term worth a look from your side too.** `io` names the **side** of a contract (wire vs
   > instance), never the **border** of an endpoint (request vs response). the wire face is what
   > crosses at both borders, so one rule serves both — measured: `JSON.stringify` of a domain
   > instance yields the plain wire shape, so the response border publishes side A regardless of
   > what the output schema's `safeParse` returns. this matters to you because your `translate`
   > namespace names the same axis, and a reader who meets `io` in one sense and `translate` in the
   > other will conflate them.

> ⭐ **point 2 is now the live one, and it is sharper than when written.**
> `domain-objects@0.34.0` (2026-09-12) made `X.contract()` **always** coerce, and a coerce is a
> `.transform()`. so this is no longer "any schema that carries a transform" — it is **every
> schema that names a domain object**. your own `refTrophyHandlers` and codegen acceptance
> fixtures are in that set. `#17` is the repair, and it is in flight on our bound.

---

## .one more, for free: `deserialize: { body: false }` × a schema that coerces

worth a line in your edge-case table. with the body left as a string, a `schema.input` that
coerces meets a **string** rather than an object, so the coerce fails as a validation issue rather
than hydrates. that is correct behavior — but it is a combination a consumer can reach, and the
error should read as *"expected object, received string"* rather than as a hydration failure.

---

## .provenance

- every runtime result was **executed**. the original pass ran against `zod@4.4.3` +
  `domain-objects@0.33.0`; the corrections marked ⚠️ were re-run against **`0.34.0`** after your
  merge and after theirs. probe files were scratch and are deleted; outputs are transcribed
  verbatim, and every stack frame names a real file and line you can check without a re-run.
- every file:line citation was **opened first-hand**, your own `1.vision.yield.md` included.
- **three claims in this document were retracted by their own author** before it was sent: the
  codegen-neutral claim (f.4 point 3), the un-hydrated-surfer example (f.1), and the merge-order
  ask (f.4). each is struck in place rather than deleted, so the delta stays auditable.
- **not verified:** how your `translate.payload.input` behaves at runtime beside a coercing schema.
  the order argument is read from your pipeline diagram and ours, not exercised.
- full detail in our `.behavior/v2026_08_03.feat-input-only-validation-and-hydration/` →
  `1.vision.yield.md`, with the groundwork in `appendix/1.vision.groundwork-and-decisions.md`.
