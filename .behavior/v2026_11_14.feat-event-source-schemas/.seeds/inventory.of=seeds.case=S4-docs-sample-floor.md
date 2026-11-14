# S4 — the aws docs samples are the sanctioned floor for release

## .said

> director verdict on F13, 16:3xZ Nov 14: A. release on the AWS docs samples. this is the sanctioned floor. why: A needs no credential and no prod write, and its rework is clean (a real delivery that disagrees later loosens or tightens one schema). B uses AWS credentials and hand-built infra outside declastruct-aws, which is risky and not owed for this release. C parks the release behind another repo. record the verdict in the F13 entry, keep the capture dream (with the declastruct-aws reseed for SNS, Kinesis, SQS), and drive on. 20:0xZ route complete stands.

— director, 2026-11-14 16:3xZ

## .settled

this release verifies `asLambdaEventSchema` against the aws docs samples. no captured delivery is
owed before release. the capture stays a dream, with a reseed to `declastruct-aws` for the sns,
kinesis and sqs classes a capture needs.

## .landed

| where | what |
|---|---|
| `.fulcrums/inventory.of=fulcrums.case=F13-docs-sample-floor-for-release.md` | verdict: ruled A |
| `.fulcrums/inventory.of=fulcrums._.md` | F13 row status |
| `.dream/2026_11_14.capture-real-sns-kinesis-deliveries.dream.md` | sanctioned floor; reseed step |
| `.dream/2026_11_14.reseed-declastruct-aws-sns-kinesis-sqs.dream.md` | the reseed |
| `5.1.execution.from_vision.yield.md` | `.deferred` capture bullet |
