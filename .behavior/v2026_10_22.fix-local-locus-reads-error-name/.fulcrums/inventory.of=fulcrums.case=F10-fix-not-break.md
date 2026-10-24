# F10 — the sqs change ships as a `fix`, not a `break`

## .the fork

- **A, taken**: `fix(endpoint): …` — a patch release
- **B**: `break(endpoint): …` — a major release, since a consumer's refusal test flips (case=6) and a malformed message no longer dead-letters

## .taken, and why at the time

the human called the redrive "a regression … we need this fixed immediately". the behavior restores the predecessor's contract (`simple-lambda-handlers`) and the repo's own `invariant.badrequesterror-not-lambda-error` ("retry: no"), so the redrive was the defect and its repair is a fix. no type, signature, or config changes; a handler compiles and runs unchanged.

## .rework — clean

one commit header, before the release.

## .confidence — 80%, and why it is low

the observable contract does change: a test that asserted a rejection goes red, and a team that counted on the dead-letter queue to hold malformed messages loses them. strict semver calls that a break. the commander may prefer B, so the PR body names the change in its first lines either way.

## .where

the commit header and the PR title

## .verdict

ruled — A, by the human, 2026-10-22: "its gonna be a patch still". the PR body still names the behavior change in its first lines.
