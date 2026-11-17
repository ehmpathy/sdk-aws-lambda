# F13 — the generated fn's `options.refusal` is clamped at unit, not by a codegen journey that runs it

- **fork**: (a) a codegen acceptance journey compiles the generated files in a temp dir and runs a generated fn against a real peer · (b) the unit `asMechanismFnSource [case1][t1]` transpiles the emitted fn and runs it against a fake ask, and the codegen journeys snapshot the source
- **taken**: (b). no codegen journey runs any generated fn today, success included: each one generates, reads and snapshots files. a journey that runs one must import `sdk-aws-lambda` from a temp dir and compile ts there, a new harness for every generated fn. the slot this pr adds is one parameter and one passed key, and the unit run proves both reach the ask (pass-through dropped → 2 red)
- **where**: `src/domain.operations/genServiceSdk/gen.mechanism/asMechanismFnSource.test.ts [case1][t1]`; `blackbox/local.codegen*.acceptance.test.ts` snapshots
- **rework**: clean. a new journey file beside the codegen ones; no shipped code moves
- **confidence 88%, why not higher**: a run through the generated files would also catch a defect in the import line `asMechanismsFileSource` emits, which the unit run does not load
- **raised by**: peer review r10 (enroll-verif-snapshot-coverage) nitpick.4, round i004
- **verdict**: disputed — for the council
