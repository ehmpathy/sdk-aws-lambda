# F18 — the refusal's message carries its metadata as a json blob, beside `details`

## .the fork

- **A** (shipped) the event-source acceptance snap pins the refusal body as the sdk emits it today:
  `error.message` is the helpful-errors message (headline, a blank line, then the metadata
  `{ issues, hint }` as pretty json), and `error.details` holds the same metadata, structured
- **B** (ergo-snapshot-visual-blemishes, 5.3 i001 blocker.1) drop the blob from `message`, keep it
  only in `details`, or mask it in the snapshot

## .taken: A

- the blob is the sdk's wire format for every refusal on every family, not a choice of this wish.
  it is pinned on `main` in six extant acceptance snaps (`grepsafe 'send a value that satisfies'
  --path blackbox/__snapshots__` → `local.askApiGateway`, `local.sqsQueue`, `deployed.awsLambda`,
  `local.payloadCompat`, `local.sdkContract`, `local.httpResponse`), so B is a contract change to
  every caller's error text
- a mask would hide the real bytes a caller reads, which the snapshot exists to show; the
  snapshot rule denies volatile values only (`rule.require.snapshots-deny-volatile-not-allow-expected`),
  and this value is stable
- the operator's warn line already bounds it: `logLambdaEventRefused` keeps only the headline

## .for B, fairly

the reader meets the same issues three times in one body, and the blob's key order (`path,
message, code`) differs from the sorted `details`. a headline-only `message` reads cleaner, and
`details` already carries the structure for a machine.

## .rework: clean, but wide — a change to how the sdk frames a refusal message, in one place, plus
every acceptance snap that pins it; it belongs in its own wish, not this one

## .risk: low — no credential, no prod write; a caller that matches on message text would see a
shorter string

## .confidence: 85%, why not higher

B is the better shape; only scope holds A here.

## .where

- `blackbox/__snapshots__/local.eventSourceSchema.acceptance.test.ts.snap` [case6]
- the refusal frame, shared by every family

## .verdict

open — best-guessed; the council rules at close.
