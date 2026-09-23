# `F03` — `zod` + `domain-objects` stay hard deps; no `peerDependencies` block is added

| field | value |
|---|---|
| **rework** | dirty |
| **status** | open |
| **confidence** | 79% |
| **where** | `package.json:62-79` |
| **raised** | 2026-09-18, answering `r011 enroll-impl-arch-defects` item 3 |

## the fork, stated fairly

a peer reviewer read `package.json` and found both runtime deps pinned as plain `dependencies`,
with **no `peerDependencies` block in the file at all**. it argued this PR is the moment that
classification became load-bearing: a consumer's `X.contract()` schema is now parsed on every
request, so two live copies in one `node_modules` is a real hazard.

| option | what it costs |
|---|---|
| **A — add `peerDependencies`, keep `dependencies` as fallback** | changes how every consumer's install picks a version; npm 7+ can hard-error where no version satisfies the range, pnpm errors by default under `strict-peer-dependencies` |
| **B — leave both as hard deps** *(taken)* | a version split stays possible, and publishes a wrong contract with no tell |
| **C — a runtime version assert, no manifest change** | catches the split loud, and prevents it not at all |

## taken, and why at the time

**B**, deferred to a dream, for two reasons that are about the CHANGE rather than about the hazard:

1. **the hazard was overstated as raised, and the correct version is a different dep.** measured,
   not read: `src` prodcode holds **zero** runtime `instanceof` against a domain-objects class, and
   every prodcode `domain-objects` import is an `import type` except three that `extend` the base to
   declare this sdk's OWN dobjs. the parse runs the consumer's code with the consumer's install, so
   the split the review described cannot bite there. the live cross-copy call is
   `getJsonSchemaFromZod.ts:1` — a **value** import of `z`, handed a schema the consumer's `zod`
   built. ⇒ so `zod` is the sharper exposure, and a manifest edit aimed at `domain-objects` alone
   would have been aimed at the wrong dep.

2. **the repair is unmeasured and it ripples.** neither npm's nor pnpm's behavior under the new
   range was run here, and the range's WIDTH is its own call: `^4.4.3` bets zod holds its internal
   `_zod.def` shape across minors, which is the exact thing this fulcrum worries about.

⇒ both `rule.always.fix-forward-under-scouts-honor` tests answer ⛔, so it defers with its shape
recorded rather than lands half-measured.

## rework, and why

**dirty.** a published `peerDependencies` block is a contract with every installed consumer. once
shipped, a narrow range cannot be widened without a release, and a wide one cannot be narrowed
without breaking installs that already satisfy it. the reversal is a teardown, not a rename.

## confidence, and why it is not higher

**79%.** the 21%:

- a reviewer could hold that **option A is SAFE by construction** — a peer range with
  `dependencies` kept as fallback is the documented npm pattern precisely because it breaks no
  install that was already correct. if that read holds, the correct verdict is *fix it now*, and
  this fulcrum is a deferral that should not have happened.
- the measurement bounds itself: it walked `src`, and a consumer's exposure runs through the
  **built** package. a bundle that inlines `domain-objects` would change the arithmetic, and no
  build output was read this round.

## what changed AFTER this entry was first written

a later review round (`r10` @ `i009`) reached the same seam from the other side, and the repair it
prompted **narrows what a wrong verdict here costs** — and leaves the verdict itself open.

- `getJsonSchemaFromZod` now REFUSES a schema that carries no recognizable `_zod` marker, by name,
  with a fix hint that states the two-copy cause and the `npm ls zod` / `pnpm why zod` command
- ⇒ so a split install no longer surfaces as a bare `TypeError` one frame deep in a vendor file. it
  surfaces as a `MalfunctionError` that names zod, the schema, and the dedupe
- the guard is clamped at `[case8]` of the peer spec, and its bite is measured: **2 red** with the
  guard struck, and `[t2]` green either way — so it fires on exactly the set that already crashed

⚠️ **this does NOT close the fulcrum, and it must not read as though it does.** the manifest question
is unchanged: a peer range PREVENTS the split, and a named error only DIAGNOSES it. what moved is
the cost of the 21% — if the wisher rules *fix it now* and this deferral was wrong, the consumer who
met the defect meanwhile got a diagnosable failure rather than a vendor stack trace. status: **LIVE,
NOT FIXED** (`rule.require.deferred-defect-records-lead-with-status`).

## verdict

_(unruled — the wisher's call at the fulcrum council)_

## see also

- `.dream/v2026_09_18.fix.zod-and-domain-objects-are-hard-deps-not-peers.md` — the work owed,
  with the shape of the fix and the clamp it needs
- symlinked at `$route/dreams/`
