# F21 — a wrapper defeats the arity guard, and the obvious remedy refuses a legitimate shape

| field | value |
|---|---|
| **case** | F21 |
| **title** | should `onReferenced` refuse a handler whose return is not thenable? |
| **rework** | **clean** — one post-call check in one operation, plus its clamp |
| **status** | open — raised at execution i033 |
| **confidence** | **88%** — was 60% while the population was unmeasured; the settler has since been run |
| **where** | `guard/assertHandlerIsRunnable.ts` · `runLambdaEndpoint.onReferenced.ts` |

## .the fork, stated fairly

`assertHandlerIsRunnable` refuses a callback-style handler by arity —
`input.handler.length >= 3`. **a spread-relay wrapper defeats it**, because
`Function.prototype.length` counts declared parameters before the first default or rest:

```ts
const wrapped = (...args) => callbackHandler(...args);   // .length === 0
```

⇒ and that is precisely the shape `rule.require.hook-wrapper-pattern` composes with, so the defeat
is not exotic — it is this org's own convention.

**the consequence is the failhide the guard exists to prevent**: `await wrapped(payload, context)`
answers `undefined` at once, the test reads green, and the handler's later `callback(err, result)`
throws out of band with no test to fail.

## ✅ measured, both halves

`assertHandlerIsRunnable.knownLimit.test.ts` clamps it. the probe that raised it also **disproved
the remedy the reviewer proposed** — a check that the handler's return is thenable:

| the handler | its return | thenable? | verdict |
|---|---|---|---|
| promise, valued | a `Promise` | ✅ | legitimate |
| promise, void | a `Promise` | ✅ | legitimate |
| **sync, valued** | the value | ❌ | **legitimate** |
| **callback** | `undefined` | ❌ | broken |

⇒ **a thenable check refuses row 3 to catch row 4.** the two are indistinguishable at the return
value, so the fork is a genuine trade rather than an oversight.

## .the narrower variant, and why it is still a fork

refuse only a return that is **`undefined` AND not thenable**. that passes rows 1–3 and catches
row 4 — but it also catches a **void sync handler**, `(event) => { log(event) }`, which is
legitimate and rare.

🟡 **and the void sync handler is arguably broken anyway**: it produces the same success-shaped
`undefined` for work that may not have run. so the narrow variant may refuse only shapes that
deserve refusal.

⇒ **that "arguably" is why this is a fulcrum and not a fix.** it is a claim about what a consumer's
handler *means*, and this drive has no measurement of how many void sync handlers exist.

## .taken, and why at the time

**neither branch.** the limit is clamped and documented; no behavior changed.

- the guard's docblock claimed a completeness the mechanism lacks — **that is repaired**, because a
  false claim of completeness tells a reader not to check
- the fix is a fork with a false-positive cost, at a stone already at its review budget
- ⇒ `rule.always.defer-fulcrums-to-last`: best-guess no change, flag it, drive on

## ✅ the population IS measured — the settler was run, and it raises the confidence to 88%

both halves of the conjunction were scanned across `ahbode/*`:

| the half | the measurement | verdict |
|---|---|---|
| spread-relay wrappers exist | **252 matches / 23 repos** | 🔴 **common** — `withRetry`, `withTimeout`, `withBottleneck`, `withLogTrail`, `withDurationReporting` are each `(...args: Parameters<T>)` |
| callback-style handlers exist | **1 match / 1 repo** — a line inside `.behavior/domains.apex.redirect/3.1.research.v2.i1.md`, a research document | ✅ **zero in production code** |

🔴 **the defect needs BOTH, and the second set is empty.** a spread-relay wrapper defeats the guard
only when a *callback handler* sits underneath it. every wrapper the scan found relays a
promise-style function, so each one that reaches `onReferenced` still resolves — the wrapper hides
the arity and there is no broken arity to hide.

⇒ **so the guard's hole exposes nobody today**, and the branch *"leave it clamped"* rests on a
measured premise rather than an assumed one. that is what moves 60% → 88%.

🟡 **and the residue is why it is not 100%.** the measurement is a snapshot of one org's local
clones, and the *conjunction* is one migration away: a repo that adopts a callback handler while
already on the wrapper convention re-opens it silently. the clamp and the readme note are what keep
that surprise from a consumer.

⚠️ **the numbers above also explain why the drive could not have inferred this.** `...args` is
frequent enough (252) that a guess from its count alone would have ruled the fork *dangerous*; the
answer turns entirely on the other factor, which is rare enough (0) to invert it.

## .the verdict, once ruled

_(unruled)_

⇒ see also: `assertHandlerIsRunnable.knownLimit.test.ts` (the clamp) · **F8** (the promise-only
contract this bounds) · `rule.forbid.failhide` · `rule.require.hook-wrapper-pattern`.
