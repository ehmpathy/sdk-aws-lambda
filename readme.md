# sdk-aws-lambda

a simple and opinionated sdk for aws lambda. define endpoints, ask endpoints, auto-propagate trace-ids.

# installation

```sh
npm install --save sdk-aws-lambda
```

# usage

## define an endpoint

```ts
import { genLambdaEndpoint } from 'sdk-aws-lambda';

export const handler = genLambdaEndpoint(
  {
    schema,
    invoke: async ({ event }, { log }) => {
      // log has trail context from caller
    },
  },
  { log }, // optional, auto-generated otherwise
);
```

## ask an endpoint

```ts
import { askLambdaEndpoint } from 'sdk-aws-lambda';

const result = await askLambdaEndpoint<TRequest, TResponse>(
  {
    which: { service: 'svc-jobs', function: 'getJobByUuid' },
    event: { uuid },
  },
  { log, env: { access: 'prep' } }, // access completes the slug; trail auto-propagates
);
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
      at: 'cloud', // or 'local' — resolve the handler from serverless.yml
    },
    { log, env: { access: 'prep' } },
  ),
).rejects.toThrow(ConstraintError);
```

a malfunction throws on both. the util adds no `catch`.

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
| `contemp` (default) | `{ event, trail }` | the nested `{ error: { class, … } }` |
| `ancient` | the event, untouched | the flat `{ errorMessage, errorType }` |

a `genLambdaEndpoint` handler never notices — its middleware unwraps the frame first. a plain
handler does: under the contemp default it reads its own fields off a wrapper and finds them absent.

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

endpoints with zod schemas expose their schema at runtime:

```ts
const schema = await askLambdaEndpoint(
  {
    which: { service: 'svc-user', function: 'getUser' },
    event: { introspect: 'schema' },
  },
  { log, env: { access: 'prep' } },
);
// returns: { input: {...jsonSchema}, output: {...jsonSchema} }
```

requires `env.access === 'prep'`. in prod, it throws a `ConstraintError`.

## validate the input only

`schema.output` is required. for an endpoint that returns no value, declare `z.void()`:

```ts
export const handler = genLambdaEndpoint(
  {
    schema: { input: inputSchema, output: z.void() },
    invoke: async ({ event }) => { await doTheWork(event); },
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

export const handler = genLambdaEndpoint(
  {
    schema: { input: z.object({ surfer: Surfer.contract() }), output: z.void() },
    invoke: async ({ event }) => bookSurfLesson(event.surfer), // event.surfer instanceof Surfer
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

what a caller of your generated cross-service client sees is the **wire** shape —
`{ surfer: { uuid, name } }` — never the instance. the two differ by design: the wire is what
crosses, the instance is what you hold once through.

two syntax notes:

```ts
// a dobj that names ITSELF must defer, per js class-field order
static schema = z.object({ replies: z.array(z.lazy(() => Comment.contract())) });

// .ref() goes on the raw contract, before any chain
z.object({ rider: Surfer.contract().ref('primary') }).optional()
```

## contract discovery

```ts
import { getAllLambdaContracts, getOneLambdaContract } from 'sdk-aws-lambda';

const contract = await getOneLambdaContract(
  { which: { service: 'svc-user', function: 'getUser' } },
  { env: { access: 'prep', region: 'us-east-1' } },
);

const contracts = await getAllLambdaContracts(
  { which: { service: 'svc-user' } },
  { env: { access: 'prep', region: 'us-east-1' } },
);
// returns: { getUser: {...schema}, getSettings: {...schema} }
```

# the http wire response

`forApiGateway()` handlers own their **exact wire response** — any status, any headers, any body, or
none at all. return an `ApiGatewayResponse`, and it reaches the wire as written.

```ts
import { forApiGateway, asApiGatewayResponseSchema } from 'sdk-aws-lambda';

export const handler = forApiGateway({
  schema: {
    input: z.any(),                                       // a twilio form blob
    output: asApiGatewayResponseSchema({ body: z.undefined() }), // carries no body
  },
  invoke: async ({ event }) => ({ status: 204 }),         // 204, no body
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

### the body-less response

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

# features

- **genLambdaEndpoint** — define endpoints with validation, log capture, error classification
  - `genLambdaEndpoint()` — direct invoke (default)
  - `forApiGateway()` — http via api gateway, with full wire-response control (above)
- **domain objects at the border** — `X.contract()` in a schema hands `invoke` real instances, at
  every depth, with no `as` cast (above)
- **askLambdaEndpoint** — ask another lambda with typed request/response, automatic trail propagation
- **runLambdaEndpoint** — run an endpoint from a test
  - `onReferenced()` — you hold the handler; a caller fault is **returned**
  - `onSerialized()` — you hold the slug; a caller fault **throws**. `at: 'cloud' | 'local'`
- **asLambdaEvent** — cast a payload into the envelope aws delivers, wire-faithful by default
  - `fromApiGateway()`, `fromSqs()`, `fromSns()`, `fromKinesis()`, `fromS3()`
- **trace-id propagation** — pass `log`, and `trail.exid` threads through the call chain
- **introspection** — expose json-schema via `{ introspect: 'schema' }` (prep only)
- **contract discovery** — `getOneLambdaContract`, `getAllLambdaContracts` for sdk generation

# docs

design records, on github only — they ship in no tarball.

- [run boundary](./.agent/repo=.this/role=any/briefs/define.lambda-endpoint-run-boundary.md) — serialized vs referenced, and why the error stance inverts
- [event source](./.agent/repo=.this/role=any/briefs/define.lambda-event-source.md) — which envelope each aws source wraps a payload in
- [wire response](./.behavior/v2026_08_03.feat-apigateway-wire-response/1.vision.yield.md) — how the api-gateway response contract was shaped
- [endpoint vocabulary](./.behavior/v2026_05_08.rename/1.vision.yield.md) — how `LambdaEndpoint` and its slug were named
