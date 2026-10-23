# F25 — snapshots keep a hydrated error's undefined keys; an unchanged code path gets no new snapshot

## the fork

5.3 i004 `enroll-verif-snapshot-coverage` raised two asks:

- nitpick.4: drop `causeMessage: undefined` and `details: undefined` from the `[case22][t4]` snapshot
- nitpick.3: pin the loud error log a perRecord server fault leaves before it redrives

| option | for | against |
|---|---|---|
| **keep the undefined keys; no new snapshot for the redrive log** (taken) | the keys are fields a caller can enumerate on the hydrated error, and a deny-list keeps every such field (`rule.require.snapshots-deny-volatile-not-allow-expected`). the redrive log's code is unchanged on this branch, so its pin is a separate gap | two lines of snapshot noise; the redrive log stays unpinned |
| strip undefined keys in `asErrorMasked` | quieter snapshot | an allow-list by another name: a key that turns defined later shows as a new key, not a changed value |
| pin the redrive log here | closes the gap | widens a patch past the wish into a path it does not touch |

## taken, and why at the time

held both. the first keeps the snapshot honest; the second is scope (F20).

## rework

clean — one filter, or one new then block.

## confidence — 85%

## where

`runLambdaEndpoint.onSerialized.integration.test.ts` `asErrorMasked` · `genSqsEndpointMiddlewares.ts`

## verdict

open — for the fulcrum council.
