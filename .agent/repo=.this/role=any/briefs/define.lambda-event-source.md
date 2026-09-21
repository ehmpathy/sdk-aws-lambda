# define.lambda-event-source

## .what

a lambda endpoint is woken by an **event source**, and each source wraps the payload in its own
envelope before the handler sees it. the source is a domain axis:

| source | envelope | the payload lives at |
|--------|----------|----------------------|
| **ask** | none — the event IS the payload | the event itself |
| **apiGateway** | `{ body, headers, httpMethod, path, requestContext, … }` | `body`, as a json string |
| **sqs** | `{ Records: [{ body, messageId, … }] }` | `Records[].body`, as a json string |
| **sns** | `{ Records: [{ Sns: { Message, … } }] }` | `Records[].Sns.Message` |
| **kinesis** | `{ Records: [{ kinesis: { data, … } }] }` | `Records[].kinesis.data`, base64 |
| **s3** | `{ Records: [{ s3: { bucket, object, … } }] }` | the object ref — there is no payload |

to run an endpoint against a source, a test must **construct that envelope**. the envelope is
aws-shaped, wide, and mostly irrelevant to the handler under test.

## .the name

```ts
asLambdaEvent.fromSqs({ messages })
asLambdaEvent.fromApiGateway({ body, httpMethod })
asLambdaEvent.from$Source(…)          // the template
```

**`as`, because it is a cast, never a construction.** the operation takes a payload and casts it
into an envelope shape. no identity, no persistence, no findsert — so the transformer prefix
applies, never `gen` (`rule.require.get-set-gen-verbs`).

**`from`, because it names provenance.** this is the `as$Noun1From$Noun2` form, dotted: *the lambda
event, as it arrives **from** sqs*. sqs is genuinely the source — it delivered the event.

⚠️ **`for` would have been wrong**, and it is the obvious wrong. *"an event **for** sqs"* names a
target, and the event does not go to sqs; it comes from it. the arrow points the other way.

⚠️ **`$Slug` is taken — use `$Source`.** in `define.lambda-endpoint-ubiqlang`, `slug` is the
endpoint's **serialized key** (`svc-invoice-prep-getInvoice`). `from$Slug` would read as *"from the
endpoint slug"*, which inverts the sense. `rule.forbid.term.addition.ambiguous`.

## .why it is a domain axis, not a fixture detail

the source determines **three** things at once, and all three are contract:

1. **the envelope shape** — what the handler receives
2. **the endpoint kind that can accept it** — `forAskEndpoint` for `ask`; `forApiGateway` for
   `apiGateway`; a consumer handler for the sources that carry records
3. **the response contract** — `forApiGateway` answers `{ statusCode, body }` and returns a **500**
   rather than a throw (`genInternalServiceErrorMiddleware.ts:39-58`), where `forAskEndpoint`
   throws. an sqs consumer answers void or batch-item-failures

⇒ the source is upstream of the outcome axis, so it cannot be a parameter of one.

## 🔴 .the metadata position, and where it breaks

the incumbent factories hardcode every aws-specific field to a single sentinel:

```ts
// eventMetadataWhichShouldNotBeNeeded.ts:10
export const EVENT_METADATA_WHICH_SHOULD_NOT_BE_NEEDED = undefined as any;
```

with a documented argument (`:5-8`):

> *"because it would couple the contract of a lambda too closely with aws-specific +
> event-trigger-specific + lambda-api-specific metadata … contract should be based on request
> **data**, not environment specific **metadata**"*

**that position is coherent, and it predates `forApiGateway`.** it now collides with this sdk:

| what the factory omits | what this sdk does with it | the result |
|---|---|---|
| `requestContext: undefined` | `forApiGateway` normalizes a v1 event and **reads `requestContext.requestId`** while it does so | `TypeError` before any schema runs → handler answers **500** → every assertion past the status check is unreachable |
| no `Accept` header | middy's response serializer is chosen by a match against `Accept` (`/^application\/json$/`) | no serializer matches, the body is handed back as an **object** where api gateway requires a string → every `JSON.parse(result.body)` fails |

⇒ **the fixture manufactures a defect rather than a report of one**, because api gateway sends a
`requestContext` on every real request. a factory that omits it is not wire-faithful — it is
*less* faithful than the wire, in the direction that breaks the handler.

**this is already on record as a bug in this repo: `ehmpathy/sdk-aws-lambda#18`** — the v1 guard
admits an event on `httpMethod` alone, then dereferences a field it never checked.

## .the fork evidence

three repos have already forked a factory locally rather than take the upstream one:

| repo | fork | why |
|---|---|---|
| `ahbode/svc-gateway` | `blackbox/createExampleApiGatewayEvent.ts` | supplies `requestContext` + `Accept`; its doc-note calls itself *"the local half of the repair"* and names `#18` as the upstream half |
| `ahbode/svc-funnel-comms` | `src/__test_utils__/createExampleSQSEvent.ts` | local copy |
| `ahbode/svc-quotes` | `src/__test_utils__/createExampleSQSEvent.ts` | local copy |

⇒ **a fixture that three consumers fork is a fixture whose contract is wrong**, not a fixture they
misused. the successor must fix the contract, never re-publish it.

## .the successor contract

a factory in this sdk is **wire-faithful by default** — it supplies what aws actually sends, and
lets the author override what the test is about.

**the metadata position is honored where it belongs, and inverted where it does not.** the
argument — *a handler contract should rest on request data* — is a claim about what a **handler**
should read. it is not a claim about what a **fixture** should send. a fixture that withholds what
aws sends does not enforce the position; it hides the handlers that violate it behind a `TypeError`.

⇒ so: supply the metadata, and let a handler that reads it be caught by review rather than by an
undefined deref.

## .the pair

`ehmpathy/sdk-aws-lambda#13` — prebuilt zod schemas for aws event sources. **same axis, other
half**: #13 validates an event source's shape, these factories construct it. one source list, two
directions.

## .see also

- `define.lambda-endpoint-run-boundary` — how the constructed event crosses into the endpoint
- `define.lambda-endpoint-ubiqlang` — the endpoint the event wakes, and the `slug` term to avoid
- `ehmpathy/sdk-aws-lambda#18` — the v1 `requestContext` deref this factory works around today
- `ehmpathy/sdk-aws-lambda#13` — the schema half of the event-source axis

