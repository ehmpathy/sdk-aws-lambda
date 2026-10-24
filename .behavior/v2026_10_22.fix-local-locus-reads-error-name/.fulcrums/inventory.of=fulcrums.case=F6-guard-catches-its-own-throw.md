# F6 — the guard catches its own throw and reports it on `console.error`

## .the fork

- **A, taken**: wrap `onError`'s body in `try`; on a guard throw, report `error.name.guard.malfunction` on `console.error` and let the handler's fault flow on
- **B**: no catch; let a guard throw propagate (failfast)

## .taken, and why at the time

the guard runs FIRST of every `onError`, and middy aborts the chain when a hook throws. under B a guard throw replaces the handler's fault before `genInternalServiceErrorMiddleware` or the local locus read it, so the caller sees an error about the guard rather than its own fault — the misclassification class this PR closes (arch-hazards-behavior i003 nitpick.1). the catch never reassigns `request.error` and reports loud, so it keeps the guard's fault off the caller's error path but not out of the operator's sight. `Reflect.defineProperty` already removes the ordinary throw (a frozen or sealed target, or a proxy that declines); the catch covers only an exotic trap or a log sink that throws.

## .rework — clean

one file; remove the `try` and the `[case6][t1]`/`[t2]` clamps.

## .confidence — 88%, and why it is low

it is a catch with no allowlist, the shape `rule.forbid.failhide` warns on. the defense — the caught fault is the guard's, and the real fault still flows — is sound to me, but a reviewer may prefer the context `log.error` as the sink over `console.error`.

## .where

`src/domain.operations/genLambdaEndpoint/middleware/genErrorNameMiddleware.ts`

## .verdict

open — for the council.
