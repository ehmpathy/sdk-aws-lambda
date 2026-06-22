# Gap Analysis: simple-lambda-handlers vs sdk-aws-lambda

## 1. What exists in simple-lambda-handlers

### Public Exports (from `src/index.ts`)

| Export | Type | Description |
|--------|------|-------------|
| `Middy` | type | Re-exported from `@middy/core` |
| `ApiGatewayHandlerLogic` | type | Handler logic type for API Gateway |
| `CORSOptions` | interface | CORS configuration interface |
| `createApiGatewayHandler` | function | Creates API Gateway handler with middleware stack |
| `createStandardHandler` | function | Creates standard Lambda handler with middleware stack |
| `HTTPStatusCode` | enum | HTTP status code constants |
| `EventSchema` | type | Joi schema type alias |
| `HandlerLogic` | type | Generic handler logic type |
| `LogMethods` | interface | Log interface (debug, error) |

### Internal Modules (not publicly exported)

| Module | Description |
|--------|-------------|
| `apiGatewayEventShapeNormalizationMiddleware` | Normalizes V1/V2 API Gateway events |
| `badRequestErrorMiddleware` | Handles BadRequestErrors |
| `internalServiceErrorMiddleware` | Handles internal server errors |
| `ioLoggingMiddleware` | Logs input/output |
| `joiEventValidationMiddleware` | Validates events against Joi schema |
| `isV1APIGatewayEvent` | Type guard for V1 events |
| `isV2APIGatewayEvent` | Type guard for V2 events |
| `validateAgainstSchema` | Validates data against Joi schema |
| `EventValidationError` | Error class for validation failures |

### Key Characteristics
- Uses **Joi** for schema validation
- Returns `middy.Middy<...>` handler type
- CORS handled via `@middy/http-cors`
- Supports log translation to sanitize input/output

---

## 2. What exists in sdk-aws-lambda

### Public Exports (from `src/index.ts`)

| Export | Type | Description |
|--------|------|-------------|
| `BadRequestError` | class | Re-exported from `helpful-errors` |
| `LambdaInvocationError` | class | Error for Lambda invocation failures |
| `AskLambdaEndpointContext` | type | Context for ask Lambda endpoints |
| `AskLambdaEndpointInput` | type | Input for ask Lambda endpoints |
| `askLambdaEndpoint` | function | Invoke Lambda endpoints with trace propagation |
| `getAskLambdaCacheKey` | function | Generate cache keys for Lambda calls |
| `withoutSet` | function | Utility to exclude Set from object |
| `CorsConfig` | type | CORS configuration type |
| `ForApiGatewayInput` | type | Input for API Gateway adapter |
| `forApiGateway` | function | Adapter for API Gateway endpoints |
| `GenLambdaEndpointContext` | type | Context for endpoint generation |
| `GenLambdaEndpointInput` | type | Input for endpoint generation |
| `genLambdaEndpoint` | function | Generate Lambda endpoint handler |
| `UnifiedApiGatewayEvent` | type | Unified V1/V2 API Gateway event |
| `createApiGatewayEventConversionMiddleware` | function | Converts API Gateway events |
| `createErrorHandlerMiddleware` | function | Handles errors |
| `IoLogTranslate` | type | Log translation type |
| `createIoLogMiddleware` | function | Logs input/output |
| `createOutputValidationMiddleware` | function | Validates output |
| `createTrailMiddleware` | function | Propagates trace IDs |
| `createValidationMiddleware` | function | Validates input |

### Key Characteristics
- Uses **Zod** for schema validation
- Exposes individual middleware functions
- Has `askLambdaEndpoint` to invoke other Lambdas
- Has `genLambdaEndpoint` as main endpoint generator
- Has `forApiGateway` adapter pattern
- Supports trace ID propagation via trail middleware
- Supports cache key generation

---

## 3. NOT PRESENT (gaps in sdk-aws-lambda)

| Gap | simple-lambda-handlers | Notes |
|-----|------------------------|-------|
| `HTTPStatusCode` | enum | HTTP status code constants (200, 204, 307, 308, 400, 403, 404, 418, 429, 500) |
| `Middy` type | type export | Re-export of `@middy/core` default type |
| `EventSchema` | type | Schema type (was Joi, would be Zod now) |
| `HandlerLogic` | type | Generic handler logic type signature |
| `LogMethods` | interface | `{ debug, error }` log interface |

---

## 4. RENAMED (mappings)

| simple-lambda-handlers | sdk-aws-lambda | Notes |
|------------------------|----------------|-------|
| `createApiGatewayHandler` | `genLambdaEndpoint` + `forApiGateway` | Split into composable pieces |
| `createStandardHandler` | `genLambdaEndpoint` | Direct Lambda-to-Lambda handler |
| `CORSOptions` | `CorsConfig` | Renamed and simplified |
| `ApiGatewayHandlerLogic` | (input/output via Zod schemas) | Logic type derived from schemas |
| `apiGatewayEventShapeNormalizationMiddleware` | `createApiGatewayEventConversionMiddleware` | Same purpose, different pattern |
| `badRequestErrorMiddleware` + `internalServiceErrorMiddleware` | `createErrorHandlerMiddleware` | Combined into single middleware |
| `ioLoggingMiddleware` | `createIoLogMiddleware` | Same purpose |
| `joiEventValidationMiddleware` | `createValidationMiddleware` | Joi -> Zod |
| `isV1APIGatewayEvent` / `isV2APIGatewayEvent` | `isV1ApiGatewayEvent` / `isV2ApiGatewayEvent` | Case change (API -> Api) |

---

## Summary

### Architectural Shift

**simple-lambda-handlers**: Monolithic handlers
- `createApiGatewayHandler({ logic, schema, log, cors })` returns complete handler
- `createStandardHandler({ logic, schema, log })` returns complete handler

**sdk-aws-lambda**: Composable blocks
- `genLambdaEndpoint({ input, output, logic, ... })` for Lambda-to-Lambda
- `genLambdaEndpoint({ ... }).with(forApiGateway({ cors }))` for API Gateway
- Individual middleware exported for custom composition
- `askLambdaEndpoint` to invoke other Lambdas with trace propagation

### Technology Shift
- **Validation**: Joi -> Zod
- **Error Handling**: Custom -> `helpful-errors` integration
- **Trace Propagation**: Not present -> Trail middleware with exid propagation
- **Cache Support**: Not present -> Cache key generation support

### What to Add
1. `HTTPStatusCode` enum - useful HTTP constant values
2. `LogMethods` interface - if needed for compatibility
3. `HandlerLogic` type alias - if needed for compatibility
