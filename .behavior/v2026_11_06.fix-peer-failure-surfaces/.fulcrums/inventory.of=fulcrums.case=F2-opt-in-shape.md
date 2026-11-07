# F2 — the shape of the pass-through opt-in

- **fork**: (a) `refusal: { as: 'ConstraintError' | 'LambdaEndpointRefusedError' }` on the ask input · (b) a boolean `passthrough: true` · (c) a context-level option
- **taken**: (a). per call site, where the author knows whose request it is; a named value over a boolean (rule.require.explicit-optout); input, never context, since it shapes this call's result
- **rework**: clean — the key name and value set touch one input type and one transformer arg
- **confidence 70%, why low**: key name `refusal` is invented, no precedent searched beyond `struct.payload`; the wisher may prefer it nested under `struct`
- **where**: `askLambdaEndpoint.viaInvoke.ts`, `askLambdaEndpoint.viaApiGateway.ts`, threaded to the hydration via `executeLambdaInvocation`
