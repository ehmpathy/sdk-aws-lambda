# invariant.lambda-redeploy-waits-on-lastupdatestatus

## .what

any test that deploys a lambda and then invokes it MUST wait on **both** waiters, in this
order:

```ts
// covers the CREATE path — the function does not exist yet
await waitUntilFunctionActiveV2(
  { client: sdkLambda, maxWaitTime: 60 },
  { FunctionName: LAMBDA_NAME },
);

// covers the UPDATE path — the function exists and its CODE changed
await waitUntilFunctionUpdatedV2(
  { client: sdkLambda, maxWaitTime: 60 },
  { FunctionName: LAMBDA_NAME },
);
```

`waitUntilFunctionActiveV2` alone is **not** enough, and its insufficiency is invisible on a
green local run.

## .why — the two waiters read two different fields

| waiter | blocks on | tells you |
|---|---|---|
| `waitUntilFunctionActiveV2` | `State` | the function EXISTS and can be invoked |
| `waitUntilFunctionUpdatedV2` | `LastUpdateStatus` | the code you just pushed is the code that RUNS |

on a **create**, `State` goes `Pending` → `Active`, so `ActiveV2` does real work.

🔴 on an **update**, `State` is `Active` the entire time. it never leaves `Active`, because the
prior version is live and serves traffic throughout the deploy. so `ActiveV2` returns at once
while `LastUpdateStatus` is still `InProgress` — and the invoke that follows hits the
**previous bundle**.

⇒ the test then asserts against the OLD code, with no error, no timeout, and no signal that the
code is stale. it is a pure false read.

## .the failure mode this produced

the deployed acceptance suites bundle their own handler, deploy it, then introspect it. when a
fixture's zod schema changed, two of four suites captured the **prior** schema — the snapshot
diff showed `additionalProperties: false` present in the snapshot and absent in the received
value, at both `input` and `output`. the schema change was three commits old.

it passed locally every time. the local run's lambda had already converged from the prior run,
so `LastUpdateStatus` was `Successful` before the suite even started. only CI — which races a
fresh `UpdateFunctionCode` — ever lost.

⚠️ **a stale-code read looks exactly like a wrong assertion.** the first instinct is to blame
the snapshot or the fixture. neither is at fault; the invoke landed one deploy behind.

## .the class, and the sweep

the repo had **already** diagnosed this and fixed it in two of four suites — with a comment that
named the cause exactly. the other two kept `ActiveV2` alone for three more releases.

the family is every test that deploys then invokes:

| suite | state |
|---|---|
| `blackbox/deployed.codegen.acceptance.test.ts` | paired from the start |
| `blackbox/deployed.codegen.refs.acceptance.test.ts` | paired from the start |
| `blackbox/deployed.introspection.acceptance.test.ts` | ⛔ was `ActiveV2` alone |
| `blackbox/deployed.awsLambda.acceptance.test.ts` | ⛔ was `ActiveV2` alone |

all four now pair. the membership rule: **a test that calls `setLambda` (or any
`UpdateFunctionCode` path) and later invokes that function.**

⇒ this is the exact shape `rule.require.sweep-the-defect-class` names. the fix existed, the
comment existed, and the class stayed open — because a per-file comment is only read by someone
already in that file.

## .the test

before you invoke a lambda a test just deployed: **"what proves the code I pushed is the code
that answers?"**

- `LastUpdateStatus: Successful`, via `waitUntilFunctionUpdatedV2` → proven
- `State: Active` → proves only that SOME version answers
- a `sleep` → a guess with a clock attached

## .the caveat

- **a test that only READS a deployed function** (no deploy of its own) owes neither waiter —
  there is no update to race.
- **order matters.** `ActiveV2` first: on a create, `LastUpdateStatus` may be absent until the
  function exists, so `UpdatedV2` alone can throw or return early.
- **`maxWaitTime` is seconds.** 60 covers a small bundle; a large one may want more.

## .enforcement

- a test that deploys a lambda and invokes it, with `waitUntilFunctionActiveV2` and no
  `waitUntilFunctionUpdatedV2` = **blocker**
- a `sleep` or a fixed delay in place of `waitUntilFunctionUpdatedV2` = **blocker**
- a snapshot mismatch in a deployed acceptance suite, diagnosed as a fixture defect with no
  check of the waiters = **nitpick** (check the waiters first; a stale read wears that disguise)

## .see also

- `rule.require.sweep-the-defect-class` — the fix was in the repo and the class stayed open
- `rule.require.measure-the-value-you-emit` — `State: Active` is a read of a type's promise, not
  a measure of which bytes ran
- `howto.provision-demo-infra` — the deploy path these suites drive
- [aws docs: lambda function states](https://docs.aws.amazon.com/lambda/latest/dg/functions-states.html)
