# F15 — a record's retry is the default, never a list `setSqsRecordsValidated` returns

## the fork

`arch-opport-decomposition` (5.1, i003, nitpick.3): `setSqsRecordsValidated` makes three dispositions but returns two lists; a server fault met at validation is retried by its absence from both.

| option | for | against |
|---|---|---|
| **retry by default** (taken) — `getAllSqsIdsRetried` retries every delivered record neither claimed nor refused | one rule covers all three sources of a retry: a server fault at validation, a record the handler forgot, a handler that answered `[]`. fail safe by construction — no path can drop a record from the retry set by omission | a reader of `setSqsRecordsValidated` alone does not see the third disposition as a list |
| return `idsRetried` from `setSqsRecordsValidated` | the validation step states all three outcomes | it names one source of three, so `getAllSqsIdsRetried` must still compute the other two — a second source of one fact, and a list a future change could forget to fill |

## taken, and why at the time

retry by default. the rule has one named home, and its `.note` states that a validation server fault needs no list.

## rework

clean — two leaves and one call site.

## confidence — 88%

the call is sound for this sdk's fail-safe aim; a reviewer who reads per-step explicitness above one-rule defaults could weigh it the other way.

## where

`src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.forSqs/getAllSqsIdsRetried.ts`, `setSqsRecordsValidated.ts`

## verdict

open.
