# F21 — the case-list unit tests keep the data-driven shape

## the fork

`mech-given-when-then` (5.3 i001 r007, nitpick.1) asks the eight new table-driven unit suites of pure transformers to move from `describe` + `TEST_CASES.map(test)` to `given` / `when` / `then`.

| option | for | against |
|---|---|---|
| **keep the case list** (taken) | `rule.prefer.data-driven` (mechanic) prescribes exactly this shape: "prefer data-driven caselist tests … especially unit tests of transformers", and its example is `describe` + `TEST_CASES.map((thisCase) => test(thisCase.description, …))`. every one of the eight is a pure transformer. main already uses this shape for its pure transformers (`isTrailExid`, `getOneTrailExidFromHeaders`, `asHttpMethod`, `asErrorFromHttpResponse`, `asCorsHeadersWithTrail`, and others: `grepsafe 'TEST_CASES' --path src --glob '*.test.ts'` → 22 suites) | `rule.require.given-when-then` lists unit tests as "recommended" for bdd; the forSqs event-shape peers (`asSqsHeadersOnwire`, `getIsSqsEvent`) use `given` |
| wrap each row in `given` / `then` | one frame across every suite | each row becomes a `given` with one `then` and no `when`: the act is the same call on every row, so the frame adds no step and restates the description |

## taken, and why at the time

kept. the two rules overlap at unit grain, and the more specific one, about case lists of transformers, names this shape outright. the bdd rule's own text grades unit tests as recommended, while the case-list rule is a direct prescription for this kind of test.

## rework

clean — a mechanical rewrap of eight files, with no behavior change, if the wisher prefers bdd here.

## confidence — 88%, and why it is not higher

two booted mechanic rules speak to the same files; this reads the specific one as the tie-breaker, which a reviewer may weigh the other way.

## where

`asCallerFault.test.ts` · `asSqsBatchResponse.test.ts` · `asSqsRecordIds.test.ts` · `getAllSqsIdsRetried.test.ts` · `getAllSqsIdsUnclaimable.test.ts` · `getAllSqsSuccessRefsMalformed.test.ts` · `isSqsSuccessRef.test.ts` · `asErrorTypeOfErrorLike.test.ts`

## verdict

open — for the fulcrum council.
