# F11 — a `payload` schema from the consumer's own zod

## .the fork

- **A** `asLambdaEventSchema` builds its envelope with the sdk's zod and pipes into the consumer's
  `payload` schema; one zod in the consumer's tree is a stated precondition, as it already is for
  `forAsk`
- **B** take the consumer's `z` as an input (`{ z, payload }`), so one copy builds the whole schema
- **C** refuse a foreign schema at gen time with a named error

## .evidence — measured in a consumer

`ahbode/svc-notifications`, `.route/v2026_07_28.declapract.upgrade/PERF.tsc-inference-fix.ledger.md`
(origin/main, :32-74):

- three zod copies in one tree (4.3.4, 4.3.6, and the sdk's 4.4.3)
- a consumer schema passed to `genLambdaEndpoint`'s `ZodSchema<TInput>` was a real type error —
  `_zod.version.minor: Type '4' is not assignable to type '3'` — and tsc ran out of heap while it
  tried to reconcile the two graphs
- the cure: one zod in the tree (`pnpm.overrides.zod` pinned to the sdk's version)

so the cross-copy hazard is not new with this feature. it exists at `forAsk`'s `schema.input` today,
and it fails at compile time (loud, if slow). a `payload` schema handed to `asLambdaEventSchema` meets
the same `ZodType` from the sdk's zod, so it fails the same way.

## .taken: A

one zod is already required by `forAsk`; `asLambdaEventSchema` inherits the precondition and adds no
new class of failure. B adds an argument to every call to dodge a state the consumer must already
avoid. the doc must state the precondition and its cure (the override): the evidenced cost of an
author who did not know it was a multi-hour OOM hunt.

## .what stays unmeasured

a run-time pipe across two copies that tsc let through (e.g. a cast). zod 4 shares its `_zod`
internals across minors, so it likely parses, but criteria should run it once.

## .rework: clean before release

## .confidence: 80%

## .verdict

best-guessed — raised from 65% after the consumer ledger read.
