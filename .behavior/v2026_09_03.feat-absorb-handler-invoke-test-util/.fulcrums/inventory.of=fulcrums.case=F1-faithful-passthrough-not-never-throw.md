# F1 — the util is a faithful pass-through, not a never-throw

## the fork, stated fairly

the wish's `🔴 .the contract it MUST honor` says:

> **`genLambdaEndpoint` does NOT throw on a domain error in-process.** it *catches* the error and
> *returns* an error-envelope response

and then mandates:

> ⚠️ **do NOT re-throw domain errors.**

read literally, that is an instruction to build a util that **never throws** — one that catches
whatever the handler throws and converts it to an envelope, the way
`createInProcessLambdaHarness` does for the wire simulation.

read by its stated *principle* — "an in-process util must stay faithful to what the handler
actually returns" — it is an instruction to build a **pass-through**: return what the handler
returns, throw what the handler throws.

**the two readings diverge, because the wish's premise is only half true.**

## what the code actually does

`genLambdaEndpoint` splits its error treatment across two middlewares:

| error family | middleware | in-process result |
|--------------|-----------|-------------------|
| `ConstraintError` / `BadRequestError` (incl. zod input-validation, introspection-blocked) | `genConstraintErrorMiddleware.ts:72` — `request.response = body` | **returns an envelope** |
| each other error (output-validation failure, a thrown `MalfunctionError`, a `TypeError`, …) | `genInternalServiceErrorMiddleware.ts:62` — `throw error` | **throws** |

confirmed empirically in the repo's own suite, not merely read:

- `genLambdaEndpoint.forAskEndpoint.test.ts:61-81` — `[case2] invalid input` awaits the handler and
  asserts `{ errorType: 'BadRequestError' }` on the **returned value**. envelope.
- `genLambdaEndpoint.forAskEndpoint.test.ts:103-121` — `[case3] invalid output` wraps the call in
  `getError(...)` and asserts on a **thrown** error. throw.

so the wish's claim holds for the constraint family and fails for each other error.

## taken, and why at the time

**taken: a pass-through.** the util awaits the handler and returns its resolved value; it installs
no `catch`. a handler that returns an envelope yields an envelope; a handler that throws, throws.

three reasons, at the time:

1. **the wish's principle outranks its stated fact.** the wish tells us *why* it forbids the
   re-throw — "or the two paths disagree about the same handler and a test proves the wrong one".
   a pass-through serves that reason exactly. a never-throw would *itself* create the disagreement
   the wish means to prevent, in the other direction: it would report a malfunction as a returned
   value when the real in-process handler raises one.
2. **a never-throw needs a `catch`, and the catch is the failhide.** to convert a thrown
   `MalfunctionError` into an envelope, the util must swallow it. `rule.forbid.failhide` calls that
   a mega-blocker. `createInProcessLambdaHarness.ts:1-7,46-64` needs a documented rule-exception to
   do it — and it earns that exception because it *simulates the aws runtime*, which genuinely does
   convert throws to `FunctionError` payloads. an in-process util simulates no runtime, so no such
   justification is available to it.
3. **it is the smaller contract.** a pass-through is one line of behavior with no error taxonomy
   in it. it cannot drift from `genLambdaEndpoint`, because it makes no claim about
   `genLambdaEndpoint`'s error treatment at all.

## rework, and why clean

**clean.** the reversal is additive: keep the pass-through and add an opt-in
(`{ onThrow: 'envelope' }`) for a caller who wants the runtime-simulation shape. no consumer test
written against the pass-through breaks — a test that asserted a throw still gets a throw, because
the flag is opt-in and defaults off.

the reversal turns dirty only if the *default* flips, and no reading of the wish asks for a
never-throw default while it also asks for fidelity.

## confidence, and why 96%

high, because it is not a judgment call — it is a fact check with two citations in the repo's own
committed test suite. the 4% is the chance the wisher meant a narrower sense of "domain error"
(e.g. *only* the constraint family), in which case the wish and this entry never disagreed and the
implementation is identical either way.

## where

- the util's core: no `try`/`catch`
- the wish's `🔴 .the contract` section — needs an amendment; see the yield's open questions

## the verdict

_unruled — open for the council._
