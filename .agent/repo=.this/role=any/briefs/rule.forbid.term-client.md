# rule.forbid.term-client

## .what

forbid usage of term 'client' in this codebase. only two terms exist: **caller** and **server**.

## .why

'client' is ambiguous — it could mean:
- the code that calls a lambda (caller)
- the aws sdk client object
- a customer/user
- a downstream service

'caller' and 'server' are unambiguous:
- **caller** = the code that invokes the lambda
- **server** = the lambda handler that processes the request

## .scope

- code: variable names, function names, type names, comments
- docs: markdown, briefs, prompts
- logs: error messages, debug output

## .alternatives

| 👎 forbidden | 👍 alternative |
|--------------|----------------|
| client | caller |
| isClient | isCaller |
| clientVersion | callerVersion |
| clientError | callerError |
| legacyClient | ancientCaller |
| modernClient | contempCaller |

## .exception

`LambdaClient` from `@aws-sdk/client-lambda` is allowed — it's the aws sdk's name.

## .enforcement

'client' usage (except aws sdk) = blocker
