# define.lambda-endpoint-run-boundary

## .what

to **run** a lambda endpoint, shapes must cross a boundary into it. they cross one of two ways,
and the way they cross is a domain axis — the **run boundary**:

| boundary | shapes cross as | you hold |
|----------|-----------------|----------|
| **serialized** | json over a wire (real or simulated) | the endpoint's **slug** — `{ service, function }` |
| **referenced** | live object references, same process | the handler **function itself** |

this axis names the two subdomains of `runLambdaEndpoint`:

```ts
runLambdaEndpoint.onSerialized({ which, event, at: 'cloud' | 'local' })
runLambdaEndpoint.onReferenced({ handler, event })   // no `at` — none is possible
```

## .why

**the boundary determines the error stance.** this is the axis's whole value: it is *causal*, so
it predicts behavior that a locus axis (cloud vs local) does not.

| boundary | a constraint error arrives as | why |
|----------|-------------------------------|-----|
| **serialized** | a **thrown** error | you addressed the endpoint by slug, so you are a **caller**, and callers get caller semantics |
| **referenced** | a **returned** envelope | you hold the handler, so you are the **host**, and hosts see what the function returned |

locus does not cleave this. `at: 'local'` and `at: 'cloud'` sit on the **same** side — both throw.
so the boundary is the axis; the locus is a sub-option of one half of it.

## .the matrix

**4 cells, 3 reachable, 1 barred by nature.**

| | **local** | **cloud** |
|---|---|---|
| **serialized** | ✅ resolve the slug, simulate the wire in-process | ✅ the real wire |
| **referenced** | ✅ hold the handler, call it | 🚫 **barred** |

`referenced × cloud` is impossible: **a function reference cannot cross a process.** to reach a
cloud lambda you must name it, and to name it is to serialize.

## .the bar is unrepresentable, by arity

the barred cell is not documented and policed — it cannot be written:

- `onSerialized` takes `at`, because a slug resolves either locally or on the wire
- `onReferenced` takes **no** `at`, because a reference has one and only one locus

⇒ `rule.prefer.prevent-over-correct`, rung 1: make it impossible.

## .the strip — why `onReferenced` still json-strips

`onReferenced` crosses no wire, so a `Date`, a class instance, or an `undefined` would survive
into the handler — data the serialized boundary could never deliver. so it **strips both
directions**:

```ts
JSON.parse(JSON.stringify(x))   // inbound event, and outbound output
```

the strip is a **fidelity guard**, never the boundary itself. it keeps a test on the referenced
boundary from a pass that the serialized boundary would fail.

⚠️ **the guard covers payloads, never errors.** `onReferenced` is payload-faithful and
host-faithful at once — it strips like the wire and it returns the envelope the wire would have
converted. that asymmetry is deliberate: a test on this boundary asks *"what did my handler
do?"*, not *"what would my caller see?"*

## .the void divergence — the same asymmetry, one level down

the error stance is not the only place the boundaries disagree. **a handler that returns no value
answers differently on each side**, and each answer is correct for its own boundary:

| boundary | a void handler answers | why |
|---|---|---|
| **referenced** | `undefined` | it is what the function returned. `asWireStripped.ts:18` returns it rather than throws — `JSON.stringify(undefined)` yields `undefined`, which `JSON.parse` refuses |
| **serialized** | **`null`** | aws delivers `null` for a lambda that returns no value, so it is what a real caller receives (`runLambdaEndpoint.onSerialized.ts`, `JSON.stringify(output ?? null)`) |

⇒ **the referenced boundary is HOST-faithful; the serialized boundary is WIRE-faithful** — the same
split that makes a caller fault return on one side and throw on the other.

🟡 **this is not an edge case; it is the sqs and sns consumer shape.** such a handler returns void
or a batch-item-failures object, so a migrant who tests one handler on both boundaries meets this on
their first pair of tests.

✅ **and the serialized signature MODELS it.** `onSerialized` returns `Promise<WireDelivered<TOutput>>`:

```ts
type WireDelivered<T> = [T] extends [void] ? null : WireStripped<T>;
```

so a handler typed `void` yields a type that reads `null`, which is what the wire delivers. the
`WireStripped` arm carries the same truth for a `Date` — it types as the `string` the wire returns,
never as the `Date` the handler wrote.

⚠️ **this section read *"the serialized signature does not model it"* until 2026-09-10**, and it had
been false since F13's repair. ⇒ a brief that tells a reader the sdk ships an unsound public type
sends them to probe a type that already states the truth — `sdk-aws-lambda`'s fulcrum **F13** is
`closed — overruled at r006`, and this paragraph was its last stale citation.

## .the vocabulary is consistent, in both halves

*serialized* and *referenced* both describe **the shapes over the boundary**, not the endpoint:

- **serialized** matches `define.lambda-endpoint-ubiqlang` exactly — the slug is *"the artificial /
  serialized key"*
- **referenced** names live object references — the event and the handler both arrive as
  in-memory references

so the two are symmetric halves of one axis (`rule.prefer.symmetric-term-pairs`), and neither
overloads the other's sense.

## .the incumbent this replaces

`simple-lambda-testing-methods` already carries this axis, as a boolean:

| incumbent | successor |
|---|---|
| `invokeLambdaForTesting({ service, function, stage, locally: false })` | `runLambdaEndpoint.onSerialized({ which, event, at: 'cloud' })` |
| `invokeLambdaForTesting({ …, locally: true })` | `runLambdaEndpoint.onSerialized({ …, at: 'local' })` |
| `invokeHandlerForTesting({ event, handler })` | `runLambdaEndpoint.onReferenced({ handler, event })` |

⚠️ the incumbent's `locally = false` is a **negative-default boolean** whose name states a locus
and hides a stance. the named variants state both (`rule.forbid.ambiguous-labels`).

## .evidence

the incumbent composes exactly as this matrix predicts:

- `invokeLambdaForTestingLocally.ts:81` calls `invokeHandlerForTesting({ event, handler })` — the
  serialized-local cell is **built on** the referenced cell
- `:78` — *"make the response look like what aws-lambda would return"*
- `:91` — *"to match the response of the live invocation"*
- `:99` — converts the returned envelope into a thrown `LambdaInvocationError`

⇒ the incumbent's own comments state the causal claim: **cross the serialized boundary and you
adopt caller semantics, whatever the locus.**

and this sdk's wire path does the same conversion, from the other end:

- `getParsedResponse.ts:52-108` — hydrates an error envelope into a thrown error
- `genConstraintErrorMiddleware.ts:72` — the handler **returns** that envelope
- `genInternalServiceErrorMiddleware.ts:62` — a malfunction **throws**, on either boundary

## .see also

- `define.lambda-endpoint-ubiqlang` — the slug as the serialized key
- `invariant.badrequesterror-not-lambda-error` — why a caller fault is a returned envelope, never a lambda failure
- `invariant.ancient-vs-contemp-callers` — the dialect the envelope takes
- `ehmpathy/architect: rule.prefer.symmetric-term-pairs` — the paired-shape requirement
- `ehmpathy/ergonomist: rule.prefer.prevent-over-correct` — the arity bar

