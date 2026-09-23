/**
 * .what = e2e acceptance test proving introspection works against a real deployed lambda
 * .why = verifies the positive path — a deployed, introspection-enabled handler
 *        actually returns its schema over the wire via getOneLambdaContract and
 *        getAllLambdaContracts (the wish's explicit ask for end-to-end coverage)
 *
 * this test:
 * 1. bundles a handler (genLambdaEndpoint with zod schema + env.access = prep)
 * 2. deploys it to AWS via declastruct-aws imperative operations
 * 3. introspects it via getOneLambdaContract and getAllLambdaContracts
 * 4. verifies the returned json schemas match the declared zod schemas
 *
 * .note = the handler here declares a PLAIN zod schema, so no `x-domain-object` /
 *         `x-domain-object-ref` marker appears in its payload. that is the shape
 *         under test, never a gap: the deployed DOBJ payload is pinned byte-exact at
 *         `deployed.codegen.refs.acceptance.test.ts` `[case2]`, against the live
 *         `svc-trophy-prep-getTrophy` — the one deployed endpoint that carries every
 *         marker shape at once. it lives there because that suite's hook already
 *         deploys the dobj lambdas, so a fifth deploy here would buy no coverage and
 *         would charge the cold budget `F34` measured as insufficient
 */
import * as path from 'path';

import { DeclaredAwsLambda, genDeclaredAwsLambdaCode } from 'declastruct-aws';
import { genContextLogTrail } from 'sdk-logs';
import { given, then, useBeforeAll, useThen, when } from 'test-fns';

import { getAllLambdaContracts, getOneLambdaContract } from '../src/index';
import { getOneDeployContext } from './__test_assets__/getOneDeployContext';
import {
  LAMBDA_DEPLOY_HOOK_BUDGET_MS,
  setLambdaLive,
} from './__test_assets__/setLambdaLive';
import { setLambdaRole } from './__test_assets__/setLambdaRole';
import { setLambdaZip } from './__test_assets__/setLambdaZip';

const { log } = genContextLogTrail({ trail: null, env: null });

// handler path relative to this test file
const HANDLER_SOURCE = path.resolve(
  __dirname,
  './__test_assets__/shellContractHandler.ts',
);
const BUILD_DIR = path.resolve(__dirname, '../.build');
const BUNDLE_NAME = 'shellContractHandler';

// resource names: function name follows {service}-{access}-{function}
const ROLE_NAME = 'sdk-aws-lambda-e2e-seaturtle-role';
const SERVICE = 'svc-seaturtle';
const FUNCTION = 'checkContract';
const LAMBDA_NAME = `${SERVICE}-prep-${FUNCTION}`;
const REGION = 'us-east-1';

// this suite deploys ONE lambda, so its hook takes the whole-hook budget — the preflight
// (bundle + creds + iam role) plus the one `setLambdaLive` that follows it
jest.setTimeout(LAMBDA_DEPLOY_HOOK_BUDGET_MS);

describe('e2e: deployed introspectable lambda', () => {
  // deploy infrastructure before all tests
  useBeforeAll(async () => {
    // bundle and zip handler
    const { zipPath } = await setLambdaZip({
      handlerSource: HANDLER_SOURCE,
      buildDir: BUILD_DIR,
      bundleName: BUNDLE_NAME,
    });

    // credentials, then the iam role (shared with the goSurf e2e lambda)
    const { context } = await getOneDeployContext();
    const { ref: roleRef } = await setLambdaRole(
      {
        name: ROLE_NAME,
        description: 'role for sdk-aws-lambda e2e acceptance test',
      },
      context,
    );

    // declare lambda (introspection-enabled: handler uses env.access = prep)
    const lambda = DeclaredAwsLambda.as({
      name: LAMBDA_NAME,
      runtime: 'nodejs20.x',
      handler: `${BUNDLE_NAME}.handler`,
      timeout: 30,
      memory: 128,
      role: roleRef,
      envars: { NODE_ENV: 'test' },
      code: genDeclaredAwsLambdaCode({ zipUri: zipPath }),
      tags: { managedBy: 'declastruct', purpose: 'e2e-acceptance-test' },
    });

    // upsert it and block until the code the introspection will read is THIS code.
    // .note = the retry-for-role-propagation and the active/updated waiter pair main
    //         had inline here now live INSIDE `setLambdaLive`, so every deployed suite
    //         gets the same guarantee from one home
    const lambdaDeployed = await setLambdaLive(
      { lambda, region: REGION },
      context,
    );

    return { lambdaDeployed };
  });

  given('[case1] introspect one deployed contract', () => {
    when('[t0] getOneLambdaContract is called against the deployed lambda', () => {
      const schema = useThen('returns the endpoint schema', async () =>
        getOneLambdaContract(
          { which: { service: SERVICE, function: FUNCTION } },
          { log, env: { access: 'prep', region: REGION } },
        ),
      );

      then('input schema reflects the declared zod input', () => {
        expect(schema.input).toBeDefined();
        const properties = (
          schema.input as { properties?: Record<string, unknown> }
        ).properties;
        expect(properties).toBeDefined();
        expect(properties).toHaveProperty('shellId');
        expect(properties).toHaveProperty('size');
      });

      then('output schema reflects the declared zod output', () => {
        expect(schema.output).toBeDefined();
        const properties = (
          schema.output as { properties?: Record<string, unknown> }
        ).properties;
        expect(properties).toBeDefined();
        expect(properties).toHaveProperty('ok');
        expect(properties).toHaveProperty('shellId');
      });

      then('schema matches snapshot', () => {
        expect(schema).toMatchSnapshot();
      });
    });
  });

  given('[case2] introspect all deployed contracts for a service', () => {
    when('[t0] getAllLambdaContracts is called for the prep service', () => {
      const contracts = useThen('returns a record of contracts', async () =>
        getAllLambdaContracts(
          { which: { service: SERVICE } },
          { log, env: { access: 'prep', region: REGION } },
        ),
      );

      then('record is keyed by the bare function name', () => {
        expect(Object.keys(contracts)).toContain(FUNCTION);
      });

      then('the discovered contract carries input and output schemas', () => {
        const contract = contracts[FUNCTION];
        expect(contract).toBeDefined();
        expect(contract?.input).toBeDefined();
        expect(contract?.output).toBeDefined();
      });
    });
  });
});
