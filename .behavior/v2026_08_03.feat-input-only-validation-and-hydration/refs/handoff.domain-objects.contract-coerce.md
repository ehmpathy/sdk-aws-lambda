# handoff → `ehmpathy/domain-objects`: give `.contract` a `.coerce()`

> ## ✅ DELIVERED — `domain-objects@0.34.0`, published 2026-09-12
>
> **this file is now a RECORD, not an ask.** do not re-send it. the sections below are the
> original request, preserved so the delta between what we asked and what shipped stays auditable.
>
> **what shipped, and how it differs from this ask** — read from their source, then run against
> our tree:
>
> | we asked for | they shipped | verdict |
> |---|---|---|
> | a `.coerce()` method on the contract | **no such member** — `X.contract()` always coerces | **better.** one form, no way to forget it |
> | the coerce as a `z.codec` | a one-way `.transform()`, and a clamp that `z.encode` is unavailable | **their call, and it is sound** — they import zod `import type` only, so `z.codec` needs a value import they do not take |
> | `.build()` over `new` | `.build()`, guarded, with a contained ctor throw | ✅ as asked |
> | a guarded coerce from the start | ✅ a nested ctor failure is a zod issue, never a throw | ✅ as asked |
> | the `.ref` interaction settled | `.ref()` / `.ref('primary')` / `.ref('unique')`; `.ref('ref')` removed | ✅ settled, by their types |
>
> **⚠️ three claims below are now MOOT or FALSE and must not travel:**
>
> - **"the fix is measured codegen-neutral"** — **retracted.** a `.default()` field publishes as
>   `required` under `io:'output'` and optional under `io:'input'`, so the generated sdk changes.
>   the fix is still right; it is a correctness repair rather than a cosmetic one.
>
> - **the round-trip clamp** (`encode(decode(wire))` byte-equal). it presumed the codec form.
>   they shipped one-way on purpose, and clamp the absence of `z.encode` instead. their
>   convergence proof — a re-parse of a live instance is idempotent, and `JSON.stringify` of an
>   instance equals the wire — gives the same safety by another route.
> - **the `#17` sequence argument.** `#17` did NOT land first; `0.34.0` shipped ahead of it. the
>   consequence we warned of is now live and is exactly why `#17` is urgent: every dobj position
>   crashes introspection until it lands.
>
> **what we still owe them**, carried in the vision's *what we owe out*: a retraction of the `io`
> correction we sent (their verdict held in full).

> **self-contained by design.** you are in `domain-objects` and have not read the vision that
> produced this. all you need is below; no cross-repo lookup required.
>
> origin: `ehmpathy/sdk-aws-lambda` · bound `feat-input-only-validation-and-hydration` · stone `1.vision`

---

## .what

give `DomainObjectContract` a `.coerce()` method that returns the same contract schema, plus a
transform that constructs the domain object — and that **contains** a constructor failure as an
ordinary zod issue rather than a raw throw.

```ts
// today
z.object({ surfer: Surfer.contract })            // parses to a PLAIN object, typed `any`

// proposed
z.object({ surfer: Surfer.contract().coerce() })   // parses to a Surfer INSTANCE, typed Surfer
```

shape, roughly — note `contract` becomes a **call**, which is what lets the type propagate at all
(see *the accessor becomes a CALL* below):

```ts
// today: a static GETTER, so it cannot be generic → ZodSchema<any>
public static get contract(): DomainObjectContract;

// proposed: a static METHOD — the getter is REPLACED, not joined
public static contract<T>(this: T): DomainObjectContract<T>;

type DomainObjectContract<T> = ZodType<Shape<T>> & {
  ref: (by: DomainObjectRefBy) => ZodType<…>;
  coerce: (options?: DomainObjectInstantiationOptions) => ZodType<InstanceType<T>>;
};
```

## .why

a `.contract` today describes a domain object but **yields a plain object**. so every boundary
that validates with a contract then has to rebuild the graph by hand:

```ts
// what a lambda handler writes today, for a 4-dobj input shape
genSurfLesson({
  surfer: new Surfer(event.surfer),
  spot: event.signup?.spot ? new SurfSpot(event.signup.spot) : null,
  boards: event.boards.map((b) => new Surfboard(b)),
  swell: new WaveReport(event.report).spot,
});
```

four constructors, a `.map`, and a ternary — each of which must be revisited when the schema
shape moves, and none of which the compiler can check (see the `any` erasure below). the
alternative a tired author reaches for is `event as Surfer`, which `rhachet-roles-ehmpathy#537`
forbids.

with `.coerce()` that whole block becomes `genSurfLesson(event)`, and the declaration lives in
the schema the author already writes.

**three things make this belong in `domain-objects` rather than in each consumer:**

1. **it fixes the `.contract` type erasure.** `getContract` returns `ZodSchema<any>`
   (`src/manipulation/getContract.ts`), so `z.infer` at a `.contract` position is `any` — any
   downstream `handle(event)` compiles regardless of what actually arrived. a transform re-types
   the position to the real class.
2. **it is the only place the class and its schema are both in scope.** a consumer-side fix must
   re-name every class in a config key; `.contract` already knows its own constructor.
3. **`.nested` already does the analogous job one level down.** `.coerce()` is the same promise
   at the top level, so the two compose rather than compete.

## ⭐ .the conformance contract — what `sdk-aws-lambda` will clamp against

> **read this first if you read only one section.** the rest of this doc is evidence and rationale.
> these seven lines are what our phase-2 tests assert against the shipped method. if `.coerce()`
> satisfies them, our seam holds; if it diverges on any one, we find out at bump time.
>
> each line names the **observable**, not the implementation — the HOW stays yours
> (`rule.forbid.prescribe-how-on-dispatch`).

| # | the conformance line | why we clamp it |
|---|---|---|
| **1** | `z.toJSONSchema(schema, { io: 'input' })` on a coerced position yields the **plain wire shape**, with the `x-domain-object` pragma intact | our codegen reads that pragma (`getAllDomainObjectsFromContracts.ts:47`); a cross-service caller sends json, never an instance |
| **2** | a coerced position **parses** a plain payload into a real instance — at the top level, under a plain wrapper, and inside an array | these are the three shapes a real endpoint mixes; a top-level-only method fails our wish's own acceptance |
| **3** | hydration goes through **`Klass.build(props, options)`**, so a coerced instance is **indistinguishable** from a deserialized one — same `withImmute`, same `.nested` cascade | one root primitive; otherwise the ecosystem ships two kinds of domain object and the difference stays invisible until it bites |
| **4** | a constructor failure is **contained** — `safeParse` returns `{ success: false }` with a **path-tagged** issue, never a throw that escapes | our input middleware branches on `result.success` (`genZodEventValidationMiddleware.ts:16-18`); a throw bypasses the only error path we have |
| **5** | `z.infer` at a coerced position is the **instance type**, not `any`; `z.input` stays the **wire** shape | this is the type recovery `.contract` cannot give today; it is also what makes the wire/received split legible |
| **6** | ⚠️ *revised — see the accessor note below.* `X.contract()` used **bare** returns what the removed getter returned: same pragma, same memoized-per-class instance, `.ref` reachable at `X.contract().ref(by)` | the shape must survive the accessor break, or the bump costs consumers twice |
| **7** | `.coerce()` requires **no `_dobj` tag** on the payload | our payloads arrive from external callers and never passed through `serialize`; a required tag would make the method unusable at a service boundary |

### ⭐ the accessor becomes a CALL — and that is the point, not a side effect

`Surfer.contract().coerce()`, and `Surfer.contract().ref(by)`.

**a static getter cannot be generic.** it has no type-parameter position and no `this` to
propagate, so `DomainObjectContract = ZodSchema<any>` (`getContract.ts:25-27`) is not a lax
declaration — it is the only one a getter can carry. a static **method** can use polymorphic
`this`, so the return type can name the class it came from:

| form | status | `z.infer` at that position |
|---|---|---|
| `Surfer.contract` | ⛔ **removed** — the getter does not survive | *(was `any`)* |
| `Surfer.contract()` | the only accessor | the real shape |
| `Surfer.contract().coerce()` | | the `Surfer` **instance** |

**the getter is replaced, not joined** — one name cannot be both a property and a callable, so
there is no deprecation window and no release where both forms work. every `X.contract` call site
in every consumer becomes `X.contract()` at the bump. we are fine with that; it just means the
release note wants to say so plainly, because a missed call site leaves `X.contract` as the method
object rather than a schema — which fails **late**, at `z.toJSONSchema` or `.parse`, not at the
access.

so the accessor change is **the mechanism by which the type survives at all** — a typescript
constraint, not a preference. and it is strictly wider than `.coerce()`: the call form recovers
the type at **every** position, a bare `contract()` and a `contract().ref(by)` too, neither of
which involves a transform.

this is a **break**, on top of the additive `.coerce()`. we are fine with it — but it changes what
our bump is, so it is stated plainly rather than absorbed:

- **line 6 above is revised again.** the ask is **`X.contract()` returns what the removed getter
  returned** — same pragma, same memoized-per-class instance, and `.ref` reachable at its new home
  (`X.contract().ref(by)`). the *shape* is preserved; the *accessor* changes.
- **the bump is major for every consumer**, not additive. on our side that is three call sites in
  test assets (`createCapturableHandlers.ts:39,53,69`) — cheap for us, but every consumer pays the
  same rename. worth a codemod note in the release, since the rename is mechanical.
- **memoization needs a restated contract.** `getContract.ts:57,72-73,122` memoizes per **class**,
  which is unambiguous for a getter. as a call it must be said out loud: is `contract()` memoized
  per class (same instance every call), or per call? our line-6 ask assumes **per class** — two
  `Surfer.contract()` calls should be `===`. if it becomes per-call, say so, because our codegen
  de-dupes dobjs by identity.

**the two we cannot clamp from here, and therefore ask you to hold:**

- **memoization** — `.contract` is memoized per-class (`getContract.ts:57,72-73,122`). `.coerce()`
  must return a **fresh** schema and must not mutate or replace the memoized contract, or one
  consumer's coerce leaks into another's bare `.contract`.
- **`.ref` after `.coerce()`** — a transform returns a fresh schema **without** `.ref` (verified:
  `refOnTransformed: 'undefined'`), which is the same chain-order hazard your own doc-note already
  records for `.optional()` / `.nullable()` (`getContract.ts:20-23`). either carry `.ref` through
  `.coerce()`, or extend that note to name `.coerce()` too. **either is fine — but silence is not**,
  because the failure is a bare `TypeError` at a call site that looks reasonable.

## .acceptance

- a schema position written `X.contract().coerce()` parses a plain wire payload into an `X` instance
- `z.infer` at that position is `X`, **not** `any` — and rejects an unrelated shape
- `z.input` at that position stays the **plain wire shape**, so a cross-service caller (which
  sends json, not instances) is still correctly typed
- the `x-domain-object` pragma **survives** `z.toJSONSchema(schema, { io: 'input' })`, so
  downstream codegen still recognizes the dobj
- a constructor failure surfaces as a **zod issue on the failed path**, not as a throw that
  escapes `safeParse`
- the dobj's own `.nested` still resolves through the coerce
- `.contract` used bare is **unchanged** — this is additive

## .evidence — executed, not argued

verified against `domain-objects@0.33.0` + `zod@4.4.3`. a hand-rolled stand-in
(`contract.transform((p) => new Klass(p))`) was used to test the proposal.

### it does not exist yet

`.contract`'s runtime surface, enumerated:

```
hasRef: 'function'      hasCoerce: 'undefined'
```

### the behaviors all hold

| checked | result |
|---|---|
| hydrates on parse | ✅ `isSurfer: true` |
| `x-domain-object` pragma survives `io:'input'` | ✅ `pragmaSurvivesCoerced: true` |
| published input schema stays the plain wire shape | ✅ (pragma intact, no class in the json-schema) |
| dobj under a plain wrapper, nullable | ✅ `isSurfer: true`, `nullStaysNull: true` |
| arrays of dobjs | ✅ all elements instances |
| the dobj's own `.nested` still fires | ✅ `nestedIsSpot: true` |

### it fixes the type erasure — verified with a negative control

compiled under `tsc --noEmit --strict`, with **no return-type annotation** on the transform, so
zod infers unaided:

```ts
type IsAny<T> = 0 extends 1 & T ? true : false;

// control — the BARE contract really is `any` (if this fails, the rest is worthless)
const plainIsAny: IsAny<z.infer<typeof plainSchema>['surfer']> = true;          // ✅

// the claim
const inferredNotAny: IsAny<InferredOut['surfer']> = false;                     // ✅
const inferredIsSurfer: InferredOut['surfer'] extends Surfer ? true : false = true;  // ✅
// @ts-expect-error — and it genuinely REJECTS a wrong shape
const rejectsGarbage: InferredOut = { surfer: { totally: 'unrelated' } };       // ✅

// the input side stays the wire shape (a caller sends json, not a class)
const wireIsNotSurfer: InferredIn['surfer'] extends Surfer ? true : false = false;   // ✅
```

> ⚠️ **a first version of this typecheck was circular** — it annotated the helper's return as
> `z.ZodType<T>`, so `z.infer` gave back `T` and proved only the annotation. the negative control
> caught it (asserted `any`, got `unknown`, because `as z.ZodType` defaults to `ZodType<unknown>`).
> the results above are the corrected run. **keep a negative control in whatever test you write.**

### the error path needs a guard — and the guard works

a **naive** transform lets a constructor throw escape `safeParse` entirely:

```
naive → ESCAPED safeParse | HelpfulZodValidationError
```

that matters because callers of `safeParse` branch on `if (!result.success)`, and a throw skips
that branch. a **guarded** transform contains it:

```ts
contract.transform((p, ctx) => {
  try {
    return Klass.build(p, options);          // <-- .build, NOT `new` — see .the-root-primitive
  } catch (error) {
    ctx.addIssue({ code: 'custom', message: `could not hydrate ${name}: ${...}` });
    return z.NEVER;
  }
});
```

```
guarded → returned (contained!) success: false
          issues: [{ path: 'surfer', code: 'custom', message: 'could not hydrate Surfer: …' }]
happy path still hydrates → success: true, isSurfer: true
pragma still survives io:'input' → true
```

**the guard is not optional polish — it is the difference between a path-tagged validation issue
and an uncatchable throw.** please ship `.coerce()` guarded from the start.

> ⚠️ the probes above ran `new Klass(p)`. that was the seeder's error, corrected below — the
> containment result is unaffected (both throw the same way), but the **hydration primitive**
> should be `.build`, per your own `deserialize`.

## .the root primitive — `.coerce()` should hydrate exactly as `deserialize` does

**this is the one request in this handoff that is about YOUR vision rather than our usecase.**
`.coerce()` should not invent a second way to turn a plain object into a domain object. you
already have one, and `deserialize` is where it is written down
(`src/manipulation/serde/deserialize.ts:114`):

```ts
return DomainObjectConstructor.build(obj, { skip: context.skip });
```

so `.coerce()` should call **`Klass.build(props, options)`**, not `new Klass(props)`. the two are
not interchangeable — `.build` additionally:

- applies **`withImmute`**, so a coerced instance is immutable like a deserialized one
- cascades **`.nested`** with `.clone()` (per the doc-note at `:112-113`)
- accepts **`DomainObjectInstantiationOptions`**, which is the plumb for `skip`

**the payoff: an instance from `X.contract().coerce()` becomes indistinguishable from one that came
out of `deserialize`.** one hydration primitive, one behavior, whichever door a caller enters
through. if `.coerce()` used `new`, you would ship two kinds of domain object — immutable ones
from serde, mutable ones from schema parse — and the difference would be invisible until it bit.

### and it resolves the double-validation objection

the obvious complaint about `.coerce()` is that it validates twice: zod parses the contract, then
the constructor validates again (`DomainObject.ts:47`). **you already ship the opt-out** —
`DomainObjectInstantiationOptions.skip.schema` (`:19-27`).

when the schema position **is** `X.contract`, the two validations are the *same schema*, so the
second is provably redundant. so consider:

```ts
coerce: (options?: DomainObjectInstantiationOptions) => ZodType<InstanceType<T>>
```

- **default** — validate again (safe; a caller may have loosened the schema around the contract)
- **`{ skip: { schema: true } }`** — one pass, for the common case where the contract is the schema

whether the default flips is yours. the ask is only that `skip` be **reachable**, since without it
a consumer has no way to decline a pass they can prove is redundant.

## .caveats the implementer will hit

1. **`.contract` is memoized** (`memoized: true` — same instance on repeat access). `.coerce()`
   must return a **fresh** schema and must not mutate the shared contract.
2. **a transform drops `.ref`.** verified: `refOnTransformed: 'undefined'`. this is the same
   chain-order hazard `getContract.ts` already documents for `.optional()` / `.nullable()` — the
   doc-note there says to call `.ref(by)` on the RAW contract before any other chain op. either
   carry `.ref` through `.coerce()`, or extend that doc-note to name `.coerce()` too.
3. **a coerced schema cannot serialize under `io:'output'`** — zod raises
   `Transforms cannot be represented in JSON Schema`. it serializes fine under `io:'input'`.
   consumers that call `z.toJSONSchema` **must** pass `{ io: 'input' }`. see the blocker below.
4. **`.coerce()` is NOT `deserialize`, and should not become it.** `deserialize` revives a string
   that `serialize` produced, and keys off the `_dobj` tag `serialize` stamps
   (`deserialize.ts:98-100`). `.coerce()` handles an **untagged external payload** — json a
   caller sent, which never passed through `serialize`. so the two share the hydration primitive
   (`.build`) and no more than that. concretely: `.coerce()` must not require `_dobj`, and a
   consumer must never synthesize one — position comes from the schema, which is what makes the
   tag unnecessary here.

## ✅ .your codec verdict holds in full — we probed it twice and were wrong the first time

> added after your f9 / g26 reached us. **your codec results reproduce exactly**, and your
> *"one rule, both positions"* conclusion is right. we recorded a correction against it, then
> retracted the correction. both rounds are below, because the retraction is the useful part.

verified against the same `zod@4.4.3`:

| your claim | our result |
|---|---|
| a codec's `io:'output'` still throws, only the message changes | ✅ `Error \| Custom types cannot be represented in JSON Schema` |
| so `#17` still matters exactly as much | ✅ agreed |
| `{ io: 'input' }` is the right emit for an **input** schema | ✅ agreed |
| *"…and for an output schema. one rule, both positions."* | ✅ **agreed — after a second probe** |

**round 1, where we went wrong.** we built a counter-case — a plain one-way transform in an output
schema, `z.object({ size: z.string().transform((s) => s.length) })` — and measured:

```
io: 'output' → Error | Transforms cannot be represented in JSON Schema     ← crashes, LOUD
io: 'input'  → { "size": { "type": "string" } } → ts: "{ size: string; }"  ← publishes a LIE
```

that measurement is correct. **the verdict we drew from it was not**, because it rested on a
premise we never stated: that the response border publishes whatever the output schema's
`safeParse` yields.

**round 2, the one line that settles it.** `JSON.stringify` is the real encoder on the response
path, and it emits side A regardless:

```
stringify({ surfer: instance })  →  {"surfer":{"uuid":"u1","name":"kai"}}
```

so the wire face crosses at **both** borders. `io` names the **side** of the contract (wire vs
instance), never the **border** of the endpoint (request vs response) — and once said that way,
your rule is the only one that can be right.

**and zod agrees out loud.** on the direction the response border actually travels:

```
encode(codec,  instance)  → {"surfer":{"uuid":"u1","name":"kai"}}            ← side A, clean
encode(oneWay, instance)  → THREW | $ZodEncodeError |
                              Encountered unidirectional transform during encode: ZodTransform
```

**so our counter-case re-classifies rather than survives.** a unidirectional transform at a
response border is a post-processor wearing a contract's clothes; zod names it as such, and
`_zod.def.reverseTransform` (`function` for a codec, `undefined` for a one-way transform)
distinguishes it at runtime. that is a consumer-side declaration defect to refuse, not a case your
`io` rule must accommodate.

**net: no change asked of you here.** we record it because we sent you the correction first, and a
retracted correction that stays only in one head is worse than one never sent.

## ➕ .one conformance line the codec form adds — the round trip

if `.coerce()` ships as a **codec** (your f9), it inherits the guarantee zod built codecs for. read
`zod/src/v4/classic/tests/codec-examples.test.ts` — every shipped example is a serialized form ⇄
its rich runtime form (`isoDatetimeToDate`, `epochSecondsToDate`, `jsonCodec`, `utf8ToBytes`…), and
every test asserts:

```ts
const roundTrip = z.encode(codec, z.decode(codec, original));
expect(roundTrip).toBe(original);
```

**that is a strong argument FOR the codec form** — wire json ⇄ domain instance is the same
relationship as iso string ⇄ `Date`, so `.coerce()` is the case codecs exist for rather than a
workaround around a `toJSONSchema` limit.

**and it is an obligation the form carries.** we verified the round trip only for a **flat**
stand-in (`{uuid, name}` ⇄ a frozen class). for a real dobj the two risk points are:

- **`.nested`** — a nested instance must encode back to its plain form, recursively
- **`withImmute`** — whatever `.build` attaches must not surface as an extra key on encode

so please clamp: for a dobj with a nested dobj, `encode(decode(wire))` is byte-equal to `wire`.
we cannot clamp that from our side without the shipped method.

## ⛔ .the sequence constraint — read before you ship

**`ehmpathy/sdk-aws-lambda#17` must land first**, or the first consumer to adopt `.coerce()`
takes down introspection for their entire service on the next `prep` deploy.

- `#17`: *"fix: introspection crashes on an input schema that carries a transform"*
- that repo's `getJsonSchemaFromZod` calls `z.toJSONSchema(schema)` with zod's **default**
  `io: 'output'`, which cannot represent a transform
- the blast radius is service-wide, not per-handler: it crashes `getAllLambdaContracts`
- the fix is one argument — `{ io: 'input' }`, the **wire** face, at **both** borders — and it was
  measured **codegen-neutral**: byte-identical emitted typescript, with the only json-schema delta
  a dropped `additionalProperties: false`

so: **`#17` → then `.coerce()` → then consumers adopt.**

> **update — `#17` is further along than this section assumed.** it is not an unstarted task
> filed against that repo; it is **phase 1 of a live bound** there
> (`v2026_08_03.feat-input-only-validation-and-hydration`), already specified and evidenced, held
> only on approval. that bound's **phase 2** is the adoption proof for `.coerce()` itself. so the
> sequence you need is already the plan, and the repo will demonstrate your feature through its own
> seam rather than merely unblock it.

## .an open question for the maintainer

**should `.contract` coerce by DEFAULT, rather than behind an explicit `.coerce()`?**

that is the only version that is genuinely free — a consumer recalls no extra step, which is
what the original ask wanted. but it changes what `.contract` means for every extant consumer,
and until `#17` lands it would make **every** `.contract` user crash introspection.

a suggestion, not a mandate: ship `.coerce()` explicit first, weigh the default later.

> **update — answered, in the affirmative.** the `sdk-aws-lambda` wisher ruled coerce-by-default,
> and every candidate for a `coerce: false` opt-out was walked and none survived
> (`rule.prefer.wet-over-dry` — do not ship a config key with no case). so the surface is
> `X.contract()`, always a codec. this section is kept because the tradeoff it names is real and a
> future reader should see it was weighed rather than skipped.

## ❓ .one question back — does `.ref()`'s pragma still bind our codegen?

`sdk-aws-lambda` reads the `x-domain-object-ref` pragma to emit typed references, and your `.ref`
change touches both halves of how it does that:

```ts
// sdk-aws-lambda/src/domain.operations/genServiceSdk/gen.mechanism/getTypescriptFromJsonSchema.ts:143
const REF_GENERIC_BY: Record<DomainObjectRefBy, string> = {
  primary: 'RefByPrimary',
  unique: 'RefByUnique',
  ref: 'Ref',          // ← the grain whose accessor becomes `.ref()` with no argument
};

// :154 — the pragma is read off the TOP-LEVEL node
const asRefPragma = (node) => node['x-domain-object-ref'];
```

**we asked two questions here; we then went and answered both from your source, so only a much
smaller one is left.** what we read on `beav/feat-contract-coerce`:

| we asked | your source says | so |
|---|---|---|
| does `.ref()` still stamp `by: 'ref'`? | `getContractRef.ts:245` — `stampRef(union, dobj.name, 'ref')`, and `:225-231` fail-fasts on any other `by` precisely to prevent a silent relabel | ✅ our `REF_GENERIC_BY.ref` still binds |
| does the union hide the pragma under `anyOf`? | `:210-211` — *"stamped once at the top (arms unstamped)"*; confirmed by your own snapshot name at `getContractRef.test.ts.snap:262` | ✅ the pragma sits **beside** `anyOf`, not inside an arm — and our emitter checks the ref pragma **before** it branches on `anyOf` |

so both of our worries were unfounded, and your design is the reason. thank you for the
`:225-231` guard in particular — its comment names the exact failhide we were afraid of, which is
how we knew to trust the answer.

**⚠️ the one limit, and the one question left.** the coerce work is not on the branch ref —
`.behavior/v2026_08_10.feat-contract-coerce/*` and `getContract.coerce.*` both return zero files
there, consistent with the commit freeze. so we read the **pre-coerce** `getContractRef.ts`, and we
know your p13 touched this seam.

> **did p13 move the stamp off the union node, or extend the `by` vocabulary past
> `primary | unique | ref`?**

one line either way. if the answer is "neither", no change is owed on our side. we have a phase 2
clamp on both facts regardless, so this is a courtesy check rather than a block.

## .provenance — the honest limits

surfaced mid-vision on the `sdk-aws-lambda` bound `feat-input-only-validation-and-hydration`,
and flagged OUT rather than absorbed, since `domain-objects` sits outside that pr
(`rule.require.one-pr-per-worktree`).

- **verified by the seeder**: every runtime result and every type assertion above was executed
  or compiled against `domain-objects@0.33.0` + `zod@4.4.3`. the probe files were scratch and
  are deleted; the outputs are transcribed verbatim.
- **NOT verified by the seeder**: the proposal was tested with a **hand-rolled stand-in**
  (`contract.transform(...)`) written outside `domain-objects`. it was not implemented as a real
  method on `DomainObjectContract`, so the memoization and `.ref` interactions in `.caveats` are
  **read from source and reasoned**, not exercised. treat those two as claims to reproduce.
- **not investigated**: how `.coerce()` should interact with `.contract.ref(by)` — whether a
  coerced ref is meaningful, or should be refused.

## .the HOW is yours

per `rule.forbid.prescribe-how-on-dispatch`, `.what` / `.why` / `.acceptance` are authoritative.
the method name, the signature, and the guard's error shape are all yours to choose — `.coerce()`
is the name the original asker reached for, which is evidence about intuition, not a mandate.
