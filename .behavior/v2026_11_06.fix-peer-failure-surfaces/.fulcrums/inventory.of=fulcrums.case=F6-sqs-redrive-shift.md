# F6 — an sqs consumer now redrives on a peer refusal

- **fork**: accept the shift, or special-case sqs to keep the acknowledgement
- **taken**: accept. the consumer composed the request, so the refusal is the consumer's fault, and the dead-letter queue "is for our faults" (`invariant.constraint-errors-never-redrive-sqs`). its `.the bound` row ("a `ConstraintError` it caught from a downstream call … reads exactly as a refusal") gets revised: a downstream refusal now arrives as `LambdaEndpointRefusedError` unless the handler opts into pass-through
- **rework**: clean — the opt in F2 is the per-call escape
- **confidence 85%**: a consumer that relied on the silent delete now sees redrives; that is the visibility the wish asks for
- **where**: invariant brief only; no sqs code changes
