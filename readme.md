# sdk-aws-lambda

a simple and opinionated sdk for aws lambda. define endpoints, ask endpoints, trace calls across them.

# installation

```sh
npm install --save sdk-aws-lambda
```

# usage

## define an endpoint

one family, one leaf per trigger:

| leaf | trigger |
|---|---|
| `genLambdaEndpoint.forAsk` | a direct invoke, e.g. via `askLambdaEndpoint` |
| `genLambdaEndpoint.forApiGateway` | http, via api gateway |
| `genLambdaEndpoint.forSqs.perRecord` | one queue message per invoke |
| `genLambdaEndpoint.forSqs.perBatch` | a whole queue batch per invoke |

### genLambdaEndpoint.forAsk

a direct invoke, e.g. from `askLambdaEndpoint`.

```ts
import { genLambdaEndpoint } from 'sdk-aws-lambda';

export const handler = genLambdaEndpoint.forAsk(
  {
    schema,
    invoke: async ({ payload }, { log }) => {
      // payload is the validated body; log has trail context from caller
    },
  },
  { log }, // optional, auto-generated otherwise
);
```

### genLambdaEndpoint.forApiGateway

http, via api gateway.

```ts
import { genLambdaEndpoint, asApiGatewayResponseSchema } from 'sdk-aws-lambda';

export const handler = genLambdaEndpoint.forApiGateway({
  schema: {
    input: z.object({
      headers: z.object({ authorization: z.string() }), // optional key — omit to validate no header
      payload: z.object({ to: z.string() }),
    }),
    output: asApiGatewayResponseSchema({ body: z.object({ sent: z.boolean() }) }),
  },
  invoke: async ({ headers, payload }, context) => ({
    body: await sendMessage({ to: payload.to, authorization: headers.authorization }, context),
  }),
});
```

`headers` keys are lowercased. `event` carries six keys:

| key | holds |
|---|---|
| `method` | the http method |
| `headers` | the request headers |
| `payload` | the body |
| `codec` | `{ base64 }` — how the body arrived |
| `params` | `{ path, query }` — the url parameter bags |
| `_` | `{ raw }` — the wire event before reconciliation |

⇒ zoom in: [headers](./.agent/repo=.this/role=any/briefs/domain.terms/headers.md) ·
[event](./.agent/repo=.this/role=any/briefs/domain.terms/event.md)

#### the wire response

a handler owns its **exact wire response** — any status, any headers, any body, or none at all.
return an `ApiGatewayResponse`, and it reaches the wire as written.

```ts
export const handler = genLambdaEndpoint.forApiGateway({
  schema: {
    input: z.any(),                                       // a twilio form blob
    output: asApiGatewayResponseSchema({ body: z.undefined() }), // carries no body
  },
  invoke: async () => ({ status: 204 }),                  // 204, no body
});
```

| return | wire |
|---|---|
| `{ body: x }` | 200 + json — the convenient default |
| `{ status: 204 }` | 204, no body, **no `content-type`** |
| `{ status: 308, headers: { Location } }` | a redirect |
| `{ headers: { 'Content-Type': 'text/xml' }, body: xml }` | your bytes, verbatim |
| `{}` | ⛔ a **compile error** — at least one key is required |

set a `Content-Type` yourself and the serializer stands aside, so xml/text reach the wire
byte-identical. omit it with a body and you get `application/json`.

#### the body-less response

`schema.output` describes what `invoke` **returns** (the envelope), so
`asApiGatewayResponseSchema({ body })` wraps a body schema into it.

for a response that carries **no body at all** — a 204, a redirect — declare the body
`z.undefined()`:

<!-- prettier-ignore -->
| you declare | the published `body` slot | reads as |
|---|---|---|
| `z.undefined()` · `z.void()` · `z.never()` | `{ "not": {} }` | **"no body is ever carried"** |
| `z.any()` · `z.unknown()` | `{}` | ⛔ the rubber-stamp — every value reads as valid |
| `z.null()` | `{ "type": "null" }` | ⛔ claims the wire carries the four bytes `null` |

all of them behave identically at **runtime**: each accepts `{ status: 204 }` and each still refuses
an accidental `{ body: 'oops' }`. only the published contract differs, which is why the wrong choice
ships green.

### genLambdaEndpoint.forSqs

a queue, one leaf per cardinality.

```ts
// one message per invoke — requires batchSize: 1
export const handler = genLambdaEndpoint.forSqs.perRecord({
  schema: {
    input: z.object({
      headers: z.object({ source: z.string().optional() }), // message attributes
      payload: z.object({ orderId: z.string() }),
    }),
  },
  invoke: async ({ payload, headers }, context) =>
    fulfilOrder({ orderId: payload.orderId, source: headers.source ?? null }, context),
});

// a whole batch per invoke — name the records that succeeded
export const handler = genLambdaEndpoint.forSqs.perBatch({
  schema: { input: z.object({ payload: z.object({ orderId: z.string() }) }) },
  invoke: async ({ records }, context) => {
    const succeeded = [];
    for (const record of records) {
      await fulfilOrder({ orderId: record.payload.orderId, source: null }, context).then(
        () => succeeded.push(record),
        () => null, // unreported, so sqs retries it
      );
    }
    return { successes: succeeded };
  },
});
```

`perBatch` fails safe: any record neither returned in `successes` nor refused by the schema is
retried, and an answer the sdk cannot read retries the whole batch. its event source must declare
`functionResponseTypes: ['ReportBatchItemFailures']`.

a caller fault is never retried. a message the schema refuses, or one a `perRecord` handler refuses
with a `ConstraintError` (or `BadRequestError`), is logged once as `sqs.record.refused` and
acknowledged, so sqs deletes it, with no dead-letter entry. the same bytes fail the same way on every
receive, so a retry could only page you for the producer's fault. the class is the verdict: a
downstream `ConstraintError` your handler lets escape (a 429, say) deletes the message too, so to
retry a transient fault, throw a `MalfunctionError`. any other throw still redrives. a
`perBatch` handler throw names no record, so it redrives the whole batch, whatever its class. in a
`perBatch` handler, `successes` is the lever: sqs deletes every record you return there and retries
every record you leave out — so to drop a record you will never serve, return it. the sdk logs no
line for a record you drop that way, so log it yourself if an operator needs the trace.

a `perBatch` refusal is deleted only once the invoke succeeds. if your handler throws, the whole
batch redrives, the refused records among them, and each is refused again on the next receive. so a
`perBatch` handler must not throw on a batch the schema emptied: when every record is refused, it is
called with `records: []`.

the refusal line keeps the `id`, the error class, and its message, never the message body — replay
the producer from its own system. a schema refusal used to log as `sqs.record.invalid` and dead-letter;
it now logs `sqs.record.refused` and is deleted, so an alarm on a total producer outage belongs on
`sqs.record.refused`. `sqs.record.invalid` now marks only a schema callback that threw a fault of ours.

a deleted refusal leaves no dead-letter copy, so a schema bug of ours — a tightened schema, a
`deserialize` mis-pair — deletes the queue's in-flight messages rather than park them for redrive.
alarm on the volume of `sqs.record.refused`, not only on the dead-letter queue.

to assert a refusal in a test: the invoke succeeds with no answer (`null` at `onSerialized`), so assert
the handler did not run, and spy `console.warn` for the `sqs.record.refused` line.

⇒ zoom in: [records](./.agent/repo=.this/role=any/briefs/domain.terms/records.md)

## ask an endpoint

```ts
import { askLambdaEndpoint } from 'sdk-aws-lambda';

const result = await askLambdaEndpoint<TRequest, TResponse>(
  { which: { service: 'svc-jobs', function: 'getJobByUuid' }, event: { uuid } },
  { log, env: { access: 'prep' } },
);
```

the caller's `trail.exid` rides along, so logs correlate across the call.

### ask an api gateway endpoint, over http

```ts
import { askLambdaEndpoint } from 'sdk-aws-lambda';

const { status, body } = await askLambdaEndpoint.viaApiGateway<TResponse>(
  { url: 'https://api.example.com/jobs', method: 'POST', body: { uuid } },
  { log },
);
```

takes the standard http request: `{ url, method, headers, body }`. an object `body` is sent as json.

it resolves `{ status, headers, text, body }`. a 4xx throws a `ConstraintError`; a 5xx throws a
`MalfunctionError` that carries the `correlationId`. your trail rides the request, so the endpoint's
logs join yours.

any other http caller spreads the `x-trail-exid` header in to send the trail. the header also opts the
caller in to the contemp error body (`{ error: { class, … } }`); without it the endpoint answers the flat
`{ errorMessage, errorType }`:

```ts
import { asTrailExidHeaders } from 'sdk-aws-lambda';

await fetch(url, { headers: { ...asTrailExidHeaders({ trail: { exid } }) } });
```

## run an endpoint, in a test

| you call | you hold | a caller fault arrives as |
|---|---|---|
| `onReferenced` | the handler **function** | a **returned** envelope |
| `onSerialized` | the endpoint **slug** | a **thrown** error |

```ts
import {
  asLambdaEndpointErrorEnvelopeContemp,
  asLambdaEndpointOutput,
  runLambdaEndpoint,
} from 'sdk-aws-lambda';

// you hold the handler, so you see what it returned
const out = await runLambdaEndpoint.onReferenced({ event: { uuid }, handler });
expect(asLambdaEndpointOutput(out).found).toEqual(true);

// a caller fault RETURNS here — the lambda succeeded, it just rejected the request
const res = await runLambdaEndpoint.onReferenced({ event: { uuid: 'bad' }, handler });
expect(asLambdaEndpointErrorEnvelopeContemp(res).error.class).toEqual('ConstraintError');

// you hold the slug, so you are a caller — and the same fault THROWS
await expect(
  runLambdaEndpoint.onSerialized(
    {
      which: { service: 'svc-jobs', function: 'getJobByUuid' },
      event: { uuid: 'bad' },
      at: 'cloud', // or 'local' — look up the handler in serverless.yml
    },
    { log, env: { access: 'prep' } },
  ),
).rejects.toThrow(ConstraintError);
```

a malfunction throws on both. the util adds no `catch`.

a `genLambdaEndpoint.forAsk` or `.forApiGateway` endpoint answers a `ConstraintError` by class, as a
response body, so its caller reads a caller fault on both loci. a throw no family answers — from a raw
handler — reaches the wire labelled by its `.name`, never its class, exactly as the aws runtime labels
it. so on `onSerialized` at `'local'`, a raw handler's error class with no `.name` of its own
(helpful-errors 1.7.3's `ConstraintError` reads `'Error'`) arrives as a server fault, as it does on
the cloud. a local test that asserted it as a caller fault goes red on upgrade; the cloud was already
red. the cure is an error class that sets its own `.name` (helpful-errors#47). the label itself moves
for every family: a server fault's `error.metadata.errorType` reads `.name`, so any helpful-errors
1.7.3 class (a `MalfunctionError` included) reads `'Error'` there on a local run, as on the cloud.

the return is a union — `TOutput | Envelope` — so read either arm through a narrow:

```ts
asLambdaEndpointOutput(res).scheduledAt;               // the handler's own output
asLambdaEndpointErrorEnvelopeContemp(res).error.class; // the envelope
```

each throws loud when the endpoint answered with the other shape, so neither needs an `as` cast.

### legacy handlers

`handler` is a plain `(event, context) => Promise<T>`, so an unmigrated handler works today — it
just needs its dialect declared:

```ts
await runLambdaEndpoint.onReferenced({
  event,
  handler: createStandardHandler({ logic }),
  struct: { payload: 'ancient' }, // required — see below
});
```

`struct.payload` frames what your handler **receives**, not only what it answers:

| dialect | your handler receives | your handler answers |
|---|---|---|
| `contemp` (default) | `{ event, trail }` — for an event built with `asLambdaEvent.fromApiGateway`, the event itself with an `x-trail-exid` header | the nested `{ error: { class, … } }` |
| `ancient` | the event, untouched | the flat `{ errorMessage, errorType }` |

a `genLambdaEndpoint` handler never notices — its middleware unwraps the frame first. a plain
handler does: under the contemp default it reads its own fields off a wrapper and finds them absent.

an api gateway endpoint is the exception: aws delivers its event unwrapped, so `runLambdaEndpoint`
carries the contemp opt-in in the event's `x-trail-exid` header instead of a wrapper. the endpoint a
`genLambdaEndpoint` builder returned declares which carrier it reads, so any event you hand it is
framed right: a built event, a spread copy, a hand-built or captured request.

the one road that holds no endpoint is `runLambdaEndpoint.onSerialized({ at: 'cloud' })`: it reads a
mark `asLambdaEvent.fromApiGateway` leaves on the event, so send the event as built. a copy (spread,
`structuredClone`, a json round trip) loses the mark and fails loud with the fix: pass the change to
`asLambdaEvent.fromApiGateway` (`headers`, `requestContext`, `path`, …) rather than a copy. a raw event
captured from aws goes through `struct: { payload: 'ancient' }` and arrives as sent, with any
`x-trail-exid` header it holds.

a `forApiGateway` endpoint adds `x-trail-exid` to its cors `allow-headers`, since a browser caller
that sends it triggers a preflight.

## build an event for a source

`asLambdaEvent` casts a payload into the envelope aws actually delivers, wire-faithful by default:

```ts
import { asLambdaEvent } from 'sdk-aws-lambda';

const event = asLambdaEvent.fromApiGateway({ body: { slug }, httpMethod: 'POST' });
const event = asLambdaEvent.fromSqs({ messages: [JSON.stringify(task)] });
//            asLambdaEvent.from$Source(...)   // sns, kinesis, s3 too

// override only what your test is about — the rest stay wire-faithful
const event = asLambdaEvent.fromApiGateway({
  body,
  requestContext: { identity: { sourceIp: '10.0.0.1' } },
});
```

## introspection

in `prep`, an endpoint returns its json-schema when asked with `{ introspect: 'schema' }`; in prod
it throws a `ConstraintError`. `getOneLambdaContract` and `getAllLambdaContracts` collect them for
sdk generation:

```ts
import { getAllLambdaContracts } from 'sdk-aws-lambda';

const contracts = await getAllLambdaContracts(
  { which: { service: 'svc-user' } },
  { env: { access: 'prep', region: 'us-east-1' } },
);
// { getUser: {...schema}, getSettings: {...schema} }
```

## validate the input only

`schema.output` is required. for an endpoint that returns no value, declare `z.void()`:

```ts
export const handler = genLambdaEndpoint.forAsk(
  {
    schema: { input: inputSchema, output: z.void() },
    invoke: async ({ payload }, context) => { await doTheWork({ job: payload }, context); },
  },
  { env: { access: 'prep' } },
);
```

`z.void()`, `z.undefined()`, `z.null()` and `z.never()` each publish an honest contract. avoid
`z.any()` and `z.unknown()` — they publish `{}`, which tells a caller that **any** value is valid.

## domain objects at the border

declare a domain object in the schema and `invoke` receives the **instance**, not the plain object
zod yields. no `as` cast, no per-field rebuild:

```ts
import { Surfer } from './domain.objects/Surfer';

export const handler = genLambdaEndpoint.forAsk(
  {
    schema: { input: z.object({ surfer: Surfer.contract() }), output: z.void() },
    invoke: async ({ payload }, context) =>
      bookSurfLesson({ surfer: payload.surfer }, context), // payload.surfer instanceof Surfer
  },
  { env: { access: 'prep' } },
);
```

`X.contract()` reaches every depth — not the top level alone:

```ts
schema: {
  input: z.object({
    surfer: Surfer.contract(),                       // depth 0
    signup: z.object({                               // a PLAIN wrapper...
      spot: SurfSpot.contract(),                     //   ...and the dobj one level under it
    }).nullable(),
    boards: z.array(Surfboard.contract()),           // every element of the array
    report: WaveReport.contract(),                   // its `static nested` rebuilds `report.spot`
  }),
  output: z.void(),
},
```

a value that fails the domain object's own constructor **fails loud at the border** and never reaches
`invoke` half-built.

what a caller of your generated cross-service sdk sees is the **wire** shape —
`{ surfer: { uuid, name } }` — never the instance. the two differ by design: the wire is what
crosses, the instance is what you hold once through.

two syntax notes:

```ts
// a dobj that names ITSELF must defer, per js class-field order
static schema = z.object({ replies: z.array(z.lazy(() => Comment.contract())) });

// .ref() goes on the raw contract, before any chain
z.object({ rider: Surfer.contract().ref('primary') }).optional()
```

# features

- **genLambdaEndpoint** — define endpoints with validation, log capture, error classification
  - `genLambdaEndpoint.forAsk()` — direct invoke
  - `genLambdaEndpoint.forApiGateway()` — http via api gateway, with full wire-response control
  - `genLambdaEndpoint.forSqs.perRecord()` — one queue message per invoke
  - `genLambdaEndpoint.forSqs.perBatch()` — a whole queue batch per invoke, fail-safe
- **domain objects at the border** — `X.contract()` in a schema hands `invoke` real instances, at
  every depth, with no `as` cast (above)
- **askLambdaEndpoint** — ask another lambda with typed request/response, automatic trail propagation
- **runLambdaEndpoint** — run an endpoint from a test
  - `onReferenced()` — you hold the handler; a caller fault is **returned**
  - `onSerialized()` — you hold the slug; a caller fault **throws**. `at: 'cloud' | 'local'`
- **asLambdaEvent** — cast a payload into the envelope aws delivers, wire-faithful by default
  - `fromApiGateway()`, `fromSqs()`, `fromSns()`, `fromKinesis()`, `fromS3()`
- **trace-id propagation** — pass `log`, and `trail.exid` threads through the lambda-to-lambda call
  chain. http and sqs triggers mint a fresh `exid` per invoke
- **introspection** — expose json-schema via `{ introspect: 'schema' }` (prep only), collected by
  `getOneLambdaContract` / `getAllLambdaContracts` for sdk generation

# docs

design records, on github only — they ship in no tarball.

- [domain terms](./.agent/repo=.this/role=any/briefs/domain.terms/.readme.md) — `payload`, `headers`, `event`, `records`, `trail`, and the edge cases of each
- [run boundary](./.agent/repo=.this/role=any/briefs/define.lambda-endpoint-run-boundary.md) — serialized vs referenced, and why the error stance inverts
- [event source](./.agent/repo=.this/role=any/briefs/define.lambda-event-source.md) — which envelope each aws source wraps a payload in
- [wire response](./.behavior/v2026_08_03.feat-apigateway-wire-response/1.vision.yield.md) — how the api-gateway response contract was shaped
- [endpoint vocabulary](./.behavior/v2026_05_08.rename/1.vision.yield.md) — how `LambdaEndpoint` and its slug were named
