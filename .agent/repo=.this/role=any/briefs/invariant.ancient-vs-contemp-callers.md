# invariant.ancient-vs-contemp-callers

## .what

sdk-aws-lambda supports both ancient and contemp callers with backwards-compatible error responses.

## .why

### incremental upgrade support

services upgrade at different times. a new handler may receive calls from:
- **contemp callers** — send `{ event, trail: { exid } }` wrapper
- **ancient callers** — send raw `event` (no wrapper)

if handlers reject ancient payloads or return incompatible error responses, upgrades become all-or-none.

## .detection

| caller type | payload format | detected via |
|-------------|----------------|--------------|
| contemp | `{ event, trail }` | `getIsWrappedPayload` returns true |
| ancient | `{ ...event }` | `getIsWrappedPayload` returns false |

the `isContemporaryCaller` flag is stored in context by `genTrailMiddleware`.

## .error response format

| caller type | constraint error errorType | why |
|-------------|---------------------------|-----|
| contemp | `ConstraintError` | modern semantics |
| ancient | `BadRequestError` | backwards compat |

ancient callers expect `errorType: 'BadRequestError'` — to return `ConstraintError` would break their error handlers.

## .implementation

### trail middleware (detection)

```ts
const { isContemporaryCaller } = getUnwrappedEventWithExid({ payload });

request.context = {
  ...context,
  isContemporaryCaller,
};
```

### constraint error middleware (response)

```ts
const isContemporaryCaller = context.isContemporaryCaller ?? false;

const body = getErrorResponseBody({
  error,
  errorType: isContemporaryCaller ? 'ConstraintError' : 'BadRequestError',
});
```

## .test coverage

both caller types must be tested:

| case | payload | expected errorType |
|------|---------|-------------------|
| contemp | `{ event: { bad }, trail: { exid } }` | `ConstraintError` |
| ancient | `{ bad }` | `BadRequestError` |

## .deprecation path

once all callers upgrade to contemp format:
1. monitor for ancient caller traffic (no trail wrapper)
2. when traffic drops to zero, remove backwards compat
3. always return `ConstraintError`
