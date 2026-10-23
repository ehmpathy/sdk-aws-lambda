# invariant.constraint-errors-never-redrive-sqs

## .what

a `ConstraintError` on an sqs message never triggers a retry of its own and never lands in the dead-letter queue by its own verdict — per message (a `perBatch` handler throw redrives its whole batch; see `.the bound`). the message is the fault, so the lambda acknowledges it: it logs the refusal, and sqs deletes the message.

| fault | `perRecord` | `perBatch` | sqs does |
|---|---|---|---|
| caller fault, one message — a schema refusal, or a `ConstraintError` / `BadRequestError` a `perRecord` handler throws | invoke succeeds | the refused id left out of `batchItemFailures` | deletes the message |
| a `perBatch` handler throw, any class — no per-record verdict | — | invoke fails, no response body | redrives the batch |
| a schema whose own callback throws a server fault | invoke fails | that id in `batchItemFailures` | redrives that message, then dead-letters |
| a `perRecord` handler throw of any other class | invoke fails | — | redrives, then dead-letters |

⚠️ the two mechanisms read differently to an operator: a failed invoke shows on the lambda error metric; an id in `batchItemFailures` does not, so its only signal is the `sqs.record.invalid` error line.

## .why

- **a retry cannot fix a bad message.** the same bytes fail the same way on every receive. a redrive spends `maxReceiveCount` invokes on it, and the dead-letter entry it leaves reads as an outage of ours
- **the dead-letter queue is for our faults.** it is where an operator looks for messages this service failed to serve. a refused message there is noise that buries a real one, and it fires the alarms that watch the queue
- **parity with the predecessor.** `simple-lambda-handlers`' `badRequestErrorMiddleware` caught a `BadRequestError` by class and returned, so the invoke succeeded and "this invocation will not be retried by any retry mechanisms (e.g., sqs, kinesis, etc)". this sdk's sqs family once rethrew every fault, a caller fault included — a regression (sdk-aws-lambda#73)
- **it is the sqs face of `invariant.badrequesterror-not-lambda-error`.** that invariant already reads "retry: no" for a caller fault. the reply-awaited families meet it with a returned body; sqs has no caller to answer, so it meets it with an acknowledged message

## .the trace an acknowledged message leaves

an acknowledged message is deleted, so the log line is its only record. `logSqsRecordRefused` writes `sqs.record.refused` at warn, with the message `id`, the error class, and its message — enough to find the producer at fault. warn, not error: the lambda served the message as designed.

## .detection — in-process, never off the wire

the decision is made in the lambda's own process, via `getIsConstraintError`: `instanceof`, then the error's own `.name`, then the constructor names up its prototype chain. it reads no wire label (`errorType`), so it holds for a subclass, for an error with no `.name`, and in a minified bundle with one copy of helpful-errors. its `.name` arm means a real `Error` that names itself `ConstraintError` — a `DOMException` among them — counts as a caller fault too (`asCallerFault.test.ts` pins it). two shapes it refuses: a value that is not an `Error` at all, and the invoke freeze's own `ConstraintError`, which is a handler defect (`getIsFrozenMutatorRefusal`). a class the check cannot see — a minified bundle with two copies of helpful-errors, or a `ConstraintError` wrapped in a server-fault class — reads as a server fault and redrives: the miss fails toward a retry, never toward a silent delete.

## .the bound

- **a schema refusal is a caller fault.** the producer sent a message that does not match `schema.input`
- **the invariant binds per message.** a `perBatch` handler that throws — a `ConstraintError` included — is forwarded, and the batch redrives. the throw does not say which records succeeded and which failed, so to acknowledge all would delete records whose outcome is unknown. a handler that refuses one record acknowledges it by name in `successes`, and the rest redrive
- **an acknowledgement rides the invoke.** a `perBatch` schema refusal is deleted only once the invoke succeeds. a handler throw fails the invoke, so the refused record redrives with its batch and is refused again on the next receive. the sdk may not catch that throw (above), so the handler owns the cure: never throw on a batch the schema emptied (`records: []`). the refusal line's consequence reads "once this invoke succeeds" for this case (perBatch `[case7][t2]`)
- **the class is the verdict, whatever it names.** a `perRecord` handler's own `ConstraintError` — one it caught from a downstream call, a 429 among them — reads exactly as a refusal of the message, and the message is deleted. a handler that must retry a transient downstream fault throws a server-fault class (`MalfunctionError`), never a `ConstraintError`
- **a deploy misconfiguration is not a caller fault.** `perRecord`'s batch-size refusal is a `MalfunctionError`, and it redrives

## .test coverage

each variant clamps both arms:

| case | expected |
|---|---|
| a message the schema refuses | acknowledged; `sqs.record.refused` logged |
| a handler that throws `ConstraintError` (`perRecord`) | acknowledged; `sqs.record.refused` logged |
| a handler that throws `ConstraintError` (`perBatch`) | forwarded — the invoke fails, and the batch redrives |
| a handler that throws a server fault | redriven |

## .enforcement

- a caller fault on one sqs message that fails the invoke, or lands in `batchItemFailures` = **blocker**
- a `perBatch` handler throw caught and answered as a success for the batch = **blocker** (records of unknown outcome deleted)
- a caller fault acknowledged with no `sqs.record.refused` line = **blocker** (a message vanished with no trace)
- caller-fault detection via the wire label (`errorType`, read off a serialized payload) rather than in-process = **blocker**. the in-process `.name` arm of `getIsConstraintError` is not a wire read

## .see also

- `invariant.badrequesterror-not-lambda-error` — the parent: a caller fault is not a lambda error
- `rule.forbid.failhide` (mechanic) — the catch allowlists one class and records it; every other fault rethrows
