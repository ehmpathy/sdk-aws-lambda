# F4 — `runLambdaEndpoint.onSerialized` keeps `ConstraintError`

- **fork**: (a) the shared hydration changes for every caller · (b) the hydration takes the refusal class as input; `onSerialized` passes `ConstraintError`, the ask roads pass the caller's opt
- **taken**: (b). `onSerialized` advertises "a caller fault THROWS ConstraintError" (`runLambdaEndpoint.onSerialized.ts:42,78`); its caller is the test author, who composed the event and can fix it. no peer stands between
- **rework**: clean — flip one argument
- **confidence 88%**: a test author might also want to assert the consumer view; that is what `askLambdaEndpoint` itself gives
- **where**: `getParsedResponse.ts` input, `runLambdaEndpoint.onSerialized.ts:276`, `executeLambdaInvocation.ts:84`
