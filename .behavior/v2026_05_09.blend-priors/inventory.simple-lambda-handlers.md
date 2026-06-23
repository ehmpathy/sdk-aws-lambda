# simple-lambda-handlers Public Exports Inventory

Source: https://github.com/ehmpathy/simple-lambda-handlers

## Functions

### createApiGatewayHandler

Factory function that creates AWS Lambda handlers for API Gateway events with middleware support.

```typescript
createApiGatewayHandler<I, O, IH>({
  logic: ApiGatewayHandlerLogic<I, O, IH>;
  schema: EventSchema;
  log: LogMethods | { methods: LogMethods; input?; output? };
  cors?: CORSOptions;
  deserialize?: { body: boolean };
}): middy.Middy<...>
```

### createStandardHandler

Factory function that creates standard AWS Lambda handlers with middleware support.

```typescript
createStandardHandler<I, O>({
  logic: HandlerLogic<I, O>;
  schema: EventSchema;
  log: LogMethods | {
    methods: LogMethods;
    input?: (event: I) => Record<string, any>;
    output?: (result: O) => Record<string, any>;
  };
}): middy.Middy<I, O, Context>
```

## Types

### HandlerLogic

Generic type that represents an async Lambda handler function.

```typescript
type HandlerLogic<I, O, C = Context> = (event: I, context: C) => Promise<O>
```

### ApiGatewayHandlerLogic

Generic type that extends HandlerLogic with API Gateway-specific input/output shapes.

```typescript
type ApiGatewayHandlerLogic<I, O, IH>
```

Input includes:
- `httpMethod`
- `headers` (IH)
- `body` (I)
- `path`
- `isBase64Encoded`
- `pathParameters`
- `queryStringParameters`

Output includes:
- `statusCode` (HTTPStatusCode)
- `headers` (optional)
- `multiValueHeaders` (optional)
- `body` (O)

Context: `APIGatewayEventRequestContext | APIGatewayEventRequestContextV2`

### EventSchema

Type alias for Joi's `Schema` type, used for event validation.

```typescript
type EventSchema = Schema // from Joi
```

### LogMethods

Interface that defines required log methods.

```typescript
interface LogMethods {
  debug: (message: string, ...meta: any[]) => void;
  error: (message: string, ...meta: any[]) => void;
}
```

### CORSOptions

Interface that specifies CORS behavior configuration.

```typescript
interface CORSOptions {
  origins: '*' | string[];
  withCredentials: boolean;
  headers?: string; // defaults to 'content-type,authorization'
}
```

### Middy

Re-exported from `@middy/core` - the Middy middleware type.

```typescript
type Middy // from @middy/core
```

## Enums / Constants

### HTTPStatusCode

Enum that provides commonly-used HTTP status codes.

```typescript
enum HTTPStatusCode {
  SUCCESS_200 = 200,
  SUCCESS_204 = 204,
  REDIRECTION_307 = 307,
  REDIRECTION_308 = 308,
  CLIENT_ERROR_400 = 400,
  CLIENT_ERROR_403 = 403,
  CLIENT_ERROR_404 = 404,
  CLIENT_ERROR_418 = 418,
  CLIENT_ERROR_429 = 429,
  SERVER_ERROR_500 = 500,
}
```

## Classes

None exported.

## Summary

| Category   | Count | Items                                                                                           |
|------------|-------|-------------------------------------------------------------------------------------------------|
| Functions  | 2     | createApiGatewayHandler, createStandardHandler                                                  |
| Types      | 6     | HandlerLogic, ApiGatewayHandlerLogic, EventSchema, LogMethods, CORSOptions, Middy               |
| Enums      | 1     | HTTPStatusCode                                                                                  |
| Classes    | 0     | -                                                                                               |
| **Total**  | **9** |                                                                                                 |
