# F10 — which envelope fields the schema requires

## .the measured conflict

- aws docs, sample sns event (`docs.aws.amazon.com/lambda/latest/dg/with-sns.html`, § sample sns
  event shape): `"SigningCertURL"`
- `@types/aws-lambda@8.10.161` `trigger/sns.d.ts`: `SigningCertUrl`, with the comment *"Not
  SigningCertURL; see DefinitelyTyped#73817"*
- this repo's factory `asLambdaEvent.fromSns`: `SigningCertUrl`

(the key names are aws's, quoted verbatim.) a schema that requires either form refuses events of the
other source.

## .the fork

- **A** require every field the aws-lambda type declares, exact key — the docs sample is refused
- **B** require the fields every source agrees on and the handler-relevant ones (`Message`,
  `MessageId`, `TopicArn`, `Type`, `Timestamp`, `MessageAttributes`, `EventSource`, …); mark the
  contested ones optional; the output type still declares them as the aws-lambda type does
- **C** validate only `Records[].Sns.Message` (or `kinesis.data`) and pass all else through

## .taken: B

a schema exists to refuse wrong events, not to refuse aws. the contested field is metadata no handler
should read (`define.lambda-event-source`, metadata position). C guards too little: an sqs event
misrouted to an sns handler would pass on a `Records` array alone, if `Sns` were optional.

## .rework: clean

## .confidence: 80%, why low

the real wire key is asserted by DefinitelyTyped, not measured by us. a real sns delivery captured in
prep would settle it.

## .verdict

best-guessed.
