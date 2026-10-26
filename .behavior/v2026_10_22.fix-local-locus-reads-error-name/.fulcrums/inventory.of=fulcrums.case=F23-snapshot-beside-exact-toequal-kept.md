# F23 — a contract snapshot is kept beside an exact `toEqual` of the same value

## the fork

two peer lanes on 5.3 ask opposite things of one test block:

- `ergo-contract-snapshots` (i002 r002) asked for a snapshot of each caller-visible output: each `batchItemFailures` variant, and the operator's `sqs.record.refused` line
- `repo-rules` (i003 r001 nitpick.1) calls that snapshot redundant where an adjacent `toEqual` pins the same value (`rule.require.snapshots-deny-volatile-not-allow-expected`)

| option | for | against |
|---|---|---|
| **keep both** (taken) | `rule.require.snapshots` (mechanic) asks for both, a snapshot for review and an assertion for function. a pr reviewer reads the `.snap` diff as the output catalog, so it carries reach for a human even where it adds none for a machine | the snapshot cannot go red apart from its `toEqual` |
| delete the snapshots | one assertion per value | re-opens the `ergo-contract-snapshots` ask, which the lane already closed |
| widen each snapshot to a value the `toEqual` does not pin | reach for both lanes | `[case3]` and `[case7]` have no wider value: the response IS the sqs contract |

## taken, and why at the time

kept both. the two lanes contradict, and `rule.require.snapshots` names "use both" as critical.

## rework

clean — delete seven `toMatchSnapshot` lines and their entries, or keep them.

## confidence — 85%, and why it is not higher

the `[case7]` snapshot holds a test-made `{ failed: true }` box, not an sdk output. its review value is the weakest of the seven.

## where

`blackbox/local.sqsQueue.acceptance.test.ts` `[case3][t0]`–`[t3]`, `[case7][t0]` `[t1]` · `logSqsRecordRefused.test.ts` `[case1][t0]`

## verdict

open — for the fulcrum council.
