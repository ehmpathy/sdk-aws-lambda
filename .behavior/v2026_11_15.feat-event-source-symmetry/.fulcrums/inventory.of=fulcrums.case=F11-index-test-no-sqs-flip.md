# F11 — the `src/index.test.ts` "no sqs" assertion flips to include `fromSqs`

## .the fork

`src/index.test.ts` asserted that the schema family holds `['fromKinesis', 'fromSns']` and, in its comment, that a `fromSqs` would be a second sqs path that refuses the whole batch. the wish makes `asLambdaEventSchema.fromSqs` exist.

- **flip**: assert `['fromKinesis', 'fromSns', 'fromSqs']`, and lock the guarded behavior elsewhere
- **keep**: leave the old assertion, which fails the wish

## .taken — flip

- the wish names `fromSqs` as an outcome, so the old assertion cannot stand beside it
- the behavior the old comment guarded stays locked in two places:
  - `forSqs.perBatch` / `forSqs.perRecord`: one bad message is refused alone; untouched but for renames
  - `forAsk.eventSource.test.ts` `[case2a]`: `fromSqs` under `forAsk` answers the whole batch as a `BadRequestError`, and the warn line names every `messageId`, says sqs deletes every message, and points at `genLambdaEndpoint.forSqs`
- the reviewer (r012, i004 and i005) agrees the flip is unavoidable and asks only for the commander's sign-off

## .rework — clean

one assertion and one comment.

## .confidence — 95%

a criterion change is the commander's to sign; the code cannot close that ask.

## .verdict

disputed (r012 blocker.1), to the commander, in the pr body under "deliberate flips".
