# F15 — a throw from the logger itself surfaces; the refusal does not swallow it

## .the fork

- **A** call `logLambdaEventRefused` bare in the refusal step's `onError`: a throw from
  `context.log.warn` escapes the step, so the invoke fails as a server fault and aws retries it
- **B** wrap the logger call in `try` / `catch` and swallow its throw, so the refusal always
  travels on (the arch-hazards-behavior reviewer's ask, i003 nitpick.1)

## .taken: A

- a logger that throws is a broken sink, a server fault. a retry is the correct answer to a server
  fault: the event comes back once the sink works, so it is not lost
- B drops the only trace of the dropped event AND the only trace of the broken sink at once: the
  event is acknowledged, the warn line never landed, and naught records why. that is the failhide
  `rule.forbid.failhide` forbids (a catch with no allowlist that rethrows naught)

## .rework: clean — a `try` / `catch` around one call, one test; no contract moves

## .risk: low — no credential, no prod write

## .confidence: 85%, why low

a reviewer may weigh a duplicate sns delivery (one retry, then the dead-letter path) above a lost
diagnostic.

## .where

- `src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.forAsk/middleware/genLambdaEventRefusedLogMiddleware.ts`
  (`onError`)

## .verdict

open — best-guessed; the council rules at close.
