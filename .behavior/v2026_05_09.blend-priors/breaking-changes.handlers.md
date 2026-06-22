# Incompatible Changes: simple-lambda-handlers to sdk-aws-lambda

This document details incompatible changes when you migrate from `simple-lambda-handlers` (v0.10.5) to `sdk-aws-lambda`.

---

## Executive Summary

| Category | Impact |
|----------|--------|
| Function signatures | HIGH - Complete rewrite required |
| Schema validation | HIGH - Joi to Zod migration |
| Exports removed | HIGH - Several exports no longer available |
| Middleware version | MEDIUM - @middy/core v1 to v7 |
| Error classes | LOW - Same BadRequestError from helpful-errors |
| CORS configuration | LOW - Similar but renamed |

---

## 1. Incompatible Signature Changes

### 1.1 createApiGatewayHandler -> forApiGateway

**simple-lambda-handlers:**
```typescript
createApiGatewayHandler<I, O, IH>({
  log: LogMethods | { methods: LogMethods; input?: ...; output?: ... },
  schema: EventSchema,  // Joi schema
  logic: ApiGatewayHandlerLogic<I, O, IH>,
  cors?: CORSOptions,
  deserialize?: { body: boolean }
}): middy.Middy<...>
```

**sdk-aws-lambda:**
```typescript
forApiGateway<TInput, TOutput>({
  schema: {
    input: ZodSchema<TInput>,
    output: ZodSchema<TOutput>
  },
  invoke: (
    input: { event: TInput; rawEvent: UnifiedApiGatewayEvent },
    context: { log: LogMethods }
  ) => Promise<TOutput>,
  logTranslate?: IoLogTranslate,
  cors?: CorsConfig,
  parseBody?: boolean
}): (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>
```

**Incompatible changes:**
- `logic` parameter renamed to `invoke`
- `invoke` signature changed: receives `{ event, rawEvent }` not raw API Gateway fields
- `schema` is now an object with `input` and `output` (both Zod schemas)
- `log` is no longer passed as config; injected via trail middleware
- `deserialize.body` renamed to `parseBody`
- Returns raw handler function, not Middy instance

### 1.2 createStandardHandler -> genLambdaEndpoint

**simple-lambda-handlers:**
```typescript
createStandardHandler<I, O>({
  logic: HandlerLogic<I, O>,
  schema: EventSchema,  // Joi schema
  log: LogMethods | { methods: LogMethods; input?: ...; output?: ... }
}): middy.Middy<I, O, Context>
```

**sdk-aws-lambda:**
```typescript
genLambdaEndpoint<TInput, TOutput>({
  schema: {
    input: ZodSchema<TInput>,
    output: ZodSchema<TOutput>
  },
  invoke: (
    input: { event: TInput },
    context: { log: LogMethods }
  ) => Promise<TOutput>,
  logTranslate?: IoLogTranslate
}, genContext?: GenLambdaEndpointContext): (
  event: TInput & { trail?: { exid?: string } | null },
  context: Context
) => Promise<TOutput>
```

**Incompatible changes:**
- Function renamed from `createStandardHandler` to `genLambdaEndpoint`
- `logic` parameter renamed to `invoke`
- `invoke` receives `{ event }` wrapper, not raw event
- `schema` split into `input` and `output` (both required, both Zod)
- `log` removed from config; optionally passed via `genContext`
- Returns raw handler function, not Middy instance

### 1.3 Handler Logic Signature Changes

**simple-lambda-handlers:**
```typescript
type HandlerLogic<I, O, C = Context> = (event: I, context: C) => Promise<O>;

type ApiGatewayHandlerLogic<I, O, IH> = (
  event: {
    httpMethod: string;
    headers: IH;
    body: I;
    path: string;
    isBase64Encoded: boolean;
    pathParameters: Record<string, string>;
    queryStringParameters: Record<string, string>;
  },
  context: { requestContext: APIGatewayEventRequestContext }
) => Promise<{
  statusCode: number;
  headers?: Record<string, string>;
  body?: O;
}>;
```

**sdk-aws-lambda:**
```typescript
// For genLambdaEndpoint
invoke: (
  input: { event: TInput },
  context: { log: LogMethods }
) => Promise<TOutput>;

// For forApiGateway
invoke: (
  input: { event: TInput; rawEvent: UnifiedApiGatewayEvent },
  context: { log: LogMethods }
) => Promise<TOutput>;
```

**Incompatible changes:**
- Event is wrapped in `{ event }` object
- Context provides `{ log }` instead of raw Lambda context
- API Gateway handler returns raw output, not `{ statusCode, body }`
- Status code always 200 for success; errors handled by middleware

---

## 2. Removed Exports

The exports below from `simple-lambda-handlers` are NOT available in `sdk-aws-lambda`:

| Export | Type | Migration Path |
|--------|------|----------------|
| `createApiGatewayHandler` | Function | Use `forApiGateway` |
| `createStandardHandler` | Function | Use `genLambdaEndpoint` |
| `HTTPStatusCode` | Enum | Define locally or use HTTP constants library |
| `Middy` | Type (re-export) | Import directly from `@middy/core` |
| `EventSchema` | Type | Use `ZodSchema` from `zod` |
| `LogMethods` | Type | Import from `sdk-logs` |
| `ApiGatewayHandlerLogic` | Type | Define custom interface or use `ForApiGatewayInput` |
| `HandlerLogic` | Type | Define custom interface or use `GenLambdaEndpointInput` |

---

## 3. Schema Validation: Joi to Zod Migration

### 3.1 Dependency Change

**simple-lambda-handlers:**
```json
{
  "dependencies": {
    "joi": "17.4.0"
  },
  "peerDependencies": {
    "joi": "17.x"
  }
}
```

**sdk-aws-lambda:**
```json
{
  "dependencies": {
    "zod": "4.4.3"
  }
}
```

### 3.2 Schema Definition Changes

**simple-lambda-handlers (Joi):**
```typescript
import Joi from 'joi';

const schema = Joi.object({
  name: Joi.string().required(),
  age: Joi.number().min(0).optional(),
  email: Joi.string().email().required()
});
```

**sdk-aws-lambda (Zod):**
```typescript
import { z } from 'zod';

const schema = {
  input: z.object({
    name: z.string(),
    age: z.number().min(0).optional(),
    email: z.string().email()
  }),
  output: z.object({
    // output validation is now required
  })
};
```

### 3.3 Validation Error Format Changes

**simple-lambda-handlers:**
- Throws `EventValidationError` (extends `BadRequestError`)
- Error includes `details` array with `{ message, path, type }`
- Full event included in error for debug

**sdk-aws-lambda:**
- Throws `BadRequestError` with metadata
- Error includes `issues` array with `{ path, message, code }`
- Event not included in error (security improvement)

```typescript
// simple-lambda-handlers error format
{
  message: "2 properties failed validation. Details: [...]. Event: {...}",
  details: [
    { message: "...", path: "name", type: "string.empty" }
  ]
}

// sdk-aws-lambda error format
{
  errorMessage: "validation failed",
  errorType: "BadRequestError",
  details: {
    issues: [
      { path: "name", message: "Required", code: "invalid_type" }
    ]
  }
}
```

---

## 4. Changed Behaviors

### 4.1 Trail/Trace Propagation (NEW)

**simple-lambda-handlers:** No built-in trace propagation.

**sdk-aws-lambda:** Automatic `exid` (execution ID) propagation via trail middleware.
- Events can be wrapped: `{ event: {...}, trail: { exid: "..." } }`
- Trail unwrap happens automatically
- `exid` injected into log context

### 4.2 Lambda Invocation (NEW)

**simple-lambda-handlers:** No client-side invocation support.

**sdk-aws-lambda:** Full client support via `askLambdaEndpoint`:
```typescript
const result = await askLambdaEndpoint<Request, Response>(
  {
    which: { service: 'my-service', function: 'my-function' },
    event: { ... }
  },
  { log, cache }
);
```

### 4.3 Output Validation (NEW)

**simple-lambda-handlers:** Only validates input.

**sdk-aws-lambda:** Validates both input AND output against schema.

### 4.4 Middleware Architecture

**simple-lambda-handlers:**
- Returns `middy.Middy<...>` instance
- Direct Middy v1 integration
- User can chain additional middlewares

**sdk-aws-lambda:**
- Returns raw handler function
- Middlewares composed internally
- No direct Middy access (use exported middleware creators for custom setups)

### 4.5 Error Response Format

**simple-lambda-handlers:**
```json
{
  "message": "...",
  "type": "BadRequestError",
  "stack": "..."
}
```

**sdk-aws-lambda:**
```json
{
  "errorMessage": "...",
  "errorType": "BadRequestError",
  "causeMessage": "...",
  "details": { ... }
}
```

### 4.6 CORS Configuration

**simple-lambda-handlers:**
```typescript
cors?: {
  origins: '*' | string[];
  withCredentials?: boolean;
  headers?: string;  // comma-separated string
}
```

**sdk-aws-lambda:**
```typescript
cors?: {
  origins?: string | string[];
  credentials?: boolean;
  headers?: string[];  // array
  methods?: string[];
}
```

**Changes:**
- `withCredentials` renamed to `credentials`
- `headers` changed from comma-separated string to array
- `methods` added (new)

---

## 5. Middy Version Upgrade

**simple-lambda-handlers:** `@middy/core` v1.5.2

**sdk-aws-lambda:** `@middy/core` v7.5.0

This is a major version jump. If you extend with custom Middy middlewares, review the [Middy migration guide](https://middy.js.org/docs/upgrade/4-5).

---

## 6. Migration Steps

### Step 1: Install New Dependencies
```bash
npm uninstall simple-lambda-handlers joi
npm install sdk-aws-lambda zod sdk-logs
```

### Step 2: Convert Joi Schemas to Zod
```typescript
// Before
const schema = Joi.object({ name: Joi.string().required() });

// After
const inputSchema = z.object({ name: z.string() });
const outputSchema = z.object({ success: z.boolean() });
```

### Step 3: Migrate API Gateway Handlers
```typescript
// Before
import { createApiGatewayHandler, HTTPStatusCode } from 'simple-lambda-handlers';

export const handler = createApiGatewayHandler({
  log: logger,
  schema: eventSchema,
  logic: async (event) => ({
    statusCode: HTTPStatusCode.SUCCESS_200,
    body: { result: await process(event.body) }
  }),
  cors: { origins: ['https://example.com'], withCredentials: true }
});

// After
import { forApiGateway } from 'sdk-aws-lambda';

export const handler = forApiGateway({
  schema: { input: inputSchema, output: outputSchema },
  invoke: async ({ event }) => {
    return { result: await process(event) };
  },
  cors: { origins: ['https://example.com'], credentials: true }
});
```

### Step 4: Migrate Standard Handlers
```typescript
// Before
import { createStandardHandler } from 'simple-lambda-handlers';

export const handler = createStandardHandler({
  log: logger,
  schema: eventSchema,
  logic: async (event) => await process(event)
});

// After
import { genLambdaEndpoint } from 'sdk-aws-lambda';

export const handler = genLambdaEndpoint({
  schema: { input: inputSchema, output: outputSchema },
  invoke: async ({ event }) => await process(event)
});
```

### Step 5: Update Error Handlers
```typescript
// Before
catch (error) {
  if (error.details) {
    // Handle validation error
    const validationErrors = error.details;
  }
}

// After
catch (error) {
  if (error.metadata?.issues) {
    // Handle validation error
    const validationIssues = error.metadata.issues;
  }
}
```

### Step 6: Replace HTTPStatusCode (if used)
```typescript
// Before
import { HTTPStatusCode } from 'simple-lambda-handlers';
return { statusCode: HTTPStatusCode.SUCCESS_200 };

// After
// Option A: Use literal values
return { statusCode: 200 };

// Option B: Define locally
const HTTPStatusCode = {
  SUCCESS_200: 200,
  CLIENT_ERROR_400: 400,
  SERVER_ERROR_500: 500
} as const;
```

### Step 7: Update LogMethods Import
```typescript
// Before
import type { LogMethods } from 'simple-lambda-handlers';

// After
import type { LogMethods } from 'sdk-logs';
```

---

## 7. New Capabilities to Leverage

After migration, consider these new features:

1. **Trail Propagation**: Auto-correlate requests across services via `trail.exid`
2. **Lambda Client**: Use `askLambdaEndpoint` for service-to-service calls
3. **Response Cache**: Pass `cache` to `askLambdaEndpoint` for automatic result cache
4. **Output Validation**: Schema-validate responses to catch contract violations early
5. **Unified API Gateway Events**: Use `UnifiedApiGatewayEvent` for v1/v2 compatibility

---

## 8. Compatibility Notes

### Preserved Behaviors
- `BadRequestError` from `helpful-errors` (re-exported for convenience)
- Same BadRequestError detection logic (instanceof, name, prototype chain)
- JSON body parse for API Gateway
- Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)

### Dependency Overlap
Both packages use:
- `helpful-errors` for error classes
- `@middy/core` (different versions)
- `domain-objects`
