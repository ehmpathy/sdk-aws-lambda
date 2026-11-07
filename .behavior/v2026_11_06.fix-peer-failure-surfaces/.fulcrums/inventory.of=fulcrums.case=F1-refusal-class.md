# F1 — the class a peer refusal surfaces as

- **fork**: (a) `MalfunctionError` · (b) new `LambdaEndpointRefusedError extends LambdaEndpointError` · (c) `LambdaEndpointError` with `errorType: 'ConstraintError'` · (d) new `LambdaEndpointRefusedError extends MalfunctionError`
- **taken**: (d). distinct by class (the wish's first ask), a `MalfunctionError` (the wish's second offer), so every consumer family reads it as a server fault. keeps the peer verdict on metadata as `errorType`
- **why (d) over (b)**: the http road (`viaApiGateway`) has no `LambdaEndpoint` to carry, so a `LambdaEndpointError` parent would force a fake endpoint into its metadata. one class must serve both roads (F3)
- **cost of (d)**: an extant `catch (e) { if (e instanceof LambdaEndpointError) … }` no longer catches a refusal. it caught a `ConstraintError` before this change either, so no extant catch loses a case it held
- **name**: `refused` already means "an endpoint declined a request as a caller fault" here (`logSqsRecordRefused`, `sqs.record.refused`), so the word keeps one sense
- **rework**: clean — swap the parent class in one file (`LambdaEndpointRefusedError.ts`); the throw sites build it through `asErrorFromPeerRefusal`
- **confidence 80%, why low**: the parent choice is taste between (b) and (d); a public name, so the commander rules it on the pr
- **where**: `src/domain.objects/LambdaEndpointRefusedError.ts` (new), `src/domain.operations/lambdaEndpointWire/error/asErrorFromPeerRefusal.ts` (new), `getParsedResponse.ts`, `asErrorFromHttpResponse.ts`
- **verdict**: open — the commander rules it on the pr
