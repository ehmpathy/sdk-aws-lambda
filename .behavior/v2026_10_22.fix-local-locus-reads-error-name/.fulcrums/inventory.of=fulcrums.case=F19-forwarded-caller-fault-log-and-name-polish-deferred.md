# F19 — a perBatch handler's forwarded ConstraintError log, and two name-polish asks, are deferred

## the fork

`enroll-impl-arch-defects` (5.1, i005) raised three nitpicks this route holds out of scope:

| nitpick | ask | why deferred |
|---|---|---|
| 1 | log a `perBatch` handler's forwarded `ConstraintError`; the sqs chain passes it by unlogged | `forAsk` also sets `asOutputAfter: false`, so that flag cannot mean "no one answers a caller fault". the cure is a new field on a middleware three families share. true on main too; the invoke still fails and aws logs it |
| 3 | rename `setSqsRecordsValidated`, one letter from `setSqsRecordValidated` | a rename across leaves, tests, and briefs, for autocomplete ease, in a route whose wish is the wire label |
| 4 | one `asErrorClassName` leaf for the two `constructor.name` reads | two one-line reads; the leaf pays off only once the field is hardened |

## taken, and why at the time

defer all three. the director asked, at p0, that this route stop its growth past the wish. each is safe, none is needed for the wish, and nitpick 1 is not clean (a shared middleware contract).

## rework

clean — each lands later with no caller hardened against the present shape.

## confidence — 85%

a council that weighs the unlogged forward above scope could pull nitpick 1 in.

## where

- nitpick 1: `.dream/2026_10_22.sqs-forwarded-caller-fault-logs-loud.dream.md`; the false table comment in `genSqsEndpointMiddlewares.ts` is corrected in this round
- nitpicks 3, 4: this entry

## verdict

open.
