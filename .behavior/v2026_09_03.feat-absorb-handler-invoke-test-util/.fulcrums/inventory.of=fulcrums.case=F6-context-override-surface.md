# F6 — the lambda `Context` is overridable, and partial

## the fork, stated fairly

`genLambdaEndpoint` handlers take `(event, lambdaContext: Context)`. a test author must get a
`Context` from somewhere. three shapes:

- **hidden** — the util fabricates one; the author cannot touch it
- **required** — the author must build and pass a full `Context`
- **partial override** — the util defaults one, the author overrides the fields they care about

## taken, and why at the time

**taken: partial override** — `{ event, context?: Partial<Context> }`, merged over a default.

1. **it is already the repo's answer.** `invokeHandlerForTest.ts:9-18` takes
   `context?: Partial<Context>` and merges it through `createTestContext`
   (`createTestContext.ts:7-21`). the shape is extant, in-repo, and needs no invention — this is a
   promotion, not a design.
2. **a required full `Context` is 14 fields of ceremony per test.** `createTestContext.ts:8-20`
   shows the surface. `rule.prefer.defaults-match-common-case` grades that a nitpick, and the
   common case (an author who does not care about `awsRequestId`) would pay it on every call.
3. **hidden fails a real need.** `functionName` is the one field a handler can legitimately branch
   on, and `createInProcessLambdaHarness.ts:71` already sets it per-invocation for exactly that
   reason. a fully hidden context would make that untestable.

⚠️ **one constraint the promotion must respect**: `createTestContext.ts` also exports
`createMockLog`, which calls `jest.fn()`. that export **must not** travel with the move — jest is
devDependency-only (`package.json:80-115`), so a shipped module that imports it breaks a consumer
install. only the pure `createTestContext` half is portable.

## rework, and why clean

**clean.** the override is optional and defaulted, so it is additive to widen (accept more fields)
and near-free to narrow before adoption. the only sharp edge is the `createMockLog` split, and that
is a build-correctness constraint rather than a design fork.

## 🔴 challenged at r3 — and the challenge changed the justification, not the choice

i set out to strike this as a `rule.prefer.wet-over-dry` violation: a surface carried forward with
no measured demand. **the demand is indeed zero** — not one of the 318 legacy call sites passes a
context override.

**but the legacy signature settles it the other way** (`invokeHandlerForTesting.ts:21-29`):

```ts
export const invokeHandlerForTesting = async <E, R = any>({
  event, context = {}, handler,
}: { event: E; context?: Record<string, any>; handler: Handler<E, R> }): Promise<R>
```

⇒ `context` is **part of the incumbent contract**. so it is not speculative surface — to drop it
would *narrow* a signature this vision promises is drop-in. "zero demand today" and "invented
surface" are different claims, and only the first is true.

### 🟡 why F8 read the SAME evidence and landed the other way

**F8 drops callback support on the same zero-demand measurement, and the rule that parts the two is
declared once — in `inventory.of=fulcrums.case=F8-promise-only-handlers.md:61-76`:**

> *"⇒ the split is **cost to keep**, not principle. F6's surface is a field; F8's is a code path."*

⚠️ **read it there rather than here.** a second copy of that table is a second copy to go stale,
which is this drive's signature defect — the pointer is the whole repair.

.note = raised at i036 r011 `enroll-impl-arch-defects`, which asked for *"a single written rule …
  so the next fork doesn't re-litigate this from scratch"* while it quoted **both** cost figures
  from the table that states it. ⇒ **the principle was written and unreachable from this entry**,
  and an unreachable declaration reads to a fresh reader exactly like an absent one. so the charge
  was right about the symptom and wrong about the cause, and the repair is a pointer rather than a
  new rule.

## 🔴 the divergence this fulcrum had concealed

the same read surfaced a behavior difference neither the wish nor this entry had named:

| | legacy | ours |
|---|---|---|
| default context | a bare **`{}`**, cast to `Context` (`:23`, `:33`) | `createTestContext(input.context)` — a **populated** default (`invokeHandlerForTest.ts:14`) |
| a handler that reads `context.awsRequestId` | `undefined` | a real value |

**a genuine behavior change inside a "drop-in" replacement.** i judge ours the better default — a
populated context is more wire-like, and the legacy's own comment at `:33` concedes its bare cast is
a convenience rather than a design. **so the call stands; what changes is that the divergence is now
declared instead of silent**, which is the whole failure mode a drop-in promise invites.

⚠️ **unmeasured, and stated as such**: i did not check whether any of the 318 sites has a handler
that actually reads a context field. if one does, this divergence has teeth and the choice should be
revisited rather than merely recorded.

## 🔴 the boundary this entry never named — raised at i005 r010

r010 read the entry and found its scope unstated: *"that override only exists on `onReferenced`'s
signature. `onSerialized`'s local locus calls `onReferenced({ event, handler, …struct })` with no way
for a caller of `onSerialized` to inject a context override."* the charge is right on the fact.

**and the fact turned out to name a DEFECT rather than an absent feature.** with no context passed,
`asLambdaContext()` supplied its own placeholder, so the same call answered:

| locus | `context.functionName` the handler saw |
|---|---|
| `'cloud'` | `svc-example-test-getServiceBySlug` — the slug aws delivers |
| `'local'` | `run-lambda-endpoint` — a default |

⇒ and **this entry's own item 3** names `functionName` *"the one field a handler can legitimately
branch on"*. so a handler that branches took one path in ci and the other against real aws — the
divergence this fulcrum exists to prevent, on the very axis it had already marked as the one that
carries weight.

### the verdict: a DERIVATION on `onSerialized`, never a knob

| | `onReferenced` | `onSerialized` |
|---|---|---|
| who knows the identity | **the author** — there is no endpoint, only a function | **the util** — the caller named it in `which` |
| the shape | `context?: Partial<Context>` — an override | derived from `endpoint.slug` — no parameter |
| can the other locus honor it? | n/a — one locus | **no.** `at: 'cloud'` is built by aws |

**so r010's requested passthrough is declined, and the reason is the boundary's own contract:**

- a `context?: Partial<Context>` on `onSerialized` would be a knob **one locus silently ignores**
  (`rule.forbid.unexpected-defaults`), on the one operation whose stated guarantee is that *"the
  locus changes where, never what"* (`define.lambda-endpoint-run-boundary`)
- and it is **not needed**, because the identity is not the caller's to supply — they already named
  it in `which` (`rule.require.solve-at-cause`)
- an author who genuinely wants to forge a context holds the referenced boundary, where the override
  lives and where no wire can contradict it

⇒ **the two boundaries take opposite answers on the same axis, and that is the axis at work.**

### the trail, the lower-stakes half

the cloud locus puts the caller's exid in the payload (`askLambdaEndpoint.ts:78`); the local path
passed none, so the endpoint's trail middleware generated a fresh one and the caller's trace did not
join up. **no test broke** — `invariant.payload-format-compat` guarantees an absent trail is legal —
which is exactly why it stayed invisible. now forwarded.

⚠️ **it does NOT select the dialect** — the frame is derived from `struct.payload`
(`runLambdaEndpoint.onReferenced.ts:80`), so this supplies the exid and changes no envelope shape.

### 🟡 the clamp exposed a snapshot that had pinned the bug

the `[t8]` snapshots were deterministic **only because the exid was hardcoded `null`**, so the
repair turned them red. ⇒ **a snapshot that holds still only while a field is broken is not evidence
that the field is right**, and the fix was to supply what a real caller supplies rather than to
re-accept the old output.

## confidence, and why 88%

high. the shape is copied from live in-repo code rather than invented, and the jest hazard is
verified against `package.json`. **held at 88% after r3** — the incumbent-signature evidence firmed
the *keep* decision, while the newly-found default-context divergence added an equal-sized doubt in
its place.

the 12% now covers two things: whether `createTestContext` should *also* be public surface in its
own right (i left it internal — the smaller surface, but a maintainer may want it out), and whether
the populated default should instead match the legacy's bare `{}` for strict fidelity.

## where

- the util's input contract: `context?: Partial<Context>`
- **the default context's contents** — populated (ours) vs bare `{}` (legacy)
- wherever `createTestContext` lands once it leaves `__test_assets__`
- **`onSerialized`'s local locus** — the derivation, and the absence of a passthrough
  (`runLambdaEndpoint.onSerialized.ts`), clamped at `[case8][t9]`

## the verdict

_unruled — open for the council._
