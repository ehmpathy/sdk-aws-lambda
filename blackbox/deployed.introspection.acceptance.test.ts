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
 */
import * as esbuild from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';

import { LambdaClient, waitUntilFunctionActiveV2 } from '@aws-sdk/client-lambda';
import {
  DeclaredAwsIamRole,
  DeclaredAwsLambda,
  genDeclaredAwsLambdaCode,
  getDeclastructAwsProvider,
  setIamRole,
  setLambda,
} from 'declastruct-aws';
import { RefByUnique } from 'domain-objects';
import { ConstraintError } from 'helpful-errors';
import { genContextLogTrail } from 'sdk-logs';
import { given, then, useBeforeAll, useThen, when } from 'test-fns';

import { getAllLambdaContracts, getOneLambdaContract } from '../src/index';

const { log } = genContextLogTrail({ trail: null, env: null });

/**
 * .what = retry async operation with exponential backoff
 * .why = handles AWS eventual consistency (e.g., IAM role propagation)
 */
const withRetry = async <T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts: number;
    backoffMs: number;
    shouldRetry: (error: Error) => boolean;
  },
): Promise<T> => {
  const attempt = async (n: number): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (!options.shouldRetry(error)) throw error;
      if (n >= options.maxAttempts) throw error;
      await new Promise((r) => setTimeout(r, options.backoffMs * n));
      return attempt(n + 1);
    }
  };
  return attempt(1);
};

// handler path relative to this test file
const HANDLER_SOURCE = path.resolve(
  __dirname,
  './__test_assets__/shellContractHandler.ts',
);
const BUILD_DIR = path.resolve(__dirname, '../.build');
const BUNDLE_PATH = path.join(BUILD_DIR, 'shellContractHandler.js');
const ZIP_PATH = path.join(BUILD_DIR, 'shellContractHandler.zip');

// resource names: function name follows {service}-{access}-{function}
const ROLE_NAME = 'sdk-aws-lambda-e2e-seaturtle-role';
const SERVICE = 'svc-seaturtle';
const FUNCTION = 'checkContract';
const LAMBDA_NAME = `${SERVICE}-prep-${FUNCTION}`;

/**
 * bundle handler to js via esbuild
 */
const bundleHandler = async (): Promise<void> => {
  await fs.mkdir(BUILD_DIR, { recursive: true });
  await esbuild.build({
    entryPoints: [HANDLER_SOURCE],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: BUNDLE_PATH,
    external: ['@aws-sdk/*'],
  });
};

/**
 * create zip from bundled js
 */
const createZip = async (): Promise<void> => {
  const output = (await import('fs')).createWriteStream(ZIP_PATH);
  // archiver v8 is ESM and exports ZipArchive class directly
  const { ZipArchive } = (await import('archiver')) as unknown as {
    ZipArchive: new (options: {
      zlib: { level: number };
    }) => import('archiver').Archiver;
  };
  const archive = new ZipArchive({ zlib: { level: 9 } });

  return new Promise((done, reject) => {
    output.on('close', () => done());
    archive.on('error', reject);
    archive.pipe(output);
    archive.file(BUNDLE_PATH, { name: 'shellContractHandler.js' });
    archive.finalize();
  });
};

describe('e2e: deployed introspectable lambda', () => {
  // deploy infrastructure before all tests
  useBeforeAll(async () => {
    // validate credentials (either profile or access keys)
    const hasProfile = !!process.env.AWS_PROFILE;
    const hasKeys =
      !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
    if (!hasProfile && !hasKeys) {
      throw new ConstraintError('AWS credentials required for e2e test', {
        hint: 'run: rhx keyrack unlock --owner ehmpath --env prep',
      });
    }

    // bundle and zip handler
    await bundleHandler();
    await createZip();

    // get declastruct aws provider (sources credentials)
    const provider = await getDeclastructAwsProvider({}, { log: console });
    const context = provider.context;

    // declare iam role (shared with the goSurf e2e lambda)
    const role = DeclaredAwsIamRole.as({
      name: ROLE_NAME,
      path: '/',
      description: 'role for sdk-aws-lambda e2e acceptance test',
      policies: [
        {
          effect: 'Allow',
          principal: { service: 'lambda.amazonaws.com' },
          action: 'sts:AssumeRole',
        },
      ],
      tags: { managedBy: 'declastruct', purpose: 'e2e-acceptance-test' },
    });
    await setIamRole({ upsert: role }, context);

    // declare lambda (introspection-enabled: handler uses env.access = prep)
    const lambda = DeclaredAwsLambda.as({
      name: LAMBDA_NAME,
      runtime: 'nodejs20.x',
      handler: 'shellContractHandler.handler',
      timeout: 30,
      memory: 128,
      role: RefByUnique.as<typeof DeclaredAwsIamRole>({ name: ROLE_NAME }),
      envars: { NODE_ENV: 'test' },
      code: genDeclaredAwsLambdaCode({ zipUri: ZIP_PATH }),
      tags: { managedBy: 'declastruct', purpose: 'e2e-acceptance-test' },
    });

    // create/upsert lambda (with retry for IAM role propagation)
    const lambdaDeployed = await withRetry(
      () => setLambda({ upsert: lambda }, context),
      {
        maxAttempts: 5,
        backoffMs: 3000,
        shouldRetry: (error) =>
          error.message.includes('role') ||
          error.message.includes('AssumeRole') ||
          error.message.includes('cannot be assumed'),
      },
    );

    // wait for lambda to be active
    const sdkLambda = new LambdaClient({ region: 'us-east-1' });
    await waitUntilFunctionActiveV2(
      { client: sdkLambda, maxWaitTime: 60 },
      { FunctionName: LAMBDA_NAME },
    );

    return { lambdaDeployed };
  });

  given('[case1] introspect one deployed contract', () => {
    when('[t0] getOneLambdaContract is called against the deployed lambda', () => {
      const schema = useThen('returns the endpoint schema', async () =>
        getOneLambdaContract(
          { which: { service: SERVICE, function: FUNCTION } },
          { log, env: { access: 'prep', region: 'us-east-1' } },
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
          { log, env: { access: 'prep', region: 'us-east-1' } },
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
