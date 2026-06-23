# invariant.badrequesterror-not-lambda-error

## .what

BadRequestError is NOT a lambda error. the lambda succeeded — it just told the caller their request was invalid.

## .why

### metrics and alarms

| error type | lambda status | cloudwatch | retry | alarms |
|------------|---------------|------------|-------|--------|
| BadRequestError | success | no error | no | no |
| internal error | failure | error log | yes | yes |

if BadRequestError triggers lambda failure, you get:
- false positive error metrics
- noisy alarms
- unwanted retries (caller's bad request won't improve on retry)

### the contract

```
caller sends bad request
→ lambda validates and detects constraint violation
→ lambda returns response object: { errorMessage, errorType: 'BadRequestError' }
→ lambda invocation SUCCEEDS (no FunctionError)
→ client receives response
→ client detects errorType: 'BadRequestError'
→ client throws BadRequestError (not LambdaInvocationError)
```

the round-trip preserves the semantic: caller fault, not server fault.

## .implementation

### handler side (genLambdaEndpoint)

```ts
// in catch block
const isBadRequest = decideIsBadRequestError({ error });
if (isBadRequest) {
  return {
    errorMessage: err.message,
    errorType: 'BadRequestError',
    stackTrace: err.stack,
  } as unknown as TOutput;
}
// internal errors rethrow
throw error;
```

### client side (askLambdaEndpoint)

```ts
// in asParsedResponse
if (parsed.errorType === 'BadRequestError') {
  throw new BadRequestError(parsed.errorMessage, { ... });
}
throw new LambdaInvocationError(parsed.errorMessage, { ... });
```

## .test coverage

both sides must be tested:
- handler returns response object for BadRequestError (no throw)
- handler throws for internal errors
- client throws BadRequestError when errorType matches
- client throws LambdaInvocationError for other error types

## .reference

pattern from ehmpathy/simple-lambda-handlers:
- `badRequestErrorMiddleware.ts` — returns response, does not throw
- `internalServiceErrorMiddleware.ts` — for API Gateway returns 500 response

