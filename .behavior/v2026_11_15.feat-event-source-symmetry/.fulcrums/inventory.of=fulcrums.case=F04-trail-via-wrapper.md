# F04 — new families read no trail carrier; each invoke mints a fresh trail

- fork: build the `MessageAttributes` trail lift for sns now, reuse the wrapper carrier as `forSqs` does, or declare no carrier
- taken: a third carrier, `none`. `forSns` and `forKinesis` read no trail, and each invoke mints a fresh `exid`
- why: `invariant.ancient-vs-contemp-callers` blocks a NEW aws-delivered family that honors the `{ event, trail }` wrapper; only `forSqs` holds that exemption, as named debt. its table already gives kinesis carrier `none`, and gives sns a `MessageAttributes` carrier that is unbuilt. `none` matches both as they stand today, and the runner then hands the event untouched, as aws does
- revised: the vision guessed `wrapper`. execution found the invariant's blocker line, so the guess flipped before any code shipped
- rework: clean. one carrier constant per family; the sns lift replaces `none` with a header carrier later
- confidence: 94% — the invariant settles it; the residue is a word choice: `none` as a named carrier versus the absence of one
- where: `TrailCarrier`, `genTrailMiddleware`, `asCarriedPayload`, each new family's carrier constant
- verdict: best-guessed, settled against the invariant
