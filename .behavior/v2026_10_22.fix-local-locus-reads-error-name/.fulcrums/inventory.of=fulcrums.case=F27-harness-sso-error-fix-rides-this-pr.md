# F27 — the test harness's sso error fix rides this pr

## the fork

5.3 i006 `enroll-verif-test-intent` nitpick.1: the `useKeyrack.ts` change (its signature gains `keyrack`; its error names `rhx keyrack unlock`) is unrelated to the wish, so it would be better as its own pr.

| option | for | against |
|---|---|---|
| **keep it here** (taken) | the director ordered it: "fix it forward in this pr (small, safe, clean)", after its raw `aws sso login` headline halted this route's driver. it is a test asset, with its own clamp (`useKeyrack.test.ts`, red with the old message) | one unrelated file in a fix pr |
| split it into its own pr | a narrower diff | reverses a direct order; a second pr to review for a two-line message change |

## taken, and why at the time

kept, by the director's order.

## rework

clean — move two files to their own branch.

## confidence — 95%

## where

`src/__test_assets__/useKeyrack.ts` · `src/__test_assets__/useKeyrack.test.ts`

## verdict

ruled — the director.
