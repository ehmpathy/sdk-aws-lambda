# Incompatibilities: simple-lambda-client to sdk-aws-lambda Migration

This document details incompatibilities when you migrate from `ehmpathy/simple-lambda-client` to `sdk-aws-lambda`.

## Summary

| Category | Impact |
|----------|--------|
| AWS SDK | v2 -> v3 (major) |
| Function renamed | `invokeLambdaFunction` -> `askLambdaEndpoint` |
| Error classes | `UnsuccessfulStatusCodeError` removed |
| Signature | flat object -> nested `{ which, event }` |
| Trail propagation | automatic (new) |
| Cache key function | renamed |

---

## 1. AWS SDK Version (v2 -> v3)

### simple-lambda-client
```typescript
import { Lambda } from 'aws-sdk';
const lambda = new Lambda();
// uses .invoke().promise() pattern
```

### sdk-aws-lambda
```typescript
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
// uses client.send(new InvokeCommand(...)) pattern
```

### Migration Impact
- Must install `@aws-sdk/client-lambda` instead of `aws-sdk`
- AWS SDK v3 is modular (smaller bundle size)
- AWS SDK v3 uses different credential/config patterns
- If you share the Lambda client, you must migrate it to v3

---

## 2. Function Signature Changes

### simple-lambda-client
```typescript
import { invokeLambdaFunction } from 'simple-lambda-client';

await invokeLambdaFunction({
  service: 'my-service',
  function: 'myFunction',
  stage: 'prod',           // required
  event: { foo: 'bar' },
  logDebug: console.log,   // optional
  cache: myCache,          // optional
});
```

### sdk-aws-lambda
```typescript
import { askLambdaEndpoint } from 'sdk-aws-lambda';

await askLambdaEndpoint(
  {
    which: {
      service: 'my-service',
      function: 'myFunction',
    },
    event: { foo: 'bar' },
  },
  {
    log: console,                    // optional, accepts .debug method
    env: { stage: 'prod' },          // optional, defaults to process.env.STAGE or 'dev'
    lambda: lambdaClient,            // optional, injectable LambdaClient
    cache: myCache,                  // optional
    dedupCache: myDedupCache,        // optional, new: injectable dedup cache
  }
);
```

### Incompatibilities
1. **Function renamed**: `invokeLambdaFunction` -> `askLambdaEndpoint`
2. **Input restructured**: flat object split into `(input, context?)` tuple
3. **service/function moved**: now under `input.which.service` and `input.which.function`
4. **stage optional**: moved to `context.env.stage`, defaults to `process.env.STAGE` or `'dev'`
5. **logDebug renamed**: `logDebug` -> `context.log` (must have `.debug` method)
6. **region injectable**: new `context.env.region` option (defaults to `process.env.AWS_REGION`)
7. **Lambda client injectable**: new `context.lambda` allows custom client injection

---

## 3. Error Classes

### simple-lambda-client exports
```typescript
export { LambdaInvocationError, UnsuccessfulStatusCodeError } from './errors';
```

### sdk-aws-lambda exports
```typescript
export { LambdaInvocationError } from './domain.objects/LambdaInvocationError';
// UnsuccessfulStatusCodeError is REMOVED
```

### LambdaInvocationError Changes

#### simple-lambda-client
```typescript
class LambdaInvocationError extends Error {
  public lambda: string;           // lambda name string
  public response: {
    errorMessage?: string;
    errorType?: string;
    stackTrace?: string;
  };
  public event: any;               // original input event
}
```

#### sdk-aws-lambda
```typescript
class LambdaInvocationError extends HelpfulError<LambdaInvocationErrorMetadata> {
  // metadata via HelpfulError pattern
}

interface LambdaInvocationErrorMetadata {
  service: string;           // NEW: service name
  function: string;          // NEW: function name (not combined)
  exid: string | null;       // NEW: execution id for trace
  errorType?: string;        // preserved
  stackTrace?: string;       // preserved (now joined string, not object)
  cause?: Error;             // NEW: chained error support
}
```

### Incompatibilities
1. **UnsuccessfulStatusCodeError removed**: sdk-aws-lambda throws `LambdaInvocationError` for all lambda errors
2. **Property structure changed**:
   - `error.lambda` (string) -> `error.metadata.service` + `error.metadata.function`
   - `error.response` -> flattened into metadata
   - `error.event` -> removed (not exposed in new error)
3. **Base class changed**: `Error` -> `HelpfulError`
4. **New properties**: `exid` for trail correlation, `cause` for error chain

---

## 4. Cache Key Function

### simple-lambda-client
```typescript
import { getSimpleLambdaClientCacheKey } from 'simple-lambda-client';
```

### sdk-aws-lambda
```typescript
import { getAskLambdaCacheKey } from 'sdk-aws-lambda';
```

### Incompatibilities
- Function renamed: `getSimpleLambdaClientCacheKey` -> `getAskLambdaCacheKey`
- Same signature and behavior (generates identical keys)

---

## 5. asCacheWithoutSet Utility

### simple-lambda-client
```typescript
import { withoutSet } from 'simple-lambda-client';
```

### sdk-aws-lambda
```typescript
import { asCacheWithoutSet } from 'sdk-aws-lambda';
```

### Incompatibilities
- Function renamed: `withoutSet` -> `asCacheWithoutSet` (follows `as*` transformer prefix convention)
- Same signature and behavior

---

## 6. Trail Propagation (New Feature)

sdk-aws-lambda automatically propagates trail context for distributed trace:

### Request Payload Transformation
```typescript
// simple-lambda-client sends:
{ foo: 'bar' }

// sdk-aws-lambda sends:
{
  event: { foo: 'bar' },
  trail: { exid: 'auto-generated-or-from-context' }
}
```

### Impact
- **Handler must unwrap**: lambda handlers that receive calls from sdk-aws-lambda must expect `{ event, trail }` wrapper
- **Incompatible if mixed**: cannot invoke old handlers that expect flat payloads

---

## 7. Deduplication Cache

### simple-lambda-client
```typescript
// Global mutable cache (hidden internal state)
const globalSyncCache = createCache({ expiration: { seconds: 15 } });
```

### sdk-aws-lambda
```typescript
// Injectable via context (explicit, testable)
await askLambdaEndpoint(input, {
  cache: myOutputCache,
  dedupCache: myDedupCache,  // optional, you control it
});
```

### Incompatibilities
- **No hidden global**: you must provide dedup cache explicitly if needed
- **More control**: cache lifecycle is under your management

---

## 8. Removed Exports

| simple-lambda-client | sdk-aws-lambda | Status |
|---------------------|----------------|--------|
| `invokeLambdaFunction` | `askLambdaEndpoint` | renamed |
| `UnsuccessfulStatusCodeError` | - | removed |
| `getSimpleLambdaClientCacheKey` | `getAskLambdaCacheKey` | renamed |
| `withoutSet` | `asCacheWithoutSet` | renamed |
| `LambdaInvocationError` | `LambdaInvocationError` | restructured |
| `LogMethod` | - | removed (inlined interface) |

---

## 9. New Exports in sdk-aws-lambda

| Export | Purpose |
|--------|---------|
| `genLambdaEndpoint` | define lambda handlers with middleware |
| `forApiGateway` | API Gateway handler wrapper |
| `createTrailMiddleware` | trail propagation middleware |
| `createValidationMiddleware` | input validation |
| `createOutputValidationMiddleware` | output validation |
| `createErrorHandlerMiddleware` | error formatter |
| `createIoLogMiddleware` | request/response logger |
| `createApiGatewayEventConversionMiddleware` | v1/v2 event normalizer |
| `BadRequestError` | re-exported from helpful-errors |

---

## Migration Steps

### 1. Install new dependencies
```bash
pnpm remove simple-lambda-client aws-sdk
pnpm add sdk-aws-lambda @aws-sdk/client-lambda
```

### 2. Update imports
```typescript
// Before
import {
  invokeLambdaFunction,
  getSimpleLambdaClientCacheKey,
  withoutSet,
  LambdaInvocationError,
  UnsuccessfulStatusCodeError
} from 'simple-lambda-client';

// After
import {
  askLambdaEndpoint,
  getAskLambdaCacheKey,
  asCacheWithoutSet,
  LambdaEndpointError
} from 'sdk-aws-lambda';
```

### 3. Update invocation calls
```typescript
// Before
const result = await invokeLambdaFunction({
  service: 'my-service',
  function: 'myFunction',
  stage: 'prod',
  event: { foo: 'bar' },
  logDebug: (msg, meta) => console.log(msg, meta),
  cache: myCache,
});

// After
const result = await askLambdaEndpoint(
  {
    which: { service: 'my-service', function: 'myFunction' },
    event: { foo: 'bar' },
  },
  {
    env: { stage: 'prod' },
    log: console,  // or any object with .debug method
    cache: myCache,
  }
);
```

### 4. Update error handler
```typescript
// Before
try { /* ... */ } catch (error) {
  if (error instanceof UnsuccessfulStatusCodeError) {
    // handle non-200 status
  }
  if (error instanceof LambdaInvocationError) {
    console.log(error.lambda);           // 'my-service-prod-myFunction'
    console.log(error.response);         // { errorMessage, errorType, stackTrace }
    console.log(error.event);            // original input
  }
}

// After
try { /* ... */ } catch (error) {
  if (error instanceof LambdaInvocationError) {
    // UnsuccessfulStatusCodeError is now rolled into LambdaInvocationError
    console.log(error.metadata.service);   // 'my-service'
    console.log(error.metadata.function);  // 'myFunction'
    console.log(error.metadata.exid);      // trail execution id
    console.log(error.metadata.errorType); // 'Error' or specific type
    console.log(error.metadata.stackTrace);// joined string
  }
}
```

### 5. Update lambda handlers to accept wrapped payload
```typescript
// If your handler is called via askLambdaEndpoint, update it:

// Before
export const handler = async (event: MyInput) => {
  return process(event);
};

// After (if you use genLambdaEndpoint, this is handled automatically)
// Otherwise manually unwrap:
export const handler = async (wrapped: { event: MyInput; trail: { exid: string } }) => {
  const { event, trail } = wrapped;
  return process(event);
};
```

---

## Compatibility Notes

1. **Cannot mix**: Old handlers that expect flat events will fail with new sdk-aws-lambda calls
2. **Cannot downgrade**: New error metadata structure is incompatible
3. **Cache keys compatible**: `getAskLambdaCacheKey` produces identical keys to `getSimpleLambdaClientCacheKey`
4. **asCacheWithoutSet renamed**: `withoutSet` -> `asCacheWithoutSet` (same behavior)
