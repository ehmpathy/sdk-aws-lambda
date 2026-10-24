# F26 — the local label mirrors the whole runtime rule, not `.name` alone

## the fork

5.3 i006 `enroll-verif-test-intent` blocker.2 and blocker.3 ask to keep two old local behaviors the wish did not name:

- blocker.3: a thrown bare string labels `'Error'` locally (old fallback), not `'string'`
- blocker.2: a cross-realm bag `{ constructor: { name: 'MalfunctionError' } }` keeps its class label, so the old fixture passes unchanged

the wish: "the local locus reads `error.name`, **exactly as the runtime does**, so a local run reproduces the cloud wire".

| option | for | against |
|---|---|---|
| **mirror the whole `toRapidResponse` rule: `.name`, else `typeof`, else `'handled'`** (taken) | "exactly as the runtime does" names the rule, not one field. the cloud is measured: `deployed.faultLabel` reads `errorType: 'string'` for a thrown string on the real runtime, so the old local `'Error'` was a local-only label, the same defect class as #73. the runtime reads `.name`, never `constructor.name`, so a constructor-only bag has no class on the cloud either | two extant expectations change, each with a `.verdict` line |
| keep the `'Error'` fallback and the constructor read | the two old tests pass verbatim | a local run then disagrees with the cloud for every non-error throw and every constructor-only bag: the pr gate green over a red prod, which is the wish's own defect |

## taken, and why at the time

the whole rule. the wish's outcome is a local run that reproduces the cloud wire, and a partial mirror cannot do that.

## rework

clean — restore the `'Error'` fallback and the constructor read in `asErrorTypeOfErrorLike`, flip the two tests back.

## confidence — 90%

## where

`asErrorTypeOfErrorLike.ts` · `asWireFunctionErrorPayload.test.ts` `[case2]`, `[case3][t0]` · `deployed.faultLabel.acceptance.test.ts` `string` row

## verdict

open — the director ruled the 5.3 forks clean verification forks; for the fulcrum council.
