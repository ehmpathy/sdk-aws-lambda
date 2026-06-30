# howto.provision-demo-infra

## .what

how to provision (plan + apply) the aws lambdas that the integration + acceptance
tests invoke, in `provision/aws.infra/account=demo/`.

## .why

the integration tests (`*.integration.test.ts`) and the deployed acceptance tests
invoke REAL lambdas by name (slug = `{service}-{access}-{function}`, e.g.
`svc-prep-getEventEcho`). if those lambdas are not deployed — or were renamed in
the wish without a redeploy — the tests fail with ResourceNotFoundException.

## .the wish self-sources credentials

`provision/aws.infra/account=demo/resources.ts` sources its own aws creds:

```ts
import { keyrack } from 'rhachet/keyrack';
keyrack.source({ env: 'prep', owner: 'ehmpath', mode: 'lenient' });
```

so you do NOT manually `source` or `export AWS_PROFILE`. but `mode: 'lenient'`
means it silently proceeds when the keyrack has no creds to source — which
surfaces later as:

```
CredentialsProviderError: Could not load credentials from any providers
```

**that error = your keyrack session expired (or was never unlocked), not a code
problem.** keyrack sessions last ~9h; unlock again.

## .steps

```sh
# 1. unlock keyrack so the wish's keyrack.source has live creds to pull
#    (interactive: approve the aws sso prompt in your browser)
rhx keyrack unlock --owner ehmpath --env prep

# 2. (re)bundle handlers only if their source changed
rhx build.lambda.handler --file provision/aws.infra/account=demo/.assets/<handler>.ts

# 3. plan (read-only; writes a plan file)
npx declastruct plan \
  --wish provision/aws.infra/account=demo/resources.ts \
  --into provision/aws.infra/account=demo/.temp/plan.json

# 4. review the plan: KEEP = unchanged, CREATE/UPDATE/DELETE = real aws mutation

# 5. apply
npx declastruct apply --plan provision/aws.infra/account=demo/.temp/plan.json
```

## .gotchas

- **renames orphan, they do not move.** declastruct only manages what is in the
  wish. if you rename a lambda (e.g. `svc-demo-*` → `svc-prep-*`), apply CREATES
  the new ones; the old ones are left orphaned in aws (not auto-deleted). clean up
  old resources separately if needed.
- **access must be a real tier.** the slug's access segment must be a valid
  `EnvironmentAccessTier` (`test | prep | prod`) — these tests use `prep`. do not
  invent envs like `demo`.
- **`npx declastruct` is pre-approved** in the permission allowlist; `keyrack
  unlock` is the only interactive (human-sso) step.
- **the integration suite hits real cold-start lambdas** — expect it to be slow
  (~100s) on a fresh deploy.

## .see also

- provision/aws.infra/account=demo/readme.md — the canonical plan/apply/verify ref
- define.lambda-endpoint-ubiqlang — slug = {service}-{access}-{function}
- rule.require.env-access-in-context — access tiers
