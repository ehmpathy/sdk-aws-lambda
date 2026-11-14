# S1 — rulings as guessed

## .said

> - F1 (sqs via genLambdaEndpoint.forSqs, no fromSqs): ruled, as you guessed. the docs show the sqs path through forSqs, so the wish's sqs ask is met.
> - F5 (kinesis rides forAsk, one bad record refuses the batch): ruled, as you guessed, with the docs caution you named. a forKinesis family with per-record failure is a dream, not this wish.
> - F12 (forAsk carries aws-delivered events for this wish): ruled, as you guessed; families stay dreamt.

— director, 2026-11-14 12:5xZ

## .settled

no `fromSqs`; sqs is served by `forSqs` and documented so. kinesis ships on `forAsk` with the
all-or-none caution in its doc. `forAsk` carries sns and kinesis for this wish; `forSns` /
`forKinesis` stay dreamt.

## .landed

| where | what |
|---|---|
| fulcrum entries F1, F5, F12 | verdict |
| `1.vision.yield.md` | q1, q2, q12 tagged `[ruled]` |
