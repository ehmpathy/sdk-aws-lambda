# F2 — the guard fills `.name` only when it is inherited, never an own choice

- **fork**: overwrite `.name` with `constructor.name` always · or only when `.name === 'Error'` · or only when no own `.name` exists and the inherited one is `'Error'`
- **taken**: no own `.name`, and the inherited one is `'Error'`. a class or thrower that set its own `.name` (aws's `CredentialsProviderError`, a subclass that opts into `'ConstraintError'`, a thrower that chose `'Error'`) declared its wire label, and the guard must not overrule it. the own-property test also keeps the guard off a non-configurable own `name`, which `defineProperty` would refuse with a throw. the value test alone could not tell an own `'Error'` from the prototype's (5.1 peer review, arch-hazards-maintenance nitpick 2)
- **rework**: clean — one condition
- **confidence**: 93%
- **where**: `genErrorNameMiddleware.ts`, `genErrorNameFromClass`
- **verdict**: (unruled)
