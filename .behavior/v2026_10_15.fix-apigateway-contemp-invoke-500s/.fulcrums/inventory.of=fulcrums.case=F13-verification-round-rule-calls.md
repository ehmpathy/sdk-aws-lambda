# F13 — six rule calls the verification reviewers made, and why this change holds its ground

## .the fork

the verification round held the change against rules at the margin. six calls are open, and each is a
fork between *rework to the reviewer's call* and *keep what the change holds*.

| the reviewer's call | rework to it | keep |
|---|---|---|
| r1 blocker.1: `TrailCarrier` mashes two dimensions (`rule.forbid.names-that-mash-dimensions`) | rename the type to name the place alone | keep the name |
| r1 blocker.2 and blocker.3: `body as TResponse \| null` is a cast at a public boundary | a generic reader, or an exported narrow | keep the documented cast |
| r1 blocker.4: two deferred-defect docblocks in `genLambdaEndpoint.forApiGateway.ts` lead with the axis | rewrite both so the status leads | leave both |
| r1 nitpick.1: `asApiGatewayHeaders` mashes trigger and slot | rename to `asTrailExidHeaders` | keep the name |
| r1 nitpick.2: an absence claim in a `.note` has no recorded control | add a recorded grep | keep the note |
| four nitpicks: serde unit tests use `test()` under `describe()`, not `given/when/then` | rewrite 15 data-driven files | keep the data-driven form |

## .taken = keep, and why at the time

- **`TrailCarrier`**: the test in the rule is independence, *"never the count of parts"*, and the caveat
  names the pass: a part that qualifies the other and cannot vary alone is no mash. a carrier is what
  carries a trail; the sdk has no second item that a carrier carries, so `Trail` qualifies `Carrier`
  the way `Iso` qualifies `Price`. the discovery is persisted with the rejected names
  (`domain.terms/trail-carrier.md`), which is the rule's own remedy for a name that needs a gloss.
- **the cast**: the body comes off a network socket, an external boundary, which `rule.forbid.as-cast`
  allows when documented with the reason, the right type, and the removal path. the block is there
  (`.cast / .why / .removal`). the caller names the type by a generic, the endpoint validates its own
  output with a zod schema, and a generic reader `getOneBodyFromHttpText<TResponse>` moves the same cast
  one file down without a gain. a runtime schema option is the named removal path, added when a caller
  needs one (F8).
- **the deferred-defect docblocks**: both are on `main`, in lines this change did not touch (the diff of
  that file is the carrier constant, the stamp, and the cors append). a rewrite of prose outside the diff
  is the corpus-wide pass `rule.prefer.wickup-touched-prose` bounds: on contact, in scope.
- **`asApiGatewayHeaders`**: the wisher chose the name (F4: *"and asApiGatewayHeaders ?"*, then the
  decision). the rule's test asks whether the trigger and the shape vary independently; the wisher's
  view is that the cast is the api gateway's header form, with an sqs peer cast to follow as a separate
  operation.
- **the absence claim**: it has its control. `getOneTrailExidFromHeaders.test.ts` runs the three foreign
  headers (`x-amzn-trace-id`, `traceparent`, `x-request-id`) through the reader and expects `null`, and
  `genTrailMiddleware.carrierHeaders.test.ts` `[case3]` runs them through the middleware and expects
  ancient. the claim is a run, not the shape of a read.
- **the unit-test form**: the paved pattern for a transformer is the data-driven caselist
  (`rule.prefer.data-driven`: *"prefer data-driven caselist tests when possible, especially unit tests of
  transformers"*), and the given/when/then rule asks for `given/when/then` on an integration test and
  names a case-table as the other form. each flagged file is a pure transformer with a table. the files
  that hold a journey (`asCarriedPayload.test.ts`, `genTrailMiddleware.carrierHeaders.test.ts`,
  `asApiGatewayHeaders.test.ts`) use the full form.

## .rework = clean

a rename is a `sedreplace` across the repo; the cast move is one file; the docblock rewrite is two
paragraphs; the test rewrite is mechanical. none ripples into a caller's contract except the two renames,
which would break a name the wisher chose (`asApiGatewayHeaders`) or a public type.

## .confidence = 70%, low because

- a reviewer reads rules at the margin and the calls shift between rounds; this round raised four new
  blockers on a file that raised one last round
- the `TrailCarrier` name is mine, and the wisher has not decided on it

## .verdict

open — for the fulcrum council, except one call.

- **`asApiGatewayHeaders` is ruled: renamed to `asTrailExidHeaders`** (the wisher, 2026-10-16). the
  reviewer's alternative wins on one fact: the output is a plain `{ 'x-trail-exid': string }` record that
  api gateway v1 and v2, an alb, and a function url all take, so the trigger in the name was narrower than
  the function. the name now says what it emits, and leaves room for an sqs peer cast. the rename is
  complete in code, tests, readme, the vision, the yields and the dream; the review record under
  `.reviews/` keeps the old name as written.
