# rule.require.frozen-invoke-inputs

> **every value a `genLambdaEndpoint.for*` variant hands its `invoke` is deep-frozen, in every
> family, typed `FrozenDeep` — never `Readonly`.**

```ts
// 👎 mutable on one variant
invoke: (input: { event: TInput }, context) => …

// 👍 one rule, every family, one shared helper
invoke: (input: { event: FrozenDeep<TInput> }, context) => …
const eventFrozen = setEventFrozen({ event });
```

## .why

> *"silent mutables are the worst kind of landmine"* — the wisher

a write to a handed-in value succeeds, the handler returns, the suite is green — and the corruption
surfaces in a value some later step reads:

| family | who reads the value after `invoke` | the harm |
|---|---|---|
| `forApiGateway` | `@middy/http-cors`, in its `after` hook | a forged `origin` is echoed; the browser trusts an origin the sdk never allowlisted |
| `forSqs.perBatch` | the sdk — the failed ids, read off `event.records` after `invoke` | a forged `event.records[n].id` is reported in place of the real one; sqs matches no message, and the one the author meant to retry is lost |

neither fails loud.

## .membership is the hand-off, never the reader set

*"freeze where someone reads it later"* is refused:

- the reader differs per family, so a sweep aimed at vendors misses the sdk's own reads (that is how
  `forSqs.perBatch` was missed for a release)
- an empty reader column is a property of today; one new post-invoke read fills it silently
- a guarantee on N−1 variants teaches a habit that breaks on the Nth

so the rule is keyed to the act: a value handed to `invoke` is frozen at the hand-off.

## .the test — for the proposer

does every value in the `invoke` bag come back `FrozenDeep`, from `setEventFrozen`?

| slot | verdict |
|---|---|
| `event` | frozen |
| a projection (`headers`, `payload`, `records`) | frozen with it — one walk seals both routes |
| a value the sdk mints for the handler | frozen anyway — the rule is the hand-off |
| `context` | out of scope — ambient, carries a live logger and clients |

## .the test — for the reviewer

is every slot of each variant's `invoke` input typed `FrozenDeep`? the tells:

- `Readonly<T>` — shallow, so `event.headers.x = 1` type-checks and then throws against the deep
  runtime freeze
- a bare `T` beside peers typed `FrozenDeep<T>`
- a defensive copy in place of the freeze — it breaks `headers === event.headers`
- a runtime freeze handed over with the un-narrowed type
- a per-variant argument for why this one may sit out (`rule.forbid.defended-exceptions`)

## .the cost, paid on purpose

`FrozenDeep<T>` is unassignable to a mutable parameter, so a handler that forwards `event` to
`fulfilOrder(order: Order)` must declare its sink `readonly`. that cost is uniform across the
family, so it is never an axis for one variant to sit out.

## .the caveat

- `context` and the return value are exempt
- a frozen write throws in strict mode (every module this sdk ships is esm) — but the type is the
  first rung, never the throw
- node's `TypeError: Cannot assign to read only property …` names no remedy; only a `Proxy` could,
  and a `Proxy` is a different object, which breaks the projection

## .the clamp each variant owes

| arm | proves | red without it |
|---|---|---|
| top-level write | the freeze ran | a variant that skips `setEventFrozen` |
| a write one level in | the freeze is deep | `Object.freeze` alone, or `Readonly` |
| `@ts-expect-error` at both depths | the contract states it | a runtime freeze with the un-narrowed type |

observe the write's outcome **inside** the handler: every family converts an escaped throw into a
response, so a `getError` at the call site reads the rendered body. name the defect arm
`'the write LANDED'` so a regression fails by name.

## .enforcement

- a variant that hands `invoke` an unfrozen value = **blocker**
- a slot typed `Readonly<T>`, or bare `T` beside `FrozenDeep<T>` peers = **blocker**
- a defensive copy in place of the freeze = **blocker**
- a runtime freeze with the un-narrowed type = **blocker**
- a per-variant exemption = **blocker**
- a freeze with no depth clamp = **blocker**
- a freeze with no compile clamp = **nitpick**
- `context` left mutable = false positive

## .see also

- `setEventFrozen.ts` — the shared helper and its `FrozenDeep` type
- `domain.terms/event.md` — the invariant in the term's words
- `rule.require.consistent-variant-contracts` — its superset does NOT clamp the freeze
  (typescript ignores `readonly` in assignability); the depth arm above does
- `rule.prefer.prevent-over-correct` (ergonomist) — rung 1 is the type, rung 4 the throw
