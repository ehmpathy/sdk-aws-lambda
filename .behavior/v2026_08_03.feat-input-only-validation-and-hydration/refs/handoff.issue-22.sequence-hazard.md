## the open question, answered — and the answer changes the fix

this issue records:

> **not verified**: whether `unrepresentable: 'any'` alone also resolves #17's transform case — the
> transform branch of the renderer was not read, so the two are filed apart rather than merged on a
> guess.

**it does stop the crash — and that is exactly why it must not land alone.**

executed against `zod@4.4.3` + `domain-objects@0.34.0`:

| the schema | `{ unrepresentable: 'any' }` alone | `{ io: 'input' }` alone |
|---|---|---|
| a `.transform()` | `"id": {}` — **crash gone, schema erased** | `"id": { "type": "string" }` — the true wire shape |
| an `X.contract()` dobj | `"surfer": {}` — **the `x-domain-object` pragma is destroyed** | full shape, pragma intact |
| a `z.custom` | `"id": {}` — correct, it genuinely has no rendition | 💥 still throws |

## 🔴 the hazard: `unrepresentable: 'any'` alone would silently gut the codegen

a `.transform()` and an `X.contract()` **do** have a json-schema rendition — their **input** face.
so a degrade to `{}` is not an honest *"this cannot be rendered"*; it is a lie that says *"this
field is unconstrained"* about a field with a precise wire shape.

the sharpest instance is the dobj row. `genServiceSdk` recognizes a domain object by the
`x-domain-object` pragma (`getAllDomainObjectsFromContracts.ts`). under `unrepresentable: 'any'`
that pragma is **gone** — so every generated cross-service client silently degrades from a typed
resource to `unknown`, with no crash and no tell.

⇒ and this is no longer an edge case: **`domain-objects@0.34.0` made `X.contract()` always
coerce**, and a coerce is a `.transform()`. so on `0.34.0` *every* dobj position in *every* schema
takes this path.

## ⇒ the two fixes are complementary, and the order matters

| | `#17` — `{ io: 'input' }` | `#22` — `{ unrepresentable: 'any' }` |
|---|---|---|
| what it is for | a type that HAS a wire rendition, on its wire face | a type that genuinely has none |
| transform / dobj | **publishes the truth** | erases it to `{}` |
| `z.custom` | still throws | **the only fix** |

both are wanted, and the safe composition is
`z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })` — measured: one schema that
carries a transform, a `z.custom`, and a dobj emits cleanly, with the transform's string shape
intact, the dobj's pragma intact, and only the `z.custom` degraded to `{}`.

**so please do not land `#22` before `#17`.** alone it converts a loud crash into a quiet,
service-wide codegen regression — which is strictly worse (`rule.forbid.failhide`).

## one more, for free

`z.void()` and `z.undefined()` throw the same class of error (`Void cannot be represented in JSON
Schema`), io-independent. filed separately as **#29**, since the declaration question there is
bigger than the render option.

⚠️ **CORRECTED — an earlier draft of this handoff said `unrepresentable: 'any'` "fixes those too",
and that is false in the way that matters.** the flag makes them PUBLISH; it publishes `{}`, which
tells a caller that **any** value is valid — the exact inverse of what the position declares. so
the flag converts a loud crash into a quiet lie, which is the same `rule.forbid.failhide` shape
this whole handoff is about, one level in.

the honest render is `{ "not": {} }` — "no json value is valid here" — and it needs the flag PLUS
an `override` that re-writes those two node types. `#17`'s branch ships exactly that:

```ts
z.toJSONSchema(schema, {
  io: 'input',
  unrepresentable: 'any',        // disarms the throw, for EVERY un-renderable kind
  override: setAbsentPositionsRendered, // re-arms it for every kind but the two that render
});
```

⇒ **this sharpens the ask above rather than softens it.** the flag alone also silences `date`,
`bigint`, `symbol`, `map` and `custom` to `{}` — measured on `zod@4.4.3`. so `{ io: 'input',
unrepresentable: 'any' }` on its own is still a failhide for five more kinds, and the override is
what keeps them loud. if `#22` lands the flag with no override, it trades one crash for six
silences.

## .provenance

- every cell in both tables was **executed**; probe files were scratch and are deleted, outputs
  transcribed verbatim
- **verified**: each emit, and that the `x-domain-object` pragma is absent under
  `unrepresentable: 'any'`
- **not verified**: whether any live service has already generated a client that would change shape
  — measured at the emitter, not in the fleet
- found by the `feat-input-only-validation-and-hydration` bound, which carries `#17`