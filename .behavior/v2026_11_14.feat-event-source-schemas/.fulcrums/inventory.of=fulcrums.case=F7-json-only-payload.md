# F7 — `payload` meets the json-parsed message by default, with a `deserialize` opt-out

## .the fork

- **A** always json-parse before `payload` (kinesis: base64 → utf8 → json)
- **B** json-parse by default; `deserialize: { payload: false }` hands `payload` the utf8 string,
  the same key and sense `forSqs` already ships

## .taken: B

the one evidenced kinesis consumer does not send json.
`ahbode/svc-notifications:src/contract/handlers/consumeShortUrlCloudfrontLogFromKinesis.ts:34-37`
decodes `kinesis.data` from base64 to a utf-8 string, then hands that string to its own parser,
because a cloudfront real-time log is a text line. under A, `fromKinesis({ payload })` could not
serve it. it would fall back to envelope-only and keep its hand-rolled `Buffer.from(…, 'base64')`.

under B:

```ts
asLambdaEventSchema.fromKinesis({ payload: z.string(), deserialize: { payload: false } })
// data: base64 → utf8 → z.string(); the handler reads the log line, no Buffer call
```

base64 is how the envelope carries bytes, not the message's format, so the schema always decodes it.
only the json step is optional. `forSqs.perRecord`'s `deserialize.payload` is the precedent: same
key, same default, same rule (`false` ⇒ a string schema).

the sns consumer (`consumeSESEmailEventFromSNS.ts:33`) sends json, so the default fits it.

## .rework: clean

## .confidence: 85%

## .verdict

best-guessed — revised from A after the consumer read (self-review `has-questioned-requirements`).
