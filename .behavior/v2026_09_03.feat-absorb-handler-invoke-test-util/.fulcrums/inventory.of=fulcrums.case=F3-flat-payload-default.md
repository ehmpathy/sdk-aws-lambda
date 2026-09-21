# F3 — the default payload is contemp; the flat frame is opt-in

> ✅ **FLIPPED by the wisher, 2026-09-08.** the default was **flat**; it is now **contemp**, and the
> rework drops from **dirty** to **clean**. this was the drive's only dirty row — the board now
> carries **zero**.

## 🔴 the flip, and the one sentence that caused it

the wisher withdrew the wish's *"every handler test still passes"* bar:

> *"they don't need a one-line swap, that's not a concern."*

**two of F3's three arguments were that bar, restated.** with it withdrawn:

| # | the argument as taken | status |
|---|---|---|
| 1 | *"the migration is a one-line import swap; a wrapped default breaks 318 sites"* | 💀 **dead** — pure migration cost |
| 2 | *"faithful to the un-hinted call"* — `{ event }` says no word about a trail | ✅ survives |
| 3 | *"prefer the edge the ecosystem already stands on"* — the larger population is committed | 💀 **dead** — pure migration cost |

argument 2 is the only principled one left, and it is **outweighed** by
`rule.require.contemp-contracts-default`, which is graded **blocker** and says exactly this:

> *"always use contemp contracts by default. backwards compat only when the caller is explicitly
> identified as ancient."*

⇒ the residual 4% recorded at r3 — *"a wisher who reads `rule.require.contemp-contracts-default` as
binding may accept the migration cost"* — is precisely what the wisher ruled. **the fulcrum
predicted its own flip and named the rule that would cause it.**

## why the rework is now CLEAN

it earned **dirty** on two claims, and both are gone:

| the dirty claim | why it no longer holds |
|---|---|
| *"the break is silent at the type level… only a red suite will catch it"* | **F9** puts the dialect in the return type, so a cross-dialect field access is a **compile error** |
| *"consumers harden against it immediately"* | with no compat bar, a downstream assertion rewrite is an expected migration cost rather than a failure |

## the extant record, preserved

the argument as it stood before the flip is below, unedited, because the *evidence* remains true —
only its weight changed. the incumbent provably sends a flat payload; that is now a fact about the
past rather than a constraint on the design.

---

## the fork, stated fairly

`genLambdaEndpoint` accepts two payload formats — `LambdaHandlerInput<TInput>` is a union of
`FlatPayload` and `WrappedPayload` (`genLambdaEndpoint.forAskEndpoint.ts:20-37`). the util must
pick which one it sends by default when the test author writes only `{ event }`.

the choice is not cosmetic, because **the payload format silently selects the error envelope
shape**:

```ts
// genConstraintErrorMiddleware.ts:44-52
const isContempCaller = context.isContempCaller ?? false;
const body = isContempCaller
  ? getErrorResponseBodyContemp({ error, errorClass: 'ConstraintError' })
  : getErrorResponseBodyAncient({ error, errorType: 'BadRequestError' });
```

and `isContempCaller` is set by `genTrailMiddleware` from whether the payload arrived wrapped
(`invariant.ancient-vs-contemp-callers`).

⇒ **the same handler, the same bad input, two different error shapes:**

| the util sends | the test author asserts on |
|----------------|----------------------------|
| flat — `{ name: 'bob' }` | `{ errorMessage, errorType: 'BadRequestError' }` |
| wrapped — `{ event: {...}, trail: { exid } }` | `{ error: { _serde, class: 'ConstraintError', message } }` |

so the default is not a convenience knob. it is the shape of every error assertion in every
migrated repo's handler suite.

## taken, and why at the time

**taken: flat by default; the wrapper opt-in via an explicit `trail` input.**

1. **it is what the legacy util did, so the migration is a one-line import swap.** the wish's
   done-when is that a migrated repo deletes `simple-lambda-testing-methods` and *every handler
   test still passes*. the legacy util's `{ event, handler }` passed the raw `event` straight to the
   handler — **flat**, with no wrapper. a wrapped default would change the envelope under every
   extant assertion, and those tests would fail. that would not be a migration; it would be a
   rewrite, and it would miss the wish's bar.

   > ⚠️ **corrected at r2.** this line cited the legacy call as two positional args — the signature
   > r1 disproved (its issue 4; the measured shape is a single named-arg object, verified across 20
   > repos). the *argument* is unaffected — what matters here is that the legacy util passed the
   > event **unwrapped**, which holds either way — but the citation under it was wrong. this was
   > the fourth copy of one corrected fact left standing after r1.
2. **it is faithful to the un-hinted call.** a test author who writes `{ event }` and no more has
   said not one word about a trail. to synthesize one is to invent a caller identity they did not
   ask for — and then to hand them a different error shape because of it.
3. **the sharp edge is real either way, so prefer the edge the ecosystem already stands on.**
   whichever default we pick, the *other* shape surprises someone. flat surprises the author who
   expected contemp semantics; wrapped surprises every extant test. the second population is
   larger and already committed.

## rework, and why DIRTY

**dirty.** the flip is not a rename or an added flag — it changes the value returned by an
already-adopted call signature:

- a consumer test that asserts `expect(res).toMatchObject({ errorType: 'BadRequestError' })` starts
  to fail, because the field now sits at `res.error.class` with the value `'ConstraintError'`.
- the break is **silent at the type level** if the util's return type is loose (the handler's
  `TOutput` does not describe the envelope at all), so the compiler will not catch it — only a red
  suite will, in every downstream repo at once.
- consumers harden against it immediately: the whole point of the util is that handler tests assert
  on error envelopes, so the first adopter's first test binds to the choice.

this is precisely the "callers harden against it, so reversal is a teardown" shape.

## the mitigation that keeps the guess cheap

the flip stays cheap for exactly as long as the default is **stated, not inferred**. so:

- the util's `.what` header names the default and its consequence in one line
- the assertion helper (F5), if it ships, reads **both** shapes — so a test written through the
  helper survives the flip, and only hand-rolled assertions break

if the council wants a smaller blast radius before adoption, F5 is the lever, not F3.

## confidence, and why 96% — raised again at r3, on the incumbent's own source

> ⬆️⬆️ **raised twice.** 78% → 88% at r1 on measured consumer evidence; **88% → 96% at r3**, when
> the legacy implementation itself was finally read.
>
> the r1 evidence was *behavioral* — consumer tests destructure `errorMessage`, an ancient-only key,
> so the flat shape must be what they receive. good, but inferential.
>
> **r3 makes it structural.** `simple-lambda-testing-methods/src/invokeHandlerForTesting/invokeHandlerForTesting.ts:31-33`:
>
> ```ts
> const response = handler(
>   stripInvocationEvent(event),   // ← the event, stripped. and no other argument.
>   context as Context,
> ```
>
> the legacy util passes the stripped event **directly** to the handler. there is no wrapper, no
> trail, and no `{ event, trail }` shape anywhere in its 41 lines. so **flat is not merely what
> consumers appear to receive — it is what the incumbent provably sends**, and a wrapped default
> would change the payload every one of the 318 sites has ever passed.
>
> the residual 4%: this settles what *is*, never what *ought*. a wisher who reads
> `rule.require.contemp-contracts-default` as binding may accept the migration cost to get contemp
> semantics from day one. that remains a legitimate product call and it is **Q2**, the question this
> vision asks be ruled first.

`rhx git.repo.get lines --repos 'ahbode/*' --words 'invokeHandlerForTesting'` returns **318 matches
across 20 repos**, and among them consumer tests destructure the ancient envelope **by field name**:

```ts
// ahbode/svc-funnel-comms/…/executeTaskAskJobOwnerToPickQuote.integration.test.ts:56,72,88
const { errorMessage } = await invokeHandlerForTesting({ … });
```

`errorMessage` is a top-level key of the **ancient** envelope only
(`getErrorResponseBody.ts:57-62`); the contemp shape nests it at `error.message` (`:77-84`). so
under a contemp default that destructure yields `undefined`, and the test fails with no type error
to warn it first. a contemp default demonstrably breaks live tests in at least one service — this is
no longer a projection.

the residual 12% is the live tension the wish leaves open:
`rule.require.contemp-contracts-default` says "always use contemp contracts by default; backwards
compat only when the caller is explicitly identified as ancient". a flat default makes the util an
**ancient caller by default** — which reads against that rule.

the counter is that the rule governs the *server's* choice of response given a detected caller,
and the util is a *caller*, free to identify as either. but it is a real argument on the other
side, and the wisher may weigh the two differently. hence the row, and hence the low-ish number.

## where

- the util's input contract: `{ event }` vs `{ event, trail }`
- every error-envelope assertion in every migrated repo's `*.integration.test.ts`

## the verdict

**ruled 2026-09-08: contemp by default; the flat frame is opt-in via
`struct: { payload: 'ancient' }`.** rework **clean**. closed.

⚠️ **and it takes Q2 with it.** Q2 asked the wisher to rule flat-vs-contemp first, on the grounds
that it was the one dirty rework on the drive. it is ruled, and the reason it was dirty is gone.
