# F8 — the util accepts handlers that return a promise only

> added at self-review r3. it exists because the choice **narrows a contract the incumbent
> documents and tests** — and a drop-in promise that silently narrows is the exact failure mode F6
> already caught once on this drive.

## the fork, stated fairly

the incumbent types its handler as aws-lambda's `Handler<E, R>`
(`simple-lambda-testing-methods/src/invokeHandlerForTesting/invokeHandlerForTesting.ts:28`), which
is:

```ts
(event: E, context: Context, callback: Callback<R>) => void | Promise<R>
```

⇒ **two call conventions, and the incumbent supports both.** its implementation branches
explicitly:

| convention | how the incumbent settles | line |
|---|---|---|
| callback-style — handler calls `callback(err, result)` | the callback settles the promise | `:34-37` |
| promise-style — handler returns a promise | `if (response instanceof Promise)` settles it | `:39-40` |

and it is not incidental support. its own suite opens with a dedicated block
(`invokeHandlerForTesting.test.ts:4-36`):

```ts
describe('callback handlers', () => {
  it('calls callback style handler and gets response correctly', async () => {
    const theHandler = jest.fn(async (event, context, callback) =>
      callback(undefined, '__RESULT__'),
    );
    …
    expect(theHandler).toHaveBeenCalledWith(
      { important: true }, expect.any(Object), expect.any(Function),   // :14-18
    );
```

⇒ the incumbent **guarantees a function is passed as the third argument**, whether or not the
handler uses it. that is a tested contract, not an implementation detail.

so the fork: does our util accept both conventions, or promise-style only?

## taken, and why at the time

**taken: promise-style only** — `handler: (event, context) => Promise<TOutput>`, the shape the
extant in-repo asset already has (`src/__test_assets__/invokeHandlerForTest.ts:9-18`).

1. **measured demand is ~0.** `rhx git.repo.get lines --repos 'ahbode/*' --words 'context,
   callback'` → **1 match, and it is in a `.behavior/` research document**
   (`app-storefronts-web/…/3.1.research.v2.i1.md:109`), not a handler. every real handler in the
   population is middy-wrapped — `createStandardHandler` or `genLambdaEndpoint` — and middy returns
   a promise.
2. **`rule.prefer.wet-over-dry` grades speculative surface a nitpick.** a callback branch for zero
   measured call sites is a code path that must be reasoned about, tested, and kept correct, to
   serve a caller who does not exist in the measured population.
3. **the shape is extant, not invented.** the promise-only signature is already in this repo and
   already works; this is a promotion.

## 🔴 the counterargument this fulcrum exists to record

**"zero demand today" and "safe to narrow" are different claims, and only the first is measured.**
this is the same distinction F6 turned on, and there it settled the *other* way — F6 kept the
`context` override precisely because it is incumbent contract, despite zero measured demand.

so why does F8 land differently than F6?

| | F6 (context override) | F8 (callback support) |
|---|---|---|
| incumbent contract? | yes | yes |
| measured demand | 0 | ~0 (1 doc-only match) |
| cost to keep | **one optional field** | **a second settle path + its tests** |
| what a consumer hits if we drop it | a compile error at the call site | ⚠️ **see below** |

⇒ the split is **cost to keep**, not principle. F6's surface is a field; F8's is a code path.

## 🔴 the failure mode — REPAIRED at peer review r009, and it was worse than this entry said

r009 (`ergo-friction-hazards`) raised the untyped path as a nitpick. **I built the mitigation this
entry names, and the probe showed the entry had mis-priced the fault.**

### what this entry claimed, and what a probe of it found

> ⚠️ *"we never pass a callback, so a callback-style handler never settles → **the test hangs to its
> timeout**"*

**there is no hang.** a callback handler answers `undefined` rather than a promise, so
`await input.handler(…)` resolves **at once**. measured, with the new guard disabled:

| the handler | without a guard |
|---|---|
| calls `callback(…)` **synchronously** | `TypeError: callback is not a function` |
| calls it **later**, or not at all | 🔴 **`NoErrorThrownError: no error was thrown`** — `undefined`, green |

⇒ **the second is the shape a real callback handler takes** (it awaits work, then calls back). so the
common case is not a hang and not an error — it is a **PASS**, with a success-shaped answer for work
that never ran, and the callback's `TypeError` thrown out of band with no test to fail.

🔴 **that is `rule.forbid.failhide`, not a hang.** a hang is loud and this is silent, so the entry
argued the deferral against a failure mode that does not occur — **the same defect F13 and F14 fell
to, in a third form: a claim about behavior, asserted and never probed.**

### the repair — the mitigation this entry named and declined

```ts
if (input.handler.length >= 3)
  return ConstraintError.throw(
    'the handler given is callback-style, and this util runs handlers that answer with a promise',
    { declaredParameters: input.handler.length, hint: 'answer with a promise instead of a callback — `async (event, context) => …`. if your handler already answers with a promise and merely declares an unused third parameter, drop it from the signature.' },
  );
```

`rule.prefer.prevent-over-correct` rung 3, exactly as costed. clamped at `[case13]`, four assertions,
bite-probed (**2 failed, 35 passed** with the guard off).

🟡 **the hint's second sentence is the false-positive escape.** a promise handler that declares an
unused third parameter is legal aws and gets rejected here, so the error names the one-token fix
rather than strand that author.

🔴 **and `[t2]` is the clamp that mattered most: a middy-wrapped endpoint must NOT be caught.** every
handler in the measured population is middy-wrapped — had middy's returned function declared three
parameters, this guard would reject **100% of real consumers**, and `[t0]`/`[t1]` would both have
stayed green because neither uses a real endpoint.

⇒ **a guard that rejects by a property must be clamped against the population it will meet**, not
merely against the shape it aims at.

### what this does NOT settle

the fulcrum itself is unchanged: **the util still takes promise-style handlers only.** what changed is
that the refusal is now fast, named, and escapable — so a council that judges the narrowing wrong is
choosing to *widen* the contract, never to *fix a failure mode*.

## rework, and why clean

**clean, and purely additive.** to support callbacks later is to widen the handler type and add the
callback branch — no extant caller changes, no assertion is invalidated, no return value moves. the
promise path stays exactly as written.

it is the reverse direction that would be dirty, and this choice does not take it.

## confidence, and why 82%

good, and the lowest of the eight — which is why it earns a row.

the 18% is not doubt about the measurement; it is doubt about the measurement's **reach**. the
`--words 'context, callback'` probe matches one textual form. a callback-style handler written as
`function handler(event, ctx, cb)` or with differently-named parameters would not match it, and i
did not enumerate every variant. so "~0" is a floor on absence, not a proof of it — the same
floor-not-census caveat the yield now states for the 318/20 figure.

the residual also covers the hang: i judged a compile error the common case, but that judgment
assumes consumers type their handlers, and the 318 sites were not audited for `any`.

## where

- the util's handler parameter type
- whether a `.length >= 3` guard converts the hang into a `ConstraintError`

## the verdict

_unruled — open for the council._
