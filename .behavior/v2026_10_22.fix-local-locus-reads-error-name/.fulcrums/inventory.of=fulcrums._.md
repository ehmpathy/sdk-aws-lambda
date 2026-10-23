# inventory of fulcrums

| case | title | rework | status | confidence |
|---|---|---|---|---|
| F1 | name guard registered on every family, not only sqs | clean | retired — the guard is dropped (`0.wish.verdict.v1.by_human.md`) | — |
| F2 | guard fills `.name` only when inherited as `'Error'`, never an own choice | clean | retired — the guard is dropped | — |
| F3 | no helpful-errors pin; the guard carries clamp 2 on 1.7.3 | clean | retired — no clamp reads `.name` now, so no pin is owed | — |
| F4 | pre-extant api gateway `keysOfResponseOnwire` guard left as it stands | clean | retired — it rode on the guard's api gateway registration | — |
| F5 | `[case22]` pins a projection of the hydrated error, never its full message | clean | retired — `[case22]` is rewritten for the new behavior | — |
| F6 | the guard catches its own throw and reports it on `console.error` | clean | retired — the guard is dropped | — |
| F7 | a schema refusal on sqs is a caller fault, so it is acknowledged too | clean | ruled — ktlo (robot:director): "keep F7 and F9 as you guessed them" | 90% |
| F8 | a `perBatch` handler throw is forwarded, whatever its class — the batch redrives | clean | ruled — the human: "forBatch, we should forward the throw" | — |
| F9 | a refusal leaves a warn log as its only trace; no explicit dead-letter send | clean | ruled — ktlo (robot:director): "keep F7 and F9 as you guessed them" | 88% |
| F10 | the sqs change ships as a `fix`, not a `break` | clean | ruled — the human: "its gonna be a patch still" | — |
| F11 | the shared refusal log is named `logSqsRecordRefused` — a `log` verb, under the imperative-command exemption | clean | best-guessed | 85% |
| F12 | the cloud half of the sqs disposition is deferred — no deployed queue exists to clamp it (`grepsafe 'sqs\|Sqs\|SQS' --path provision` → 0; control `'Lambda'` → 16 lines) | clean (re-graded) | ruled — the director: "this p0 ships without an iam grant it does not need". the built suite is parked with its dream, until `ktlo-lambda-demo-iam-sqs` lands | — |
| F13 | a perBatch schema that throws a server fault retries that record alone, logged loud — not rethrown | clean | best-guessed | 88% |
| F14 | `logSqsRecordRefused` calls the typed `context.log.warn` directly, unguarded | clean | best-guessed | 90% |
| F15 | a record's retry is the default (`getAllSqsIdsRetried`), never a list `setSqsRecordsValidated` returns | clean | best-guessed | 88% |
| F16 | the caller-fault gate keeps `instanceof Error`, not `isErrorLike` | clean | best-guessed | 93% |
| F17 | the `sqs.record.refused` line is pinned by an exact `toEqual`, never a snapshot | clean | best-guessed | 90% |
| F18 | the refusal line's `origin` field (schema vs handler) is deferred to a dream | dirty | best-guessed | 85% |
| F19 | a perBatch handler's forwarded `ConstraintError` log, and two name-polish asks, are deferred | clean | best-guessed | 85% |
| F20 | five i006 polish asks held to the wish's scope (acceptance snap, foreign `BadRequestError`, when to commit, `event` type, log rename, leaf layout) | clean | best-guessed | 85% |
| F21 | the eight case-list unit tests keep the `describe` + `TEST_CASES.map(test)` shape `rule.prefer.data-driven` prescribes, over a bdd rewrap | clean | best-guessed | 88% |
| F22 | the bundle's `ConstraintError2` suffix is masked in the deployed snapshot; the helpful-errors dedupe (`with-simple-cache` pulls 1.5.3) is deferred to a dream | clean | best-guessed | 85% |
| F23 | a contract snapshot is kept beside an exact `toEqual` of the same value — two lanes ask opposite things | clean | best-guessed | 85% || F24 | no helpful-errors pin; the clamps read the shipped 1.7.3, a `.name`-set positive control beside them — asked of the commander | clean | best-guessed | 80% |
| F25 | snapshots keep a hydrated error's undefined keys; an unchanged code path (the redrive log) gets no new snapshot | clean | best-guessed | 85% |