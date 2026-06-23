# aws.infra/account=demo

aws resources for sdk-aws-lambda integration tests in the demo account.

## resources

- `sdk-aws-lambda-test-role` — iam role for lambda execution
- `svc-demo-getEventEcho` — test lambda that echoes input with trail context

## prerequisites

1. aws credentials for the demo account
2. declastruct-aws installed

## build handler

bundle the handler before deploy:

```sh
rhx build.lambda.handler --file provision/aws.infra/account=demo/.assets/lambda.getEventEcho.handler.ts
```

## plan

preview changes without apply:

```sh
# unlock keyrack session (credentials sourced automatically by resources.ts)
rhx keyrack unlock --owner ehmpath --env prep

# plan
npx declastruct plan --wish provision/aws.infra/account=demo/resources.ts --into provision/aws.infra/account=demo/.temp/plan.json
```

## apply

apply the plan to create resources:

```sh
npx declastruct apply --plan provision/aws.infra/account=demo/.temp/plan.json
```

## verify

invoke the lambda to verify:

```sh
aws lambda invoke \
  --function-name svc-demo-getEventEcho \
  --payload '{"message":"hello","trail":{"exid":"exid:test"}}' \
  --cli-binary-format raw-in-base64-out \
  /dev/stdout
```
