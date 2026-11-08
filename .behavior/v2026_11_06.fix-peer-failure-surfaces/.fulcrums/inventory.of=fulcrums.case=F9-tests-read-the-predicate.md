# F9 — wire and ask tests read `getIsConstraintError` across domains

- **fork**: (a) keep the cross-domain test imports of `getIsConstraintError` (and `asErrorFromPeerRefusal` in `forApiGateway.test`) · (b) cut them: assert the class only, and build the refusal in `forApiGateway.test` from the public surface
- **taken**: (a). the claim these tests make is "no consumer family reads it as a caller fault". `getIsConstraintError` is the one function every family reads, and it checks the `.name` and the prototype chain, so a class assert alone would pass on an error that a family still reads as a constraint. each predicate assert already sits beside a class assert (`not.toBeInstanceOf(ConstraintError)`). in `forApiGateway [case29]` the point is that the chain meets exactly what an ask road throws, so the test uses the ask roads' own cast
- **where**: `getParsedResponse.test.ts`, `asErrorFromPeerRefusal.test.ts`, `asErrorFromHttpResponse.test.ts`, `genLambdaEndpoint.forApiGateway.test.ts`, `genLambdaEndpoint.forSqs.perRecord.test.ts`
- **rework**: clean. delete the predicate lines (the class asserts stay) and swap the cast for `new LambdaEndpointRefusedError(...)`; test files only, no prod import changes
- **confidence 85%, why not higher**: the edge is test-only, so no runtime cycle exists. but a move of `getIsConstraintError` would now touch five test files; a lift to a shared home would remove that, and only a second prod reader would justify the lift (`rule.prefer.most-common-denominator`)
- **raised by**: peer review i003, r5 (arch-smell-scopeleaks) nitpick.1. r11 (l3 arch-defects) item 7 concurs: the predicate stays where the family behavior is the claim
- **verdict**: disputed, for the council
