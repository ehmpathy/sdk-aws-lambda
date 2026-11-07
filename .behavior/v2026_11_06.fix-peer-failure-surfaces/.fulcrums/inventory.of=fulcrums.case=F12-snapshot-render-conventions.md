# F12 — snapshot render traits stay as the repo renders them; a repo-wide change is its own pr

- **fork**: (a) change how this pr's snapshots render: escape embedded json, drop the doubled class label, give every error one label form · (b) keep the render the repo already uses, and catch the repo-wide change as a dream
- **taken**: (b). review r006 names three traits. each comes from a tool, not from this pr:
  - bare quotes in an embedded json string: jest prints a string with `escapeString: false` by default. no `jest*.config.*` sets `snapshotFormat`. the same render is in snap files this pr never touched: `publicSurfaceShapes`, `asLambdaEvent`, `getIsWrappedPayload`, `genTrailMiddleware`, `genConstraintErrorMiddleware`, `logSqsRecordRefused`
  - `[X: X: …]`: jest labels an error by `.name`, and the message also opens with the class. `LambdaEndpointError` renders this way on origin/main (`getParsedResponse.test.ts.snap`, 6 extant exports). `LambdaEndpointRefusedError` sets `.name` the same way, because the api gateway chain and aws label an escaped throw by `.name` (#75). an `Error` name would make `errorType` read `Error`
  - `[Error: ✋ ConstraintError: …]` beside `[LambdaEndpointError: …]`: helpful-errors leaves `.name` as `Error` and puts the glyph and class in the message. `getParsedResponse.test.ts.snap:82` has this on origin/main
- **why not (a) here**: a `snapshotFormat` change or a custom serializer rewrites every snap file in the repo. that is a ripple out of this wish's scope (`rule.prefer.wickup-touched-prose`: a corpus-wide rewrite in an unrelated change is a blocker). a per-file change would make this pr's snaps render unlike every other snap, and that inconsistency is what the review objects to
- **where**: every `*.snap` the pr adds or edits
- **rework**: clean. a repo-wide `snapshotFormat: { escapeString: true }` (or a json-body serializer) is one config line plus a `--resnap`, with no code change. caught as `.dream/2026_11_07.snapshot-render-of-embedded-json.dream.md`
- **confidence 88%, why not higher**: the wire body is what a caller receives, so a reader may hold that this pr is the right moment. the counter: the render is a test-view trait. the bytes a caller receives are valid json, and `JSON.parse` of `outcome.result.body` holds in each case that reads it
- **raised by**: peer review i001 r006 (`ergo-snapshot-visual-blemishes`) blocker.1, blocker.2, blocker.3
- **verdict**: disputed — for the council
