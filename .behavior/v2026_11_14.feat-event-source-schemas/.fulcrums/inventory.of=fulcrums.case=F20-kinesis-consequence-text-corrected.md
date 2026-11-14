# F20 — the kinesis refusal line's `consequence` text was corrected on this branch

## .the fork

- **A** (shipped) `consequence` reads "the whole batch is answered as a success, so lambda does not
  retry it; this line is the only trace", and `logLambdaEventRefused.test.ts` [case4] pins it
- **B** (the text this branch first pinned; re-raised at 5.3 by enroll-verif-test-intent as an
  edited expectation) "the whole batch is acknowledged; the shard advances past every record in
  it"

## .taken: A

- B states a fate that is false under tumble windows: there an answer with no `state` fails the
  invoke, so the shard is suspended, not advanced. a log line that tells an operator the shard
  moved on, when it halted, sends them the wrong way at the worst moment
- A states only what holds in every kinesis config: the invoke answers a success, lambda does not
  retry it, and the line is the only trace
- the test's intent holds: it pins the exact text the operator reads; only the text changed, with
  the prod text it pins

## .for B, fairly

B was the first criterion this branch tested, and the change edits a pinned expectation. the
default (non-tumble) config, by far the common one, does advance the shard, so B is true for most
consumers and more specific about what happens next.

## .rework: clean — one string in `logLambdaEventRefused.ts`, one in its test, one snapshot line

## .risk: low — no credential, no prod write

## .confidence: 85%, why not higher

the change is a correction, but it edits a pinned test value on this branch's own word; the
director may want the specific text back with a tumble-window caveat.

## .where

- `src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.forAsk/middleware/logLambdaEventRefused.ts`
- `logLambdaEventRefused.test.ts` [case4]

## .verdict

open — best-guessed; the council rules at close.
