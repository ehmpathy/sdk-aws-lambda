/**
 * .what = aws resources for sdk-aws-lambda demo account
 * .why = enables real integration tests for askLambdaEndpoint
 */
import type { DeclastructProvider } from 'declastruct';
import {
  DeclaredAwsIamRole,
  DeclaredAwsLambda,
  genDeclaredAwsLambdaCode,
  getDeclastructAwsProvider,
} from 'declastruct-aws';
import { type DomainEntity, RefByUnique } from 'domain-objects';
import { keyrack } from 'rhachet/keyrack';

// source aws credentials from keyrack
keyrack.source({ env: 'prep', owner: 'ehmpath', mode: 'lenient' });

export const getProviders = async (): Promise<DeclastructProvider[]> => [
  await getDeclastructAwsProvider(
    {},
    {
      log: {
        info: () => {},
        debug: () => {},
        warn: console.warn,
        error: console.error,
      },
    },
  ),
];

export const getResources = async (): Promise<DomainEntity<any>[]> => {
  // declare iam role for lambda execution
  const lambdaRole = DeclaredAwsIamRole.as({
    name: 'sdk-aws-lambda-test-role',
    path: '/',
    description: 'role for sdk-aws-lambda integration test lambda',
    policies: [
      {
        effect: 'Allow',
        principal: { service: 'lambda.amazonaws.com' },
        action: 'sts:AssumeRole',
      },
    ],
    tags: { managedBy: 'declastruct' },
  });

  // declare test lambda function ($LATEST, no versions needed for tests)
  const testLambda = DeclaredAwsLambda.as({
    name: 'svc-demo-getEventEcho',
    runtime: 'nodejs20.x',
    handler: 'handler.handler',
    timeout: 30,
    memory: 128,
    role: RefByUnique.as<typeof DeclaredAwsIamRole>(lambdaRole),
    envars: { NODE_ENV: 'test' },
    code: genDeclaredAwsLambdaCode({
      zipUri: 'provision/aws.infra/account=demo/.assets/handler.zip',
    }),
    tags: { managedBy: 'declastruct', purpose: 'integration-test' },
  });

  // ancient handler for round-trip tests (flat error format)
  const ancientLambda = DeclaredAwsLambda.as({
    name: 'svc-demo-echoAncient',
    runtime: 'nodejs20.x',
    handler: 'handler.handler',
    timeout: 30,
    memory: 128,
    role: RefByUnique.as<typeof DeclaredAwsIamRole>(lambdaRole),
    envars: { NODE_ENV: 'test' },
    code: genDeclaredAwsLambdaCode({
      zipUri: 'provision/aws.infra/account=demo/.assets/lambda.echoAncient.handler.zip',
    }),
    tags: { managedBy: 'declastruct', purpose: 'round-trip-test' },
  });

  // contemp handler for round-trip tests (genLambdaEndpoint with caller detection)
  const contempLambda = DeclaredAwsLambda.as({
    name: 'svc-demo-echoContemp',
    runtime: 'nodejs20.x',
    handler: 'handler.handler',
    timeout: 30,
    memory: 128,
    role: RefByUnique.as<typeof DeclaredAwsIamRole>(lambdaRole),
    envars: { NODE_ENV: 'test' },
    code: genDeclaredAwsLambdaCode({
      zipUri: 'provision/aws.infra/account=demo/.assets/lambda.echoContemp.handler.zip',
    }),
    tags: { managedBy: 'declastruct', purpose: 'round-trip-test' },
  });

  return [lambdaRole, testLambda, ancientLambda, contempLambda];
};
