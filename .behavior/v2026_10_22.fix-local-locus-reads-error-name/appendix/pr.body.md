fixes #73

## .what

- the local locus labels an escaped throw as the aws node runtime does: `errorType: error.name` for a value that passes the runtime's `_isError` (an object with string `name`, `message`, `stack`), else `typeof error`. it read `constructor.name`, so a local run named a `ConstraintError` a caller fault while the cloud named it `Error`, a server fault — a green pr gate over a red prep (svc-quotes run 38852404042)
- `genErrorNameMiddleware`, registered last (so its `onError` runs first) in `forAsk`, `forApiGateway` and `forSqs`, names a throw whose `.name` is only the inherited `'Error'` from its class. so a helpful-errors 1.7.3 `ConstraintError` reaches the wire as a caller fault today

## .caveats

- **no helpful-errors pin.** the guard carries the caller-fault clamp on 1.7.3; helpful-errors#45 makes it a no-op once it sets `.name` itself
- **a subclass is named after itself.** `class QuoteStaleError extends ConstraintError {}` reaches the wire as `'QuoteStaleError'`, read as a server fault — as the runtime reads it once helpful-errors sets `.name`. to be read as a caller fault, declare `public override name = 'ConstraintError'`
- **an own `.name` always wins**, whatever its value
- **a frozen or sealed error** cannot take the name: it warns `error.name.unset` and reads as a server fault where it escapes
- **the guard is total**: its own throw is reported on `console.error` as `error.name.guard.malfunction`, and the handler's fault flows on untouched
- **`[case22]` snapshot rows** in `runLambdaEndpoint.onSerialized.integration.test.ts.snap` were written from a read of `getParsedResponse` (local integration was keyrack-gated); this pr's CI run is their first measurement
- **one field still differs by locus**: the runtime emits the stack as `trace`, the local locus as `stackTrace`. it shapes diagnosis, never classification — caught as a dream (`.dream/2026_10_22.fix-local-locus-stack-field-trace-vs-stacktrace.dream.md`)

## .fulcrums

| case | call | rework |
|---|---|---|
| F1 | name guard on every family, not only sqs | clean |
| F2 | fill `.name` only when inherited as `'Error'`, never an own choice | clean |
| F3 | no helpful-errors pin | clean |
| F4 | pre-extant api gateway `keysOfResponseOnwire` guard left as it stands | clean |
| F5 | `[case22]` pins a projection of the hydrated error, never its full message | clean |
| F6 | the guard catches its own throw and reports it on `console.error` | clean |

## .tests

types · lint · format · unit (107 suites, 1631 passed) green locally. integration + acceptance run in CI.
