# F22 — the bundle's class-name suffix is masked in the snapshot; the helpful-errors dedupe is deferred

## the fork

the deployed fault-label snapshot read `ConstraintError2` / `MalfunctionError2` (5.3 i002, `ergo-snapshot-visual-blemishes` blocker.1). the cause: the sdk's production tree holds two helpful-errors copies (`with-simple-cache@0.15.3` pulls 1.5.3 beside 1.7.3), so esbuild renames one class by module order.

| option | for | against |
|---|---|---|
| **mask the suffix in the suite's deny-list; dream the dedupe** (taken) | the suffix is volatile (module order) and names no class; the suite measures the runtime label, which never reads it. the mask sits beside the extant `exid` / `stackTrace` masks (`rule.require.snapshots-deny-volatile-not-allow-expected`) | the cause stands until the dream lands |
| bump `with-simple-cache` in this pr | fixes the cause | a production dependency bump in a patch about a label and an sqs disposition; it ripples into every consumer's tree |
| `keepNames: true` in `setLambdaZip` | the bundle keeps the source names | changes every deployed suite's bundle, and hides a rename a consumer's own bundle may still make |

## taken, and why at the time

masked, with the cause named at the mask and caught as `.dream/2026_10_22.dedupe-helpful-errors-copies-in-sdk-bundle.dream.md`. the snapshot reran green with clean headlines (6 passed).

## rework

clean — a one-line dependency bump plus the removal of one mask, once ruled in.

## confidence — 85%, and why it is not higher

a mask beside a known cause can read as a workaround (`rule.forbid.workarounds`). the defense is scope: the cause predates this branch and its fix changes the production tree.

## where

`blackbox/deployed.faultLabel.acceptance.test.ts` (`asHeadlineUnsuffixed`) · `package.json` (`with-simple-cache`)

## verdict

open — for the fulcrum council.
