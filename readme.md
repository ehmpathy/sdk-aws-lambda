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
  { log, env }, // optional, trail auto-extracted and injected into event
);
```

# features

- **genLambdaEndpoint** — define lambda endpoints with validation, log capture, error classification
  - `genLambdaEndpoint()` — direct invoke (default)
  - `.for.apiGateway` — http via api gateway
  - `.for.sqs` — sqs queue consumer
- **askLambdaEndpoint** — ask another lambda with typed request/response, automatic trail propagation
- **trace-id propagation** — pass `log` and trail.exid auto-threads through the call chain

# docs

see [vision](./.behavior/v2026_05_08.rename/1.vision.yield.md) for detailed contracts and design.
