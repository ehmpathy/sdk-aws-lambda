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

/**
 * .what = refuse the ec2 instance role as a credential source
 * .why HERE = this wish CREATES resources, so a silent fall-through to this box's instance
 *      role would provision lambdas and iam roles into the wrong account
 *
 * .the shared evidence — the `remoteProvider` chain read, the container caveat, and why the
 *  assignment is not extracted into a helper — lives ONCE at `jest.acceptance.env.ts`, above
 *  its copy of this line. read it there; do not re-derive it here
 *
 * .note = this must be set BEFORE any aws client is constructed, so it sits above the source
 *
 * ⚠️ .why it is NOT gated on a deploy context = `r7.1` asked that the refusal fire only inside
 *    a deploy/test context, so a plain import of this module would not touch a process-wide
 *    knob. MEASURED and refused: this module's entire export surface is `getProviders` and
 *    `getResources`, both aws-only, and `declastruct plan` imports it AND reads live aws state
 *    to draw the plan. so the plan path wants the refusal exactly as much as apply does, and
 *    there is no import of this module that does not want it. the reviewers are right that a
 *    process-wide mutation is the wrong SHAPE — and the repair for that is the account
 *    assertion the note above names as absent, never a gate that would leave `plan` unguarded
 *
 * 🚧 .the TRIGGER that re-opens this, stated so it need not be re-derived = the refusal above
 *    rests on ONE fact: every export of this module is aws-only, so no importer can be harmed
 *    by it. `r7.1` named the future that falsifies that — "a change that adds a non-AWS export
 *    would silently widen the side effect to consumers who never meant to disable IMDS".
 *    ⇒ so: IF YOU ADD AN EXPORT HERE THAT DOES NOT TOUCH AWS, this line becomes a hidden side
 *      effect on that consumer, and the refusal above no longer holds. the fix at that moment
 *      is to move the assignment behind the aws-only entrypoints, never to delete it
 */
process.env.AWS_EC2_METADATA_DISABLED = 'true';

/**
 * .what = source aws credentials from keyrack, and failfast when it cannot
 * .why = `lenient` proceeded silently with no grant, which surfaced much later as a bare
 *        `CredentialsProviderError` — or, worse, as a plan drawn against whatever identity
 *        the chain did find. strict refuses at the source, and its error names the fix
 */
keyrack.source({ env: 'prep', owner: 'ehmpath', mode: 'strict' });

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
    name: 'svc-prep-getEventEcho',
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
    name: 'svc-prep-echoAncient',
    runtime: 'nodejs20.x',
    handler: 'handler.handler',
    timeout: 30,
    memory: 128,
    role: RefByUnique.as<typeof DeclaredAwsIamRole>(lambdaRole),
    envars: { NODE_ENV: 'test' },
    code: genDeclaredAwsLambdaCode({
      zipUri:
        'provision/aws.infra/account=demo/.assets/lambda.echoAncient.handler.zip',
    }),
    tags: { managedBy: 'declastruct', purpose: 'round-trip-test' },
  });

  // contemp handler for round-trip tests (genLambdaEndpoint with caller detection)
  const contempLambda = DeclaredAwsLambda.as({
    name: 'svc-prep-echoContemp',
    runtime: 'nodejs20.x',
    handler: 'handler.handler',
    timeout: 30,
    memory: 128,
    role: RefByUnique.as<typeof DeclaredAwsIamRole>(lambdaRole),
    envars: { NODE_ENV: 'test' },
    code: genDeclaredAwsLambdaCode({
      zipUri:
        'provision/aws.infra/account=demo/.assets/lambda.echoContemp.handler.zip',
    }),
    tags: { managedBy: 'declastruct', purpose: 'round-trip-test' },
  });

  return [lambdaRole, testLambda, ancientLambda, contempLambda];
};
