# F24 — no helpful-errors pin; the clamps read the shipped 1.7.3 state

## the fork

wish done #3: "if the clamps need the new helpful-errors before it releases, pin it via a pnpm link or `pnpm patch`". 5.3 i004 `enroll-verif-test-intent` blocker.1 asks for that pin, so serde `[case1][t0]` can keep its old `'ConstraintError'` expectation.

| option | for | against |
|---|---|---|
| **no pin; clamps read 1.7.3, a `.name`-set positive control beside them** (taken) | the label mirror's own clamps set `.name` by hand, so none needs the new helpful-errors. the 1.7.3 tests state what prod reads today (the deployed suite measures it). `[case22][t5]` proves the caller-fault outcome once `.name` lands | four tests go red on the helpful-errors bump, and must flip in that bump |
| `pnpm patch` helpful-errors to set `.name` | `[case1][t0]` keeps its old value; wish outcome 2 holds in this tree | the tree no longer matches what a consumer installs, so the clamps would read a state no prod reads; the patch must be removed on release |
| `pnpm link` the peer tree | same as above | a local link cannot ship, so ci reads a different tree than the driver |

## taken, and why at the time

no pin. the wish's condition ("if the clamps need") does not hold: no clamp of the fix needs it. a vision-level call, so it is asked of the commander in the pr body.

## rework

clean — add a `pnpm patch` and flip four expectations, or keep as is.

## confidence — 80%, and why it is not higher

wish outcome 2 reads "once helpful-errors carries `.name`", which supports no pin, but a reader may take done #3 as a mandate.

## where

serde `[case1][t0]` · integration `[case22][t1]`–`[t3]`, `[t5]` · `deployed.faultLabel` `constraint` row · `package.json`

## verdict

open — asked of the commander in the pr body.
