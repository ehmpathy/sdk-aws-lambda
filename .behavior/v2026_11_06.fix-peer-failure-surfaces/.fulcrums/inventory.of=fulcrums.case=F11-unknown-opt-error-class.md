# F11 — an unknown `refusal` opt throws `MalfunctionError`, the child of the class the peer review named

- **fork**: (a) keep `UnexpectedCodePathError`, as peer review r011 asked, after the `asLambdaEndpoint` bad-slug precedent · (b) throw its subclass `MalfunctionError`
- **taken**: (b). helpful-errors gives a `💥` emoji only to `MalfunctionError`, so the parent prints a bare `UnexpectedCodePathError:` header. a developer with a typo in the opt reads that header first (`rule.require.qualified-error-headers`). (b) keeps all the review asked for: the class is still an `UnexpectedCodePathError`, `getIsConstraintError` stays false, and the `options` and `hint` metadata are unchanged. the test asserts both classes and the `💥 MalfunctionError:` header. reverted to the parent class, 6 of 10 go red
- **where**: `asLambdaEndpointRefusal.ts`, `asLambdaEndpointRefusal.test.ts` and its snapshot
- **rework**: clean. one throw, one import, one snapshot
- **confidence 90%, why not higher**: it parts from the `asLambdaEndpoint` precedent that review cited. that peer operation keeps the bare parent until the caught dream `2026_11_07.glyph-the-unexpected-code-path-headers` moves it too
- **raised by**: 5.3 self review `has-ergonomics-validated`
- **verdict**: best-guessed
