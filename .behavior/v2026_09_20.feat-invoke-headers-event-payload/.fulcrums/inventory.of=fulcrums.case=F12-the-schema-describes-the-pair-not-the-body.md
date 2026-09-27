# F12 — `schema.input` describes **the pair**, not the body

**rework** dirty · **status** 🔴 **RULED** — the pair, per the wisher · **confidence** settled

```ts
schema: {
  input: z.object({
    headers: z.object({ authorization: z.string() }),   // OPTIONAL key — omit to constrain naught
    payload: z.object({ to: z.string() }),              // REQUIRED key
  }),
  output: asApiGatewayResponseSchema({ body: … }),
}
```

## 🔴 the amendment of 2026-09-21 — `headers` is an OPTIONAL key, and it retires the dirt

> the wisher: *"and headers is optional right? if not defined, there wont be any errors; it just
> means that the user doesnt care about any particulars in the headers."*

✅ **yes, and the asymmetry with `payload` is traced to an axis rather than defended by prose:**

| key | optional? | the axis |
|---|---|---|
| `payload` | ⛔ **required** | an **extant guarantee** — 78 sites already get body validation, so an absent key would silently drop it |
| `headers` | ✅ **optional** | a **new capability** — headers have never been validated, so an absent key is the status quo |

⇒ that is `rule.forbid.defended-exceptions` satisfied: an exception with a named axis is a second
case, never a defect.

### 🔴 what it does to this entry's own `dirty` grading

the rework section below grades F12 **dirty**, and its sharpest line is *"a bad header now returns
**400**. today 65 production sites read headers with **no guard at all**, so this is the one part of
the proposal that can refuse a request that succeeds today."*

**the optional key deletes that line.** those 65 sites declare no `headers` key, so no header schema
exists for them, so no request is refused. ⇒ **header enforcement is opt-IN**, which is
`rule.require.explicit-optout` satisfied in the safe direction and `rule.require.safe-by-default`
besides.

| | before the amendment | after |
|---|---|---|
| the refusal path | a **new 400** across 65 unguarded sites | reaches only an author who **declares** a header schema |
| ⚠️ **Q16** — does a bad header refuse the request? | 🔴 open, for the wisher | ✅ **answered** — absent key, no enforcement |
| the rework grade | 🔴 dirty, on the behavior change | dirty on `TInput`'s sense only — the behavior half is gone |

⚠️ **the `TInput` half stays dirty**: the sense still moves from *the body* to *the pair*,
`UnifiedApiGatewayEvent` still gains a type parameter, and every `forApiGateway` site still restates
its schema. the amendment removes the **refusal** risk, never the migration.

### ⚠️ the implementation trap the optional key creates — zod strips

**zod strips unknown keys by default.** so an author who writes `z.object({ payload: … })` and an sdk
that parses `{ headers, payload }` against it gets `{ payload }` back — and a **wholesale** write-back
then puts a **headers-less** object into the envelope. `event.headers` goes `undefined`, and
`@middy/http-cors` reads exactly that slot (`index.js:83`).

⚠️ **the hazard has a SECOND, sharper arm this entry never named**: an author who declares
`headers: z.object({ authorization })` gets a bag with **no `origin`**, so cors does not merely go
hungry — with `origins: [a, b]` it answers `options.origins[0]` unconditionally
(`@middy/http-cors/index.js:2-14`), and a caller from `b` receives
`Access-Control-Allow-Origin: a`. a **wrong** answer, on a request this sdk allowlisted.

### 🔴 ⛔ the remedy this entry prescribed is INERT, and is STRUCK

> ⛔ ~~*"so the sdk must **fill an absent `headers` key with a permissive default before it parses**,
> never lean on the author's object shape. `case=4`'s cors clamp is what catches a regression of
> it."*~~

**both halves are wrong**, and this entry was the last copy to carry them — the strike landed in
`1.vision.yield.md` (Q16 and its trap section) and in `headers.md`'s enforcement list, and skipped
here. ⇒ **an incomplete sweep of my own strike**, caught by `repo-rules` at i003, and the miss was
the expensive kind: **a fulcrum entry is the decision record a future driver consults**, so struck
text outlives its strike in the one place most likely to be obeyed.

| the half | why it is wrong |
|---|---|
| *fill before the parse* | 🔴 **zod strips by the object SHAPE, never by the input.** a key absent from the shape is stripped whatever value you hand in, so the default is discarded with it. the measure has no effect at all |
| *`case=4`'s cors clamp catches it* | ⚠️ `case=4`'s `[case3]` allowlists **one** origin, so it cannot tell an echo from `origins[0]`. it stays **green** under the defect |

### ✅ what actually closes it — a write-back MERGE

```ts
event.headers = { ...event.headers, ...result.data.headers };   // MERGE
event.payload = result.data.payload;                            // REPLACE
```

the asymmetry traces to an axis rather than taste (`rule.require.read-the-slot-a-dependency-reads`):
**cors reads `origin` and `@middy/http-response-serializer` reads `accept` out of the header slot**,
so the wire bag is not the author's to delete from. the body has no such reader.

⚠️ and the merge absorbs the **absent-key** arm for free — `result.data.headers` is `undefined`, and
a spread of `undefined` is a no-op. ⇒ **one rule, both arms, no branch**
(`rule.avoid.unnecessary-ifs`).

**the real clamps** are `forApiGateway.test.ts` `[case17]` (absent-key arm) and `[case18]`
(declared-partial, two origins, caller from the second), plus
`genZodInputValidationMiddleware.test.ts` `[case1]` / `[case2]` at the middleware's own grain. both
middleware clamps were dogfood-proven: under a wholesale replace exactly **2 of 12** go red.

## the fork, stated fairly

| option | | |
|---|---|---|
| **A** `schema.input` stays the **body** | the extant shape; one less break | ⛔ the satellite names a level **inside** a model point |
| **B** ⇒ **the pair** — `{ headers, payload }` | the satellite names a point exactly | ✅ **RULED** |
| **C** four peers — `{ headers, payload, query, path }` | matches a generic http framework | ⛔ **0** production reads for query and path |

## ruled, and why

🔴 **the wisher ruled B on 2026-09-21**: *"those are the only things folks should ever need to
constrain on an api gateway event."*

### the measurement behind it

`ahbode/svc-gateway/src/**`, every count under the identical `--in … --paths 'src/**'` form:

| the envelope read | production files |
|---|---|
| `rawEvent.headers` | 🔴 **65** |
| `rawEvent.httpMethod` · `rawEvent.path` · `rawEvent.queryStringParameters` · `rawEvent.pathParameters` · `rawEvent.requestContext` | **0** each |

⇒ **a field nobody reads is a field nobody constrains**, so the read-zeros bound the constrain-demand.
that rejects C on evidence, exactly as it rejected option C of the `invoke` bag (F02).

⚠️ the inference is one step wider than the measurement, and the step is named rather than hidden: the
counts measure **reads**, and the ruling is about **constraints**. a constraint on an unread field is
conceivable (a guard nobody then consumes). no instance exists in the base.

## 🔴 the defect B repairs — a satellite one level inside a model point

the two satellites named **different levels**, and the source says so outright:

| | what it describes | level |
|---|---|---|
| `schema.output` | *"the ENVELOPE, never the body inside it"* (`forApiGateway.ts:99-101`) | the whole return |
| `schema.input` | `ZodSchema<TInput>` — the body | ⛔ **one level inside** |

`rule.require.retest-the-model-on-every-family` grades a satellite typed one level inside a model
point a **blocker**, and names why it is worse than untidy: *a reader who checks `schema` against the
model must hold a level-gap in their head, and a drift inside that gap is invisible.*

⇒ under B, `inputAfter` **is** `{ headers, payload }`. the satellite and the model line up, and the
check becomes mechanical.

## 🔴 why the ruling is safe even if "ever" is wrong

> **the extant shape cannot grow. an object can.**

`schema.input` today names the body **directly**, so there is no slot for a second constrained thing —
a future need forces a break. as an object, a third key is **additive**, and additive is not a break.

⇒ so B does not bet on the measurement holding forever. it bets only that the schema should stop
naming a level inside a point, which is true regardless of what a later family constrains.

## 🔴 the objection that measured to ZERO

`genIntrospectionMiddleware.ts:72` publishes `schema.input` as json-schema, so a reshape could in
principle break a generated caller. measured:

⚠️ **the transcript below is quoted VERBATIM from four foreign repos.** its `clients/` paths,
`client.ts` filenames, and `// TODO: autogenerate this client` comments are **their** vocabulary,
not this repo's — the same exemption `LambdaClient` holds under `rule.forbid.term-client`.
⛔ do not rewrite them: an edited transcript is a falsified measurement, and an edited path cites a
file that does not exist.

```
rhx git.repo.get lines --repos 'ahbode/app-*' --words 'introspect' --paths 'src/data/clients/ahbodeGatewayRest/client.ts'
  ->  app-hometools-native   client.ts:1211  // TODO: autogenerate this client from introspection
  ->  app-marketplace-web    client.ts:326   // TODO: autogenerate this client from introspection
  ->  app-protools-native    client.ts:984   // TODO: autogenerate this client from introspection
  ->  app-storefronts-web    client.ts:598   // TODO: autogenerate this client from introspection
```

**all four are TODOs.** no consumer reads the published shape.

🔴 **and that inverts into an argument FOR B**: four repos intend to generate callers from this
shape, so whatever ships now is what four future callers inherit. ⇒ this is the cheapest moment the
decision will ever have.

⚠️ **the objection was nearly priced without a run** — the identical defect F05 recorded (*"a second
public break"* → **0 consumer files**). it is the class's sixth near-instance and the first one caught
**before** it reached a record.

## 🔴 the invariant B newly owes — the validator must WRITE BACK

> **validate into the envelope, never beside it.**

the extant chain already does this: `genZodBodyValidationMiddleware` **replaces** `event.body` with
the parsed value, which is why `event.body as TInput` (`:223`) is true at `logic` time rather than
merely hoped for.

⇒ keep that under the new names and both slots stay real projections:

| the bag | the envelope | relation |
|---|---|---|
| `payload` | `event.payload` | one object |
| `headers` | `event.headers` | one object |

⛔ **break it** — validate into a side bag while the envelope keeps the unvalidated value — and the
result is a **validated value beside an unvalidated one under one name at two levels**. that is the
trap the first draft of this drive wrote a whole section to avoid by *deleting* the envelope slot.
under B it must be avoided by **write-back** instead, because the slot is back.

⚠️ this bites hardest on `headers`, which is new to validation: a zod `.default()` or `.transform()`
on a header **produces a different object**, so a validator that skips the write-back silently leaves
`event.headers` stale. the extant body path never surfaced this, since nobody compared `event.body`
to a pre-validation copy.

## rework, and why dirty

🔴 **dirty**, and this is the entry's one real cost. it is not a rename:

| | |
|---|---|
| `TInput` changes sense | from *the body* to *the pair* — so `ZodSchema<TInput>`, `asInputAfter`, and the introspection output all move |
| `UnifiedApiGatewayEvent` gains a type parameter | it must carry `payload: TInput['payload']` for the write-back to type |
| ⛔ ~~**a new refusal path**~~ | ⛔ ~~a bad header now returns **400**…~~ 🔴 **STRUCK 2026-09-21** — `headers` is an optional key, so the 65 unguarded sites declare no header schema and no request is refused. see the amendment at the top |
| the migration widens again | every `forApiGateway` site restates its schema, not only its destructure |

⇒ reversal means a re-narrow of `TInput` across the chain and the introspection surface. that is a
teardown, not a swapped default.

## ✅ the behavior half — open when this entry was written, RULED the same day

⛔ ~~**the shape is ruled. the enforcement is not.**~~ 🔴 **STRUCK.** both are ruled. a schema that
*describes* headers and a validator that *refuses* on them are two decisions, and the wisher made
the second on 2026-09-21 by a move that **dissolved** it rather than answered it — an optional key
makes the guard opt-in, so no default had to be argued.

| | |
|---|---|
| ✅ ruled | `schema.input` is `{ headers?, payload }` |
| ✅ **ruled, 2026-09-21** | a header mismatch refuses the request **only where the author declared a header schema**. an absent `headers` key enforces naught |

⇒ the conservative default is now structural rather than advisory: the guard is **opt-in by the
key's absence**, so every extant caller goes through untouched
(`rule.require.explicit-optout`, `rule.require.safe-by-default`).

## where

- `forApiGateway.ts:85-104` — the `ForApiGatewayInput` declaration, and `:99-101`'s own statement of
  the level asymmetry
- `forApiGateway.ts:361` — `genZodBodyValidationMiddleware({ schema: config.schema.input })`
- `forApiGateway.ts:357` — `asInputAfter: (request) => request.event?.body`, which moves with it
- `genIntrospectionMiddleware.ts:72` — the published surface
- **F13** — the envelope's `payload` slot, which this depends on
- `rule.require.retest-the-model-on-every-family` — the rule A breaks

## the verdict, once ruled

🔴 **RULED — B.** the wisher, 2026-09-21. ⛔ ~~the header-enforcement half stays open.~~ 🔴 **STRUCK
— it closed the same day**: `headers` is an **optional key**, so enforcement is opt-in and the 65
unguarded sites are untouched.

⚠️ **three stale clauses survived in this one entry** — the inert fill-before-parse remedy, the
*"enforcement is not ruled"* section, and this verdict line — all struck by one amendment I applied
everywhere except here. ⇒ the lesson is `rule.require.sweep-the-defect-class` turned on a **strike**
rather than on a defect: **when you strike a claim, grep every copy of it before you move on.** the
subject of that grep is the claim's own words, never the file you happened to be in.
