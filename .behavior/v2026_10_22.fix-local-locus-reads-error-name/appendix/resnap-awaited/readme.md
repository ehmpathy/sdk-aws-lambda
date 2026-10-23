# resnap awaited — two acceptance edits held out of the first commit

the aws sso unlock for `ehmpath/test` timed out (no human at the browser prompt), so the acceptance suites could not resnap. ci runs jest with `--ci`, which fails on a snapshot it must write. so these two edits are parked here, and the committed tests hold the last resnapped state.

| parked copy | the edit | the review point it answers |
|---|---|---|
| `local.sqsQueue.acceptance.test.ts.txt` | `[case3][t2]` snapshots `{ response, refusedIds }`, so it cannot read as `[t1]`'s served batch | 5.3 i005 r011 nitpick.2 |
| `deployed.faultLabel.acceptance.test.ts.txt` | the snapshot then is named for its claim; the endpoint hoisted; `class` and `isCallerFault` kept per row, since the `constraint` row flips both on the bump; a `note` on that row that names helpful-errors#47 | 5.3 i005 r011 nitpick.3, nitpick.4; i006 r011 nitpick.5, nitpick.6 |

## also owed in the same commit — conceded at 5.3 i006, each needs an acceptance resnap

| file | the edit | the review point |
|---|---|---|
| `blackbox/local.sqsQueue.acceptance.test.ts` | `[case6][t0]` and `[t1]` settle through `asInvokeSettled`, as `[case7]` does, so a regression shows its cause | i006 r010 nitpick.4, r011 nitpick.3 |
| `blackbox/local.sqsQueue.acceptance.test.ts` | `[case1]` snapshots `seen[0]`, not the whole array, so the snapshot is not keyed `"0"` | i006 r011 nitpick.2 |
| `logSqsRecordInvalid.ts` | the `sqs.record.invalid` consequence uses "redriven", the one word the refusal line uses | i006 r011 nitpick.4 |

## to land them

1. `rhx keyrack unlock --owner ehmpath --env test` (a human at the browser prompt)
2. copy each `.ts.txt` back over its `blackbox/` file (`rhx cpsafe`), then remove this dir
3. `rhx git.repo.test --what acceptance --against local --env test --scope path://local.sqsQueue --mode apply --resnap`
4. the same with `--scope path://deployed.faultLabel`
5. commit as the follow-up
