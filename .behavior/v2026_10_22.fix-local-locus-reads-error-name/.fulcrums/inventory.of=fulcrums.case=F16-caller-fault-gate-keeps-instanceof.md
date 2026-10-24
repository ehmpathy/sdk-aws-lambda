# F16 — the caller-fault gate keeps `instanceof Error`, not `isErrorLike`

## the fork

`arch-hazards-maintenance` (5.1, i003, nitpick.1): `asCallerFault` gates on `instanceof Error`, which `isErrorLike` exists to replace across realms.

| option | for | against |
|---|---|---|
| **keep `instanceof Error`** (taken) | `getIsConstraintError` opens with `if (!(error instanceof Error)) return false;` (`middleware/getIsConstraintError.ts:17`), so a cross-realm value fails inside it either way; the gate in `asCallerFault` only narrows the type to `Error` for the return — the gate adds no restriction. a deployed lambda holds one realm. a miss fails toward a retry, never a delete | a jest run with two realms redrives where the cloud would delete |
| gate on `isErrorLike` | the repo's canonical narrow | passes a value on to a class check that still answers false, so it changes no outcome; and in `setSqsRecordsValidated` it would treat a `{ message }` bag as one record's server fault rather than fail the batch |

## taken, and why at the time

keep. a swap changes no verdict, and it would move the non-Error arm from "fail the batch" to "retry one record".

## rework

clean — one predicate.

## confidence — 93%

the premise is read, not recalled: `getIsConstraintError.ts:17`. what keeps it short of certain is a cross-realm caller fault a future host might load; the realm-safe fix then belongs inside `getIsConstraintError`, where every family would gain it, not at this gate.

## where

`src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.forSqs/asCallerFault.ts`, `setSqsRecordsValidated.ts`

## verdict

open.
