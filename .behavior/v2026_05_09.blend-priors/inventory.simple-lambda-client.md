# Inventory: ehmpathy/simple-lambda-client

Public exports from the `simple-lambda-client` package.

## Functions

### `invokeLambdaFunction`

Main function to invoke AWS Lambda functions with cache support.

```typescript
export const invokeLambdaFunction = async <O = any, I = any>({
  service: serviceName,
  function: functionName,
  stage,
  event,
  logDebug,
  cache,
}: {
  service: string;
  function: string;
  stage: string;
  event: I;
  logDebug?: LogMethod;
  cache?: SimpleCache<O>;
}): Promise<O>
```

**Source:** `src/invokeLambdaFunction.ts`

---

### `getSimpleLambdaClientCacheKey`

Generates URI-safe cache keys for Lambda client requests.

```typescript
export const getSimpleLambdaClientCacheKey = ({
  service: serviceName,
  function: functionName,
  stage,
  event,
}: {
  service: string;
  function: string;
  stage: string;
  event: Record<string, any>;
}): string
```

**Source:** `src/cache/getSimpleLambdaClientCacheKey.ts`

---

### `withoutSet`

Disables the `.set` functionality of a cache. Returns a read-only version.

```typescript
export const withoutSet = <T>(cache: SimpleCache<T>): SimpleCache<T>
```

**Purpose:** Useful when cache management is delegated to a Lambda service. Allows `.get` operations to avoid Lambda API calls while `.set` operations become no-ops.

**Source:** `src/cache/withoutSet.ts`

---

## Types

### `LogMethod`

Type definition for log functions used in Lambda invocations.

```typescript
type LogMethod = (message: string, metadata: any) => void;
```

**Source:** `src/executeLambdaInvocation.ts`

---

## Classes

### `LambdaInvocationError`

Error class for Lambda invocation failures.

```typescript
export class LambdaInvocationError extends Error {
  lambda: string;
  response: {
    errorMessage?: string;
    errorType?: string;
    stackTrace?: string;
  };
  event: any;

  constructor(lambda: string, response: any, event: any);
}
```

**Source:** `src/errors.ts`

---

### `UnsuccessfulStatusCodeError`

Error class for failed HTTP status codes on Lambda invocation.

```typescript
export class UnsuccessfulStatusCodeError extends Error {
  constructor(code: number | undefined, payload: any);
}
```

**Source:** `src/errors.ts`

---

## Constants

None exported publicly.

---

## Re-exports Summary

From `src/index.ts`:

```typescript
export { getSimpleLambdaClientCacheKey } from './cache/getSimpleLambdaClientCacheKey';
export { withoutSet } from './cache/withoutSet';
export { LambdaInvocationError, UnsuccessfulStatusCodeError } from './errors';
export type { LogMethod } from './executeLambdaInvocation';
export { invokeLambdaFunction } from './invokeLambdaFunction';
```

---

## Dependencies

- `simple-in-memory-cache` - For internal sync cache used in request deduplication
- `with-simple-cache` - For `SimpleCache` type and `withSimpleCacheAsync` utility
- `@aws-sdk/client-lambda` - For AWS Lambda SDK client (implied)
