# F9 — the payload dialect travels in the return type, as a generic

> ✅ **RULED by the wisher, 2026-09-08**, in the same breath that superseded **F5**.

## the fork, stated fairly

`genLambdaEndpoint` emits two error-envelope shapes, and which one a caller receives is decided by
the payload frame they sent (`invariant.ancient-vs-contemp-callers`):

```ts
// ancient — flat                        getErrorResponseBody.ts:4-9
{ errorMessage, errorType, causeMessage?, details? }

// contemp — nested, serde-tagged        getErrorResponseBody.ts:14-22
{ error: { _serde: 'LambdaEndpointError::contemp', class, message, cause?, details? } }
```

a test author must assert against one of them. the fork: **collapse both at runtime** (a reader —
the old F5) or **discriminate at compile time** (a generic — this row).

## taken

**taken: a generic.** the dialect parameter flows from input to return type:

```ts
runLambdaEndpoint.onReferenced({ event, handler })
  // → TOutput | { error: { _serde, class, message, … } }        contemp, the default

runLambdaEndpoint.onReferenced({ event, handler, struct: { payload: 'ancient' } })
  // → TOutput | { errorMessage, errorType, causeMessage?, details? }
```

⇒ `res.errorType` on a contemp call is a **compile error**, not a silent `undefined` that fails an
opaque `toMatchObject`.

## why, at the time

**1 — the dialect is deterministic from input, so it is knowable at the type level.**
`genTrailMiddleware` sets `isContempCaller` from the frame the caller sent; exactly one site reads
it (`genConstraintErrorMiddleware.ts:44-45`). a runtime reader re-discovers, per call, a fact the
caller stated on input.

**2 — it is rung 1 rather than rung 4.** `rule.prefer.prevent-over-correct` ranks *make it
impossible* above *report it well*. the reader was the latter.

**3 — the seam already exists.** `askLambdaEndpoint.ts:35-42` already takes
`struct?: { payload?: 'ancient' | 'contemp' }`. this lets that parameter reach the return type; it
invents no vocabulary.

**4 — it deletes a helper rather than names one.** F5 would have shipped a public symbol whose
whole job the type system does for free.

## 🔴 what it does NOT cover — three bounds, stated

| bound | why |
|---|---|
| **the stance flip on `onSerialized`** | a rejected `Promise<T>` is well-typed. the boundary's throw-vs-return difference cannot be typed away — only the two subdomain **names** cue the author. demoed at [case=8](../1.vision.experience.case=8.the-boundary-flips-the-stance.md) |
| **the success-vs-error narrow** | the return stays a union, so `res.error` needs a guard. ⚠️ **this bound was real and was under-weighted** — it is not an optional nicety, it is what makes the guarded shape *readable*; without it the only route to `.error.class` is an `as` cast. it ships as `dialect/isLambdaEndpointErrorEnvelope.ts`, **hand-built rather than via `withAssure`**, which cannot carry a type parameter — see F5's correction |
| **the legacy family's third shape** | `createStandardHandler` emits `stackTrace` + `causeTrace` and no `details` (`badRequestErrorMiddleware.ts:93-103`), and has **0** `isContempCaller` matches. `struct.payload` describes our envelopes only, so case=7's actor — 19 repos / 314 sites — is unmodeled by this generic |

⚠️ the third bound is the one to watch. it means the error type may need to be **independently
overridable** rather than derived from `struct.payload` alone. that is a live implementation
question for the blueprint, not a settled point.

## rework, and why clean

**clean.** it is a widened return type on unreleased surface — no consumer holds it. and the
direction of safety helps: a call written against the strict type still compiles if the type later
loosens.

⚠️ **it would have been dirty under the old regime**, when *"every handler test still passes"* was
a bar — a strict union breaks `const { errorMessage } = await …` at 318 sites. the wisher withdrew
that bar in the same ruling, so the two changes are coupled: **F9 is clean only because A1
happened.**

## confidence

**90%.** the mechanism is sound and the seam exists. the 10% is the third bound above — whether the
dialect generic and the *handler-family* generic are one parameter or two is unsettled, and a
blueprint may find that two is cleaner.

## where

- the return type of both `runLambdaEndpoint` subdomains
- every error assertion in every consumer test

## the verdict

**ruled: the dialect is a generic.** F5 superseded, unbuilt.
