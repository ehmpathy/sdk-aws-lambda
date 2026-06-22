# Gap Analysis: simple-lambda-client vs sdk-aws-lambda (client features)

## 1. Exports in simple-lambda-client

```typescript
// src/index.ts
export { getSimpleLambdaClientCacheKey } from './cache/getSimpleLambdaClientCacheKey';
export { withoutSet } from './cache/withoutSet';
export { LambdaInvocationError, UnsuccessfulStatusCodeError } from './errors';
export type { LogMethod } from './executeLambdaInvocation';
export { invokeLambdaFunction } from './invokeLambdaFunction';
```

### Functions
| Export | Description |
|--------|-------------|
| `invokeLambdaFunction` | Main function to invoke lambdas with cache support |
| `getSimpleLambdaClientCacheKey` | Generates cache keys for request deduplication |
| `withoutSet` | Creates read-only cache wrapper |

### Types
| Export | Description |
|--------|-------------|
| `LogMethod` | `(message: string, metadata: any) => void` |

### Error Classes
| Export | Description |
|--------|-------------|
| `LambdaInvocationError` | Error when lambda returns error payload |
| `UnsuccessfulStatusCodeError` | Error when status code != 200 |

---

## 2. Exports in sdk-aws-lambda (client-related)

```typescript
// src/index.ts (client features)
export { LambdaInvocationError } from './domain.objects/LambdaInvocationError';
export type { AskLambdaEndpointContext, AskLambdaEndpointInput } from './domain.operations/askLambdaEndpoint/askLambdaEndpoint';
export { askLambdaEndpoint } from './domain.operations/askLambdaEndpoint/askLambdaEndpoint';
export { getAskLambdaCacheKey } from './domain.operations/askLambdaEndpoint/getAskLambdaCacheKey';
export { withoutSet } from './domain.operations/askLambdaEndpoint/withoutSet';
```

### Functions
| Export | Description |
|--------|-------------|
| `askLambdaEndpoint` | Main function to invoke lambdas with trail propagation |
| `getAskLambdaCacheKey` | Generates cache keys for request deduplication |
| `withoutSet` | Creates read-only cache wrapper |

### Types
| Export | Description |
|--------|-------------|
| `AskLambdaEndpointInput<TRequest>` | Input type for askLambdaEndpoint |
| `AskLambdaEndpointContext` | Context type for askLambdaEndpoint |

### Error Classes
| Export | Description |
|--------|-------------|
| `LambdaInvocationError` | Error when lambda invocation fails (extends HelpfulError) |

---

## 3. Gaps (Not Ported to sdk-aws-lambda)

| simple-lambda-client | Status | Notes |
|---------------------|--------|-------|
| `UnsuccessfulStatusCodeError` | **GAP** | Not ported - handled internally by `asParsedResponse` |
| `LogMethod` type | **GAP** | Replaced by `MinimalLogMethods` interface (not exported) |

### Gap Details

#### UnsuccessfulStatusCodeError
- simple-lambda-client: Explicit error class for status != 200
- sdk-aws-lambda: Status code errors bundled into `LambdaInvocationError` via `asParsedResponse`
- **Decision needed**: Port as separate error class or keep consolidated?

#### LogMethod type
- simple-lambda-client: `(message: string, metadata: any) => void`
- sdk-aws-lambda: Uses `MinimalLogMethods` interface with `debug` method
- **Decision needed**: Export `MinimalLogMethods` type for consumers?

---

## 4. Mappings (Renamed exports)

| simple-lambda-client | sdk-aws-lambda | Notes |
|---------------------|----------------|-------|
| `invokeLambdaFunction` | `askLambdaEndpoint` | Renamed for clarity |
| `getSimpleLambdaClientCacheKey` | `getAskLambdaCacheKey` | Renamed for consistency |
| `LogMethod` | `MinimalLogMethods` | Restructured interface |

### API Signature Changes

#### invokeLambdaFunction -> askLambdaEndpoint

**simple-lambda-client:**
```typescript
invokeLambdaFunction<O, I>({
  service: string,
  function: string,
  stage: string,
  event: I,
  logDebug?: LogMethod,
  cache?: SimpleCache<O>,
}): Promise<O>
```

**sdk-aws-lambda:**
```typescript
askLambdaEndpoint<TRequest, TResponse>(
  input: {
    which: { service: string, function: string },
    event: TRequest,
  },
  context?: {
    log?: MinimalLogMethods,
    env?: { stage?: string, region?: string },
    lambda?: LambdaClient,
    cache?: SimpleCache<unknown>,
    dedupCache?: SimpleInMemoryCache<unknown>,
  }
): Promise<TResponse>
```

**Key differences:**
1. `service`/`function` moved to `input.which` object
2. `stage` moved from input to `context.env.stage` (defaults to env var)
3. `logDebug` renamed to `context.log` with structured interface
4. Added `context.lambda` for custom LambdaClient
5. Added `context.dedupCache` for deduplication (injectable vs global)
6. Added `context.env.region` for AWS region
7. Trail propagation built-in via `exid`

#### getSimpleLambdaClientCacheKey -> getAskLambdaCacheKey

**simple-lambda-client:**
```typescript
getSimpleLambdaClientCacheKey({
  service: string,
  function: string,
  stage: string,
  event: Record<string, any>,
}): string
```

**sdk-aws-lambda:**
```typescript
getAskLambdaCacheKey({
  service: string,
  function: string,
  stage: string,
  event: Record<string, unknown>,
}): string
```

**Note:** Functionally identical, only uses `Record<string, unknown>` instead of `any`.

#### LambdaInvocationError (restructured)

**simple-lambda-client:**
```typescript
class LambdaInvocationError extends Error {
  lambda: string;
  response: { errorMessage?, errorType?, stackTrace? };
  event: any;
}
```

**sdk-aws-lambda:**
```typescript
class LambdaInvocationError extends HelpfulError<LambdaInvocationErrorMetadata> {
  static code = { http: 502, slug: 'LAMBDA_INVOCATION_ERROR' };
  // metadata: { service, function, exid, errorType?, stackTrace?, cause? }
}
```

**Key differences:**
1. Extends `HelpfulError` instead of `Error`
2. Has static error `code` with HTTP status
3. `lambda` split into `service` + `function`
4. Added `exid` for trail correlation
5. Removed `event` from error (security: avoid to log sensitive data)
6. Added `cause` for error chain

---

## Summary

| Category | simple-lambda-client | sdk-aws-lambda |
|----------|---------------------|----------------|
| Main invoke function | 1 | 1 |
| Cache key function | 1 | 1 |
| Cache utility | 1 | 1 |
| Error classes | 2 | 1 (-1) |
| Type exports | 1 | 2 (+1) |

**Parity:** 4/5 exports mapped, 1 error class consolidated, richer type exports.
