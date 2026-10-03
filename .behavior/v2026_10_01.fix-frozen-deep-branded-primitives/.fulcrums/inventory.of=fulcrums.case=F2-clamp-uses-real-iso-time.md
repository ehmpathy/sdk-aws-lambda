# F2 — the clamp imports the real `IsoTimeStamp` via a pinned `iso-time` devDep

## the fork

- **A** — add `iso-time` as a pinned devDependency; the clamp imports `IsoTimeStamp`
- **B** — declare a local brand in the test (`string & { _dglo: 'iso-time.IsoTimeStamp' }`)

## taken: A, and why

- the wish names "a payload with an `IsoTimeStamp`"; the real type is the measured value
  (`rule.require.measure-the-value-you-emit`), a hand-built brand is a model of it
- `pnpm why iso-time` shows it only transitively (via `sdk-logs`, `test-fns`, …); pnpm does not
  hoist, so a test cannot import it without a direct entry
- devDep only — no consumer install changes. pin `1.11.7` (latest, `npm view iso-time version`)

## rework: clean

swap the import for a local brand; one line.

## confidence: 90%

## ✅ verdict — ruled by the wisher: keep the `iso-time` devDep