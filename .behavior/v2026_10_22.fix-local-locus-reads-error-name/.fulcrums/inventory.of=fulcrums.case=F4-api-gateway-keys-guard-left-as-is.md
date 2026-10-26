# F4 — the api gateway `keysOfResponseOnwire` guard is left as it stands

- **fork**: widen `getAllResponseOnwireKeysFound` to take `unknown` (or add a named cast) in this pr · or leave the pre-extant inline `typeof response === 'object' && response !== null ? … : []` for its own change
- **taken**: leave it. the hunk predates this pr; the pr adds one middleware entry to `forApiGateway`'s array and touches no line of `logic`. a widen of `getAllResponseOnwireKeysFound` changes a shared transformer's contract and its tests — a ripple outside #73's scope (rule.always.fix-forward-under-scouts-honor: safe, but not clean)
- **rework**: clean — a one-file follow-up whenever the api gateway family is next touched
- **confidence**: 90%
- **where**: `genLambdaEndpoint.forApiGateway.ts`, `logic`
- **raised by**: 5.1 peer review, mech-decode-friction nitpick 2
- **verdict**: (unruled)
