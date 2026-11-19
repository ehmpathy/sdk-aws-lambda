# F10 — the fault-side verdict stays four reads of one predicate

- **fork**: (a) lift one `asFaultSideOfError` leaf now, read by the 400/500 middlewares, the log level, and the sqs ack · (b) leave the four sites on `getIsConstraintError` until a third verdict appears
- **taken**: (b). the four sites agree today through one shared predicate, so no drift is possible yet. the one new verdict this pr adds, the 429 throttle, sits on the ask side (`getIsHttpThrottle`) and casts to a class each site already reads. a leaf with two outcomes would rename the predicate, not unify a decision (`rule.prefer.wet-over-dry`)
- **where**: `genConstraintErrorMiddleware`, `genInternalServiceErrorMiddleware`, `asLogMethodOfFailure`, `asCallerFault`
- **rework**: clean. one new leaf, four call sites swap their read; no contract or caller changes
- **confidence 88%, why not higher**: the reviewer is right that a third verdict would have to reach all four; the call is only about when
- **raised by**: peer review r11 (enroll-impl-arch-defects) nitpick.4, round i005, framed as a note
- **verdict**: best-guessed
