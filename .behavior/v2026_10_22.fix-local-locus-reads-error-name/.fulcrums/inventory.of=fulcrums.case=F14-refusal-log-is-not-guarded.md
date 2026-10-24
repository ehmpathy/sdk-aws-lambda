# F14 — `logSqsRecordRefused` calls `context.log.warn` unguarded

## the fork

`arch-hazards-maintenance` (5.1, i001, nitpick.1): if the warn throws, the throw escapes the catch, the invoke fails, and sqs redrives a refused message.

| option | for | against |
|---|---|---|
| **call the typed logger directly** (taken) | `ContextLogTrail.log.warn` is a typed member, supplied by `genTrailMiddleware` on every invoke of this family, and every other log call in `src` reads it the same way. a logger that throws is an outage of ours, and its result here is a redrive — the safe direction the invariant names for a miss ("fails toward a retry, never a silent delete") | the refusal is redriven, and its trace is lost, while the logger is broken |
| guard the read (`typeof warn === 'function'`, fall back to `console.warn`) | survives a context with no `warn` | defends against a state the types forbid, at one site of many. it does not cover a `warn` that throws, so the full guard would be a `try/catch` around a log — a failhide of the logger's own fault |

## taken, and why at the time

direct call. the guard covers a case the type system rules out, and its complete form would hide a real fault.

## rework

clean — one function.

## confidence — 90%

## where

`src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.forSqs/logSqsRecordRefused.ts`

## verdict

open.
