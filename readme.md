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
    which: { service: 'svc-jobs', access: 'prep', function: 'getJobByUuid' },
    event: { uuid },
  },
  { log }, // trail auto-extracted and injected into event; env optional (region)
);
```

## introspection 

endpoints with zod schemas support runtime introspection. send `{ introspect: 'schema' }` to get the json-schema:

```ts
import { askLambdaEndpoint } from 'sdk-aws-lambda';

// get schema from any endpoint
const schema = await askLambdaEndpoint(
  {
    which: { service: 'svc-user', access: 'prep', function: 'getUser' },
    event: { introspect: 'schema' },
  },
  { log },
);
// returns: { input: {...jsonSchema}, output: {...jsonSchema} }
```

introspection requires `env.access === 'prep'`. in prod, throws ConstraintError.

### define an endpoint with introspection

```ts
import { genLambdaEndpoint } from 'sdk-aws-lambda';
import { z } from 'zod';

const inputSchema = z.object({ userId: z.string().uuid() });
const outputSchema = z.object({ name: z.string(), email: z.string() });

export const handler = genLambdaEndpoint(
  {
    schema: { input: inputSchema, output: outputSchema },
    invoke: async ({ event }) => {
      return { name: 'alice', email: 'alice@example.com' };
    },
  },
  { env: { access: 'prep' } }, // or env: async () => getEnvConfig()
);
```

### contract discovery (for sdk generation)

```ts
import { getAllLambdaContracts, getOneLambdaContract } from 'sdk-aws-lambda';

// get schema for one endpoint
const contract = await getOneLambdaContract(
  { which: { service: 'svc-user', access: 'prep', function: 'getUser' } },
  { env: { region: 'us-east-1' } },
);

// get schemas for all endpoints in a service (keyed by bare function name)
const contracts = await getAllLambdaContracts(
  { which: { service: 'svc-user', access: 'prep' } },
  { env: { region: 'us-east-1' } },
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
    input: z.any(),                                          // a twilio form blob
    output: asApiGatewayResponseSchema({ body: z.undefined() }),
  },
  invoke: async ({ event }) => ({ status: 204 }),            // 204, no body
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

### schema is required; `z.any()` is the opt-out

`schema.output` describes what `invoke` **returns** (the envelope), so
`asApiGatewayResponseSchema({ body })` wraps a body schema into it. a required field with a visible
opt-out keeps validation and introspection on one code path, and puts the choice where a reviewer can
see it.

# features

- **genLambdaEndpoint** — define lambda endpoints with validation, log capture, error classification
  - `genLambdaEndpoint()` — direct invoke (default)
  - `forApiGateway()` — http via api gateway, with full wire-response control (above)
- **askLambdaEndpoint** — ask another lambda with typed request/response, automatic trail propagation
- **trace-id propagation** — pass `log` and trail.exid auto-threads through the call chain
- **introspection** — expose json-schema via `{ introspect: 'schema' }` (prep only)
- **contract discovery** — `getOneLambdaContract`, `getAllLambdaContracts` for sdk generation

# docs

**this readme is the consumer doc.** the contract, the migration, and the live defects are all
above — you need read no further to use the package.

the links below are **internal design records**, kept for a maintainer who wants the reasons:

- ⚠️ they are **not in the npm tarball** (`"files": ["/dist"]`), so they open on github only
- ⚠️ they are process journals — fulcrum tables, review-round narration, references to briefs that
  live outside this package. they read as a decision log, never as a guide

<!-- prettier-ignore -->
| record | holds |
|---|---|
| [the wire-response design](./.behavior/v2026_08_03.feat-apigateway-wire-response/1.vision.yield.md) | why the contract widened rather than grew a peer, its four named pipeline points, and each deferred defect with its clamp |
| [the endpoint vocabulary](./.behavior/v2026_05_08.rename/1.vision.yield.md) | how `LambdaEndpoint` and its slug were named |
