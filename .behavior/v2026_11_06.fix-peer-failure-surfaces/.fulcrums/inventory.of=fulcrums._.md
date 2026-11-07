# inventory.of=fulcrums

| case | title | rework | status | confidence |
|---|---|---|---|---|
| F1 | peer refusal class = `LambdaEndpointRefusedError extends MalfunctionError` | clean | open — the commander rules it on the pr | 80% |
| F2 | opt-in shape = `refusal: { as: 'ConstraintError' }` on the ask input | clean | open — the commander rules it on the pr | 70% |
| F3 | `viaApiGateway` 4xx gets the same class + opt | clean | ruled — in scope | 80% |
| F4 | `runLambdaEndpoint.onSerialized` keeps `ConstraintError` | clean | best-guessed | 88% |
| F5 | server fault logs two error lines (`handler.output` + extant `handler.error`) | clean | ruled — accepted | 75% |
| F6 | sqs perRecord consumer: a peer refusal now redrives | clean | ruled — accepted | 85% |
| F7 | version cut = `feat` → v0.8.0, not `break` → v1.0.0 | clean | best-guessed — listed in the pr body | 85% |
| F8 | an http 429 is a throttle, a `MalfunctionError` under either opt, never a refusal | clean | disputed — the commander rules it on the pr | 90% |
| F9 | wire and ask tests keep the `getIsConstraintError` predicate assert across domains | clean | disputed — for the council | 85% |
| F10 | the fault-side verdict stays four reads of `getIsConstraintError`; no `asFaultSideOfError` leaf yet | clean | best-guessed | 88% |
| F11 | an unknown `refusal` opt throws `MalfunctionError` (a `💥` header), the child of the `UnexpectedCodePathError` review r011 named | clean | best-guessed | 90% |
| F12 | snapshot render traits (bare-quote json, `X: X:` label, `Error:` label) stay as the repo renders them; a repo-wide render change is its own pr | clean | disputed — for the council | 88% |
| F13 | the generated fn's `options.refusal` is clamped at unit; no codegen journey runs a generated fn | clean | disputed — for the council | 88% |