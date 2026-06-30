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

# features

- **genLambdaEndpoint** — define lambda endpoints with validation, log capture, error classification
  - `genLambdaEndpoint()` — direct invoke (default)
  - `forApiGateway()` — http via api gateway
- **askLambdaEndpoint** — ask another lambda with typed request/response, automatic trail propagation
- **trace-id propagation** — pass `log` and trail.exid auto-threads through the call chain
- **introspection** — expose json-schema via `{ introspect: 'schema' }` (prep only)
- **contract discovery** — `getOneLambdaContract`, `getAllLambdaContracts` for sdk generation

# docs

see [vision](./.behavior/v2026_05_08.rename/1.vision.yield.md) for detailed contracts and design.
