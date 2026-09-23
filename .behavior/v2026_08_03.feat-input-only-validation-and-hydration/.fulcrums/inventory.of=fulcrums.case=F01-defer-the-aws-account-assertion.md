# `F01` — defer the aws account assertion, so the IMDS refusal stays a partial guard

- **rework** = dirty
- **status** = open
- **confidence** = 88%
- **where** = `jest.acceptance.env.ts` · `jest.integration.env.ts` ·
  `provision/aws.infra/account=demo/resources.ts`
- **dream** = `.dream/v2026_09_18.feat.assert-the-aws-account-before-any-test-or-provision-runs.md`

## .the fork, stated fairly

three boot files refuse the ec2 instance role as a credential source, and each carries its own
note that states the guard is **partial** — the container-credential link of `remoteProvider`
runs first and stays live. three reviewers in one round (`r4.2`, `r6.1`, `r7.1`) graded that gap.

| option | what it does |
|---|---|
| **A — defer** *(taken)* | keep the partial refusal, collapse its duplicated evidence, name the gap, catch a dream |
| B — build the assertion now | add `sts:GetCallerIdentity` at each boot site, compared against `declapract.use.yml`'s `awsAccountId` |
| C — gate the refusal on a deploy context | `r7.1`'s narrower ask: fire it only inside deploy/test, so a plain import touches no process-wide knob |

## .taken, and why AT THE TIME

**A.** the wish this route serves is about input-only validation and domain-object hydration
(`0.wish.md`). the credential-boot work entered as scouts-honor on files the diff already
opened; the assertion is a feature of its own, on a surface the wish never named.

**C was measured and refused outright**, so it never reached a judgment call: `resources.ts`
exports `getProviders` and `getResources`, both aws-only, and `declastruct plan` imports the
module AND reads live aws state. so the plan path wants the refusal exactly as much as apply
does, and there is no import of that module that does not want it. the reason sits at the file.

⇒ so the real fork was A against B, and what settles it is the rework grade below.

## .rework, and why DIRTY

| ripple | what it opens |
|---|---|
| a network call on every boot | every acceptance and integration run gains a failure mode |
| the jest setup contract | sync → async, in two files |
| `declapract.use.yml` parse | the two envs read it for a boolean today; the assertion needs the value |
| `getProviders`' signature | the provision site has no boot phase, so the seam is inside it |
| a wrong `expected` value | refuses **every suite in the repo**, and only a real ci run proves it right |

that last row settles it: the change cannot be verified from this worktree. a revert is cheap in
code and expensive in confidence, because the state it must be proven against is one I cannot
reach.

## .confidence, and why it is not higher

**88%.** the 12%: I judged the assertion out of the wish's bound, and the wish never mentions
credentials at all — so the bound is my read rather than a stated one. a wisher who holds
credential-boot integrity to be part of "the suite must prove this PR's behavior" would say B
belongs here, and their case would be reasonable: three reviewers converged on it, and a partial
guard dressed as a whole one is the `rule.forbid.failhide` shape the repo blocks on.

what pushes it to 88 rather than lower: the gap **predates this branch** (the notes that admit it
were written before this stone), no reviewer graded it a blocker, and the dream records the whole
fix so the next traveler pays comprehension once.

## .the verdict, once ruled

_(unruled)_
