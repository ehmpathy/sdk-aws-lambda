# F10 — the moved transformer suites keep their data-driven form

## .the fork

six `record/` unit suites (`getAllRecordIdsRetried`, `getAllRecordIdsUnclaimable`, `getAllRecordSuccessRefsMalformed`, `isRecordSuccessRef`, `asRecordBatchResponse`, `asRecordIds`) state their cases as `TEST_CASES.map((thisCase) => test(thisCase.description, …))`.

- **convert**: wrap each table in `given` / `when` / `then`
- **keep**: leave the data-driven caselist

## .taken — keep

- the form is sanctioned, not a lapse: `rule.prefer.data-driven` (mechanic) reads *"prefer data-driven caselist tests when possible, especially unit tests of transformers"*, and its example is exactly `TEST_CASES.map(thisCase => test(thisCase.description, …))`. each of the six is a pure transformer
- `rule.require.given-when-then` marks given/when/then as recommended for unit tests, required for integration. both reviewers graded it a nitpick for that reason
- each suite moved from `forSqs/` with line-count parity (`has-preserved-test-intentions`); a reshape in the same diff would hide whether a case changed in the move

## .rework — clean

a mechanical wrap of six files, no assertion changed.

## .confidence — 93%

two rules point two ways; the more specific one (transformers) is followed.

## .verdict

open, to the council.
