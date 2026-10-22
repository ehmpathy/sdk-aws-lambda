# F1 — name guard registered on every family

- **fork**: register the `.name` guard on every family (forAsk, forApiGateway, forSqs) · or only where a throw escapes to the runtime (forSqs, plus forAsk server faults)
- **taken**: every family. one shape across families; a per-family exception is the fork `rule.forbid.parallel-codepaths` warns of. on forApiGateway the guard is a no-op (every fault is answered as a 400/500), so the cost is one idle hook
- **rework**: clean — drop one array entry
- **confidence**: 90% — low only because forApiGateway gains a hook with no live branch
- **where**: the three middleware arrays
- **verdict**: (unruled)
