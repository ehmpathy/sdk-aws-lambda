# F13 — release on the aws docs samples; the real-delivery capture stays a dream

## .the fork

- **A** release with the aws docs samples as the verification floor; the captured sns / kinesis
  delivery (vision case=7 t4) stays a dream until the infra can be declared
- **B** provision an sns topic, a kinesis stream, their links to an echo lambda, and invoke grants
  in the demo account outside `declastruct-aws`, capture one delivery per source, commit them as
  fixtures, then release
- **C** add the absent classes to `declastruct-aws` upstream first (subscription, lambda
  permission, kinesis stream, event source link), then provision as code, capture, release

## .the tension

two peer reviewers (behavior-intent-coverage blocker.2, ergo-friction-hazards blocker.1) grade the
deferral a blocker under `philosophy.verification-strictness` and
`rule.require.external-contract-integration-tests`. each one names B or a director-sanctioned
exception as the exits.

## .taken: A, until the wisher rules

- the wish's bar is "tested against real aws sample events". the vision set the docs samples as
  the floor and a capture as the target (goals row), so A meets the wish and B / C raise the grade
- this repo provisions its demo account through `declastruct-aws` only
  (`howto.provision-demo-infra`). no release declares the set a capture needs: installed `1.5.2`
  has 35 classes, no sns / kinesis / sqs. upstream `1.13.0` adds `DeclaredAwsSnsTopic` only
  (controls: `*Lambda*` → 8, `*Subscription*` → 1)
- B is cloud infra outside the iac, and C is another repo's release. both are scope calls a
  driver may not make
- the one contested key (F10, the cert url key: `URL` vs `Url`) is optional, so either form parses
  today. a capture would settle which one aws sends; no consumer breaks in the meantime

## .rework: clean — a capture adds fixtures and cases beside the docs samples; no contract moves

## .risk: risky — B and C act with aws credentials in the demo account

## .confidence: 60%, why low

two reviewers grade the deferral a blocker, and the strictness philosophy reads "a deferred test is
a lie". the wisher may want B before release.

## .where

- `5.1.execution.from_vision.yield.md`, `.deferred`
- `dreams/2026_11_14.capture-real-sns-kinesis-deliveries.dream.md`

## .verdict

**ruled A** — director, 2026-11-14 16:3xZ. the aws docs samples are the sanctioned floor for this
release. A needs no credential and no prod write, and its rework is clean: a real delivery that
disagrees later loosens or tightens one schema. B (hand-built infra outside `declastruct-aws`,
with aws credentials) is risky and not owed; C parks the release behind another repo. the capture
dream stays, with a reseed to `declastruct-aws` for sns, kinesis and sqs.
