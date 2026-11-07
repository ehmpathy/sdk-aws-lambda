# F3 — the http road gets the same contract

- **fork**: (a) fix `viaInvoke` only, as the issue's file cites · (b) also `viaApiGateway`'s 4xx
- **taken**: (b). `viaApiGateway` promises "one catch block, whichever road it took" (`askLambdaEndpoint.viaApiGateway.ts:15`); a fix on one road splits that contract (rule.require.consistent-variant-contracts)
- **rework**: clean — revert one branch in `asErrorFromHttpResponse.ts`
- **confidence 80%, why low**: a 4xx on http includes gateway-level answers (404 route miss, 429 throttle) that are not a peer handler's verdict; a 404 becomes a refusal too. a 429 is carved out as a throttle (F8)
- **where**: `src/domain.operations/askLambdaEndpoint/serde/asErrorFromHttpResponse.ts`
