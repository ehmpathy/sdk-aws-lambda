# F09 — snapshots keep jest's default printer

## .the fork

`record/__snapshots__/logRecordRefused.test.ts.snap` renders a recorded body as `"body": "{"orderId":"o-1",…}"`: jest prints a string inside an object with its inner quotes unescaped.

- **escape it**: set `snapshotFormat: { escapeString: true }` in the jest configs, or re-render this one test
- **leave it**: keep jest's default printer

## .taken — leave it

- the line is unchanged from main: `git show HEAD:…/forSqs/__snapshots__/logSqsRecordRefused.test.ts.snap` carries the same `"body": "{"orderId":…` line. the move to `record/` carried it over byte for byte
- no jest config here sets `snapshotFormat` (`grepsafe 'snapshotFormat|escapeString' --glob 'jest*.config.ts'` → 0), so this is the default printer (jest 29+ ships `escapeString: false`)
- the render is repo-wide: `grepsafe ': .\{.[a-zA-Z]+.:' --path src --glob '*.snap'` → 39 lines of embedded json, all in this form. a fix in one file would make it the one odd render
- a config flip rewrites every such snapshot in the repo, a change no reader of this pr would expect under "event-source symmetry"

## .rework — clean

one line per jest config, then `--resnap`. no caller depends on the printer.

## .confidence — 93%

the reviewer is right that the line reads poorly. the question is scope, not truth.

## .verdict

open, to the council. if ruled to escape, it lands repo-wide in its own pr.
