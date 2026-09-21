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

## .exception — a PROPER NOUN we do not own

the rule governs the terms **we choose**. a name someone else already assigned is a fact, and to
reword a fact is to state a falsehood:

| allowed | why |
|---|---|
| `LambdaClient`, `@aws-sdk/client-lambda` | the aws sdk's own name |
| `simple-lambda-client` | a published npm package. the incumbent this repo replaces |
| any third-party package, class, or api field that carries the word | we do not own the name |

🔴 **the test is OWNERSHIP, never spelling.** could you rename it and still be correct?

- **yes** → it is ours, and the rule binds. `legacyClient` → `ancientCaller`
- **no** → it is a proper noun, and to reword it breaks the reference. `simple-lambda-client`
  cannot become `simple-lambda-caller`, because no such package exists

⚠️ **and the ambiguity the rule exists to prevent does not arise here.** a proper noun names one
artifact; the harm `.why` describes is a *common* noun that reads four ways. so the exception is not
a concession — it is the rule's own scope, stated.

.note = raised at peer review r001 (`repo-rules`) of
`v2026_09_03.feat-absorb-handler-invoke-test-util`, which flagged `simple-lambda-client` across
three vision artifacts and offered both readings. the exception was implicit and now is not.

## .enforcement

- 'client' as a term **we chose** = blocker
- 'client' inside a proper noun we do not own = **false positive**
