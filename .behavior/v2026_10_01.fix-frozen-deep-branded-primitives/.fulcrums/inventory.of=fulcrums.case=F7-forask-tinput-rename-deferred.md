# F7 — `forAsk`'s `TInput` / `TOutput` keep their names; the positional rename is deferred

## the fork

- **A** — leave `TInput` / `TOutput` as they are in this patch
- **B** — rename to `TInputAfter` / `TOutputBefore`, to pair with `TInputBefore`
  (`rule.prefer.names-by-position-over-claim`)

## taken: A, and why

- raised at 5.1 i004 by `repo-rules-forbid-prefer` nitpick.1 and `enroll-impl-arch-defects` nitpick.5
- the names predate this branch: `git diff origin/main --stat` shows `genLambdaEndpoint.forAsk.ts`
  at 3 lines changed, all the `FrozenDeep` import
- the rename is SAFE (a type parameter name is no part of a consumer's call) but not CLEAN:
  `TInput` appears 42 times across 6 files (`grepsafe --pattern 'TInput\b' --path src --count`),
  in the exported `GenLambdaEndpointInput` and in middleware shared by every family, so a rename in
  `forAsk` alone would leave the family with two vocabularies (`rule.require.consistent-variant-contracts`)
- caught as `.dream/v2026_10_02.fix.forask-codec-faces-named-by-position.md`

## rework: clean

a rename across 6 files, guided by the compiler; no behavior moves.

## confidence: 92% — the wisher may want the sweep in this patch; it is still a patch either way

## ✅ verdict — ruled by the wisher: ok, defer