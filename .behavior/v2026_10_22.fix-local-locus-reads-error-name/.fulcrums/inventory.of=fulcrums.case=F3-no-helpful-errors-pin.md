# F3 — no helpful-errors pin

- **fork**: pin helpful-errors to the peer tree via pnpm link / patch (wish done #3) · or let the in-sdk guard carry clamp 2 on the released 1.7.3
- **taken**: no pin. the peer tree `helpful-errors.beav.fix-error-name-from-class` holds no `.name` assignment yet, so a pin would buy naught; the guard makes clamp 2 green on 1.7.3, and a later bump to the fixed helpful-errors turns the guard into a no-op for those classes
- **rework**: clean — a later dependency bump, no code change here
- **confidence**: 90%
- **where**: package.json (untouched)
- **verdict**: (unruled)
