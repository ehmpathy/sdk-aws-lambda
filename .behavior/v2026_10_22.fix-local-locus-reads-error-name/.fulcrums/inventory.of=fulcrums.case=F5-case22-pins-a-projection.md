# F5 — `[case22]` pins a projection of the hydrated error, never its full message

## .the fork

- **A, taken**: snap `{ class, isCallerFault, messageNamesCause, wireLabel }` per throw
- **B**: run `[t1]`–`[t3]` on `CONTEXT_PINNED`, and snap the full hydrated `message` beside the projection, as `[t8]` does (ergo-friction-hazards i003 nitpick.1)

## .taken, and why at the time

the server-fault cases hydrate a `LambdaEndpointError` whose metadata holds the wire `stackTrace` (`getParsedResponse.ts:131-135`). helpful-errors folds metadata into `.message` (`HelpfulError.js:42-48`, `JSON.stringify(metadataForMessage)`). so the full message holds the handler's stack paths and line numbers. a pinned exid steadies none of those, so B would pin volatile bytes, or need a denylist rewrite of the message. `[t8]` can pin its message because a caller fault hydrates a `ConstraintError` with no stack in its message. the prefix and separator are the hydration's contract, and `getParsedResponse.test.ts` already pins them.

## .rework — clean

one test file. B is an added `then` with a stack-path denylist over the message; no other code leans on the choice.

## .confidence — 88%, and why it is low

the projection is the right grain for a locus-agreement clamp, but the rows have not been measured locally (keyrack refusal). a reviewer who wants the bytes visible in the diff could fairly prefer B plus a denylist.

## .where

`src/domain.operations/runLambdaEndpoint/runLambdaEndpoint.onSerialized.integration.test.ts [case22]`

## .verdict

open — for the council.
