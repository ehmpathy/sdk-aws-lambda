# F5 — an envelope-aware assertion helper is in scope

> 🔴 **SUPERSEDED by F9, ruled by the wisher 2026-09-08.** the reader is **not built**. the dialect
> travels in the return **type** instead of a runtime normalizer.

## the supersession

the wisher's question was direct:

> *"why can't we just use a generic on the `runLambdaEndpoint` that specifies whether it's ancient
> or contemp output?"*

**and it dissolves the need this fulcrum exists to answer.** the reader's one job was to span both
dialects so an assertion survives a frame change. but the dialect is **deterministic from the
input** — `genTrailMiddleware` sets `isContempCaller` from the payload frame the caller sent, and
`genConstraintErrorMiddleware.ts:44-45` is the only site that reads it. so a runtime reader
**re-discovers, on every call, a fact the caller stated on input**.

| approach | rung of `rule.prefer.prevent-over-correct` |
|---|---|
| the reader (F5) | **4** — report it well, after the fact |
| the generic (F9) | **1** — make the wrong access impossible |

and the sdk already parameterizes dialect on input, at `askLambdaEndpoint.ts:35-42`:

```ts
struct?: { payload?: 'ancient' | 'contemp' }
```

⇒ F9 is an extension of an extant seam, not a new concept: let that parameter flow to the return
type.

**two rulings compound it.** F3 flipped to contemp-by-default, so one dialect is produced unless
the author opts out — which shrinks even the residual case the reader would have covered.

## what is left, and where it went

| the reader also did | now done by |
|---|---|
| span both dialects | the generic — the type names which one |
| narrow success-vs-error | an `is*`/`as*` pair, **hand-built** — see the correction below |
| ⚠️ span the **legacy** family's third shape (`stackTrace`/`causeTrace`, no `details`) | **none of it** — and it was never covered. `struct.payload` describes our envelopes only; case=7's actor gets a shape neither the reader nor the generic models |

## 🔴 the correction — this entry was wrong twice, found at self-review r5

### 1. "closed, unbuilt" is false — the narrow row IS built

`src/domain.operations/runLambdaEndpoint/dialect/isLambdaEndpointErrorEnvelope.ts` ships the
`is*`/`as*` pair, exported from the barrel and pinned by `src/index.test.ts [t3]`.

**it had to be.** F9's promise was that the dialect generic makes the envelope shape reachable by
construction — and it makes the shape **KNOWN**, never **READABLE**. `onReferenced` returns
`TOutput | Envelope`, and typescript refuses a field read on a union unless the field is on every
arm. so without the narrow the only route to `.error.class` is an `as` cast — the exact defect
case=2 promised the type would remove (`rule.forbid.as-cast`).

⇒ so the supersession above holds on its **argument** and not on its **conclusion**: the runtime
message-reader F5 proposed is indeed unbuilt, and a smaller mechanism was owed in its place.

### 2. "via `withAssure` — already the house pattern" is false for THIS house

two reasons, and the order matters because the first survives the second:

- 🔴 **`withAssure` cannot carry a type PARAMETER.** it takes the predicate as a **value**, so
  `TDialect` is instantiated at the wrap and fixed on the returned `.assure` — after which
  `wrapped.assure<'ancient'>(x)` fails the type gate. the wrap would silently pin every narrow to
  `'contemp'` and forfeit the F9 guarantee the pair exists to keep.
  - **verified by probe**, not assumed: a local reproduction of `withAssure`'s shape, wrapped
    around a generic predicate, rejects an explicit type argument at the call. the probe's
    `@ts-expect-error` is self-clamped — an unused directive is itself an error — so a green type
    gate is the proof
  - clamped in code at `isLambdaEndpointErrorEnvelope.test.ts`, *"the pair stays callable with an
    EXPLICIT type argument"* — so a future refactor to a wrap goes red at the call
- ⚠️ **`type-fns` is not a dependency of this package** — 0 matches in `package.json`. this is the
  lesser half and is stated second on purpose: a reader told only this would install the package,
  refactor, and meet the wall above.

⇒ **the phrase "already the house pattern" is where the entry went wrong.** it is the pattern of
`ehmpathy/role=mechanic`'s brief, which is a different house. a vision that adopts a rule should
check the rule's mechanism resolves in the repo the vision speaks for.

## rework

**clean** — the pair is additive and self-contained. drop it and the union is still honest; the
reads that lean on it revert to casts, which is the state before this round.

## the verdict

**superseded by F9 in its LARGE half, and completed by a small one.** the runtime message-reader is
closed and unbuilt; the union narrow F9 requires is built, and `rule.require.assure-via-type-checks`
is honored by exception, recorded at the code and clamped by a test.

---

## the record as it stood, preserved

## the fork, stated fairly

the wish raises `expectLambdaError(response, match)` as a **proposal** and hands the call to the
maintainer: "the need it answers (tests hand-stringify envelopes today) is real; whether a helper
is the right answer is yours."

so the fork is: ship the util alone, or ship the util plus an envelope reader.

## taken, and why at the time

**taken: in scope — but as a *reader*, not an *asserter*.**

the shape taken is `asLambdaErrorForTest(response)` → one
`{ class, message, cause?, details? } | null`, cast from either envelope dialect — rather than a
helper that itself calls `expect`.

the `as*` prefix is not cosmetic: per `rule.require.get-set-gen-verbs` this is a pure cast of one
shape into another, which is exactly what `as*` names. `get*` would misfile it as a lookup and
would owe a `One`/`All` cardinality it does not have.

1. **the need is verified, not merely claimed.** the repo's own tests already pay this tax:
   `genLambdaEndpoint.forAskEndpoint.test.ts:83-87` reaches the message through a cast —
   `(result as unknown as { errorMessage: string }).errorMessage`. that cast appears again at
   :299-303 and :333-337. three casts in one file, all to read one field off an envelope. that is
   the friction the helper removes, and it sits in *this* repo, not a hypothetical downstream one.
2. **a reader defuses F3; an asserter does not.** the dirty risk in F3 is that the envelope shape
   flips with the payload format. a reader that casts **both** shapes into one lets a consumer test
   survive that flip untouched. this is the single highest-leverage mitigation available for the
   one dirty fulcrum on the drive — which is what promotes the helper from nice-to-have to
   load-bearing.
3. **a reader keeps the assertion in the test's own hands.** an `expectLambdaError` helper binds
   the sdk to jest's `expect` — and jest is devDependency-only (`package.json:80-115`), so a helper
   that calls `expect` cannot ship from the root barrel without a runtime jest dependency. a reader
   returns a plain value and stays runner-agnostic. this is not a preference; it is the constraint
   that makes the asserter form unbuildable under F4.

## rework, and why clean

**clean — additive.** it is a second exported function with no effect on the first. drop it and
the util still stands; add it later and no extant test changes. a consumer who hand-rolls their
assertions is unaffected either way.

## confidence, and why 74%

moderate. the *need* is cited and solid (three casts in one repo file). the *form* is where the
uncertainty sits: i converted the wish's proposal from an asserter to a reader, and though the
jest-dependency argument makes that conversion close to forced under F4, a maintainer might prefer
to ship the asserter from a subpath instead (flip F4, keep the wish's original shape). that is a
coherent alternative package of choices, and it is not the one i took.

there is also a live scope question: an assertion reader sits adjacent to the wish's `.what`, not
inside it. the wish sanctions it — "an envelope-aware assertion helper is therefore in scope, if
the maintainer judges it earns its keep" — but a reviewer could still grade it a scope leak.

## where

- a second export alongside the util
- readme: the error-assertion example

## the verdict

_unruled — open for the council._
