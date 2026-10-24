# blocker — 5.3.verification: the demo aws role cannot create an sqs queue

## .status — read first on --resume

- **held at 5.3**, passage `blocked`. the ask is filed on the commander queue as `ktlo-lambda-demo-iam-sqs` (director, 2026-10-22)
- last probe: 2026-10-22T21:54Z, with a live keyrack session (log `.log/role=mechanic/skill=git.repo.test/what=acceptance/2026-10-22T21-54-18Z.stderr.log`): the same `sqs:createqueue` AccessDenied, 10 of 10 failed
- director's orders: do not mock the queue, do not swap aws profiles
- on resume:
  1. `rhx keyrack status --owner ehmpath` — if `ehmpathy.test.AWS_PROFILE` is absent or expired, halt and ask for `rhx keyrack unlock --owner ehmpath --env test`
  2. rerun the suite (command below). a fresh AccessDenied means the grant has not landed yet: keep the hold, update this status, stop
  3. if the suite is green, work through `.what still runs once the grant lands` below
- uncommitted work on disk, all needed: the `null`/`undefined` swap in `asWireFunctionErrorPayload.ts` and its test updates, the two deployed suites and their handlers, the `@aws-sdk/client-sqs` devDependency, the yield, catalog and pr.body corrections, F21, and the i001 takens. the settings typechange file `.agent/.actors/actor.via.repo=ambient/brain/.claude/settings.of.grove.json` stays out of every commit

## .the ask — a human iam grant

`blackbox/deployed.sqsDisposition.acceptance.test.ts` creates two run-scoped queues and a dead-letter queue, then maps them to two lambdas. the demo sso role refuses the first call:

```
AccessDenied: User: arn:aws:sts::805192865516:assumed-role/AWSReservedSSO_ehmpathy-demo-sso_18136d510d9aa5f5/demo-agent
is not authorized to perform: sqs:createqueue on resource:
arn:aws:sqs:us-east-1:805192865516:sdk-aws-lambda-e2e-sqs-record-dlq-1792705006534
because no identity-based policy allows the sqs:createqueue action
```

grant, on the `ehmpathy-demo-sso` permission set **and** the ci role `arn:aws:iam::805192865516:role/ehmpathy-demo-oidc`, scoped to `arn:aws:sqs:us-east-1:805192865516:sdk-aws-lambda-e2e-sqs-*`:

- `sqs:CreateQueue`, `sqs:DeleteQueue`, `sqs:GetQueueAttributes`, `sqs:SetQueueAttributes`, `sqs:SendMessage`, `sqs:ReceiveMessage`, `sqs:DeleteMessage`
- `lambda:CreateEventSourceMapping`, `lambda:DeleteEventSourceMapping`, `lambda:GetEventSourceMapping`, `lambda:ListEventSourceMappings`
- `iam:PutRolePolicy` on `arn:aws:iam::805192865516:role/sdk-aws-lambda-e2e-*` (the suite attaches the `sqs-consume` inline policy to its lambda role)

the second and third groups are a best read of what the suite calls next: the run never got past `CreateQueue`, so they are unmeasured.

then: `rhx route.stone.set --stone 5.3.verification --as rewound` is not needed. tell the driver the grant is in, and it reruns:

```sh
rhx git.repo.test --what acceptance --against local --env test --scope path://deployed.sqsDisposition --mode apply --resnap
```

## .why no driver lever closes it

the permission set lives outside this repo. `grepsafe 'demo-sso|demo-oidc|lambda:Create|iam:PassRole' --path provision` → 0. the control `grepsafe 'resource|provider' --path provision` → 7 lines, so the scope is reachable and the zero is real. an iam grant is a credential gate: a switch to another aws profile, or a mock queue, would be the workaround the keyrack rules forbid.

## .levers spent

- the keyrack session is live (`ehmpathy.test.AWS_PROFILE`), so this is a permission wall, not an expired login
- every other credentialed suite ran green this session:
  - `[case22]` integration resnap → 5 passed
  - `local.sqsQueue` acceptance resnap → 36 passed
  - `deployed.faultLabel` acceptance → 6 passed. its first run found a real divergence: a thrown `null` reads `'string'`/`'handled'` on the cloud. it is fixed in `asWireFunctionErrorPayload` and recorded in the yield
- every peer concern from round i001 carries a stance (19 conceded `better`, 1 disputed via F21), and every lane is absorbed
- types, lint, and serde unit are green after the fix

## .what still runs once the grant lands

1. `deployed.sqsDisposition` with `--resnap`
2. the full thorough suites, then the yield's proof table refresh
3. retire the F12 dream and its route symlink
4. re-arrive 5.3 with `--as passed`
