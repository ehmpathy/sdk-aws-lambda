# F12 — the cloud half of the sqs disposition is deferred

## the fork

case=2 `[t2]` sketches "both loci answer success". the local locus is clamped. the cloud locus has no sqs endpoint: `grepsafe 'sqs|Sqs|SQS' --path provision` → 0 (control: `'Lambda'` → 16 lines), and every `blackbox/deployed.*` suite drives a direct invoke.

| option | for | against |
|---|---|---|
| **defer to a dream** (taken) | the decision is made in-process, by the same code at both loci. the clamps assert the disposition this sdk returns (perRecord's invoke success, perBatch's `batchItemFailures`), which is the whole of what sqs reads | the redrive itself, aws's half, is not watched on a real queue |
| add a demo queue, dead-letter queue, and subscribed lambda, plus a deployed suite | proves the end-to-end claim | new infra in `provision/` and a cloud suite, for a fix whose diff is two variant files. it needs a prep apply under sso, a credential gate this route does not hold |

## taken, and why at the time

deferred: `.dream/2026_10_22.demo-infra-sqs-endpoint-for-cloud-disposition.dream.md`, linked from this route's `dreams/`.

## rework

dirty — new infra plus a credentialed apply, beyond this tree's diff.

## confidence — 80%, and why it is low

the vision's own research row flags the sqs semantics as "not fetched this session". the in-process clamps are sound for what this sdk returns, but no test here watches aws act on it.

## where

`provision/aws.infra/account=demo/resources.ts` (absent queue) · `blackbox/` (absent deployed sqs suite)

## verdict

**deferred, ruled by the director (2026-10-22): "this p0 ships without an iam grant it does not need."** the wish and the vision do not ask for a deployed sqs proof. the vision scopes it out at `1.vision.yield.md:66`: "the execution clamps assert the disposition this sdk returns; the redrive itself is aws's, and a deploy-level check would need a live queue."

the suite was built at 5.3 for two peer reviewers (`ergo-contract-snapshots` blocker.3, `mech-external-contracts` blocker.1). its run met `sqs:createqueue` AccessDenied on the demo sso role. it is parked, runnable as built, beside the dream: `.dream/2026_10_22.demo-infra-sqs-endpoint-for-cloud-disposition.assets/`, with the iam grant as its precondition (`ktlo-lambda-demo-iam-sqs`).

two grades from the first pass stand corrected. the rework is not new `provision/` infra: deployed suites provision their own resources per run (`howto.provision-demo-infra.md`), so the original absence claim read too narrow a scope (`rule.require.positive-control-before-absence-claims`). what keeps it out of this pr is the iam grant, a human's to make. rework: clean — restore two files and one pinned dev dependency once the grant lands.
