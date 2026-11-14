# inventory of fulcrums

risk: **risky** only where a rework touches a credential or a prod write; else **low**. F13 is the
one risky row: its alternatives act with aws credentials in the demo account. every other rework
is a change to sdk source, docs, or tests before release.

| case | title | rework | risk | status | confidence |
|---|---|---|---|---|---|
| F1 | sqs: no new schema; `genLambdaEndpoint.forSqs` already serves it | clean | low | ruled (director, as guessed) | 70% |
| F2 | name: `asLambdaEventSchema.from{Sns,Kinesis}`, not `asAwsLambda{Sns,Kinesis}Event` | clean | low | best-guessed | 80% |
| F3 | the inner message is decoded in place, not validated-and-left-a-string | clean before release, dirty after | low | answered (yield q4) | 88% |
| F4 | unknown aws keys pass through; known keys are validated | clean | low | best-guessed | 88% |
| F5 | kinesis rides `forAsk`, so one refused record refuses the whole batch; no `forKinesis` in this wish | clean (a family is additive) | low | ruled (director, as guessed, with the doc caution) | 65% |
| F6 | the inner-schema key is `payload` | clean | low | best-guessed | 85% |
| F7 | `payload` meets the json-parsed message by default; `deserialize: { payload: false }` hands it the utf8 string (as `forSqs`) | clean | low | best-guessed | 85% |
| F8 | public return type is declared, with one documented cast at the seam | clean | low | best-guessed | 90% |
| F9 | `forAsk` logs a warn line when an event-source schema refuses; other `forAsk` callers keep their log level | clean | low | ruled (director, narrowed to event-source schemas) | 70% |
| F10 | require the fields every source agrees on; the contested cert-url key is optional | clean | low | best-guessed | 80% |
| F11 | the envelope (sdk's zod) pipes into the consumer's `payload` schema; one zod in the tree is a stated precondition, as for `forAsk` | clean | low | best-guessed | 80% |
| F12 | `forAsk` carries aws-delivered sns/kinesis for this wish, despite the wrapper-read invariant; families are dreamt | clean | low | ruled (director, as guessed) | 70% |
| F13 | release on the aws docs samples; the real-delivery capture stays a dream | clean | risky | ruled A (director: docs samples are the sanctioned floor) | 60% |
| F14 | practice-owned `.husky/` hooks are fixed upstream, never edited here | clean | low | best-guessed | 85% |
| F15 | a throw from the logger itself surfaces as a server fault; the refusal catch does not swallow it | clean | low | best-guessed | 85% |
| F16 | the refusal line decides on the schema's source mark (as F9 was ruled), not on the event's shape | clean | low | best-guessed | 70% |
| F17 | the sns refusal line carries the `MessageId`, not the message body | clean | low | best-guessed | 70% |
| F18 | the refusal's `message` keeps its metadata blob beside `details`; the extant wire format of every family, out of this wish | clean (wide) | low | best-guessed | 85% |
| F19 | the kinesis schema accepts an empty batch (tumble windows), the sns schema refuses one; reverses an earlier round's criterion | clean | low | best-guessed | 75% |
| F20 | the kinesis refusal line's `consequence` text corrected (true under tumble windows), an edited pinned expectation | clean | low | best-guessed | 85% |
