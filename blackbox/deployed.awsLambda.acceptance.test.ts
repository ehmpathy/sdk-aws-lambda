/**
 * .what = e2e acceptance test proving genLambdaEndpoint + askLambdaEndpoint work together
 * .why = verify trail propagation from caller to deployed handler in real AWS environment
 *
 * this test:
 * 1. bundles a handler (uses genLambdaEndpoint)
 * 2. deploys it to AWS via declastruct-aws imperative operations
 * 3. invokes it via askLambdaEndpoint
 * 4. verifies trail propagation from caller to handler
 */
import * as esbuild from 'esbuild';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
  LambdaClient,
  waitUntilFunctionActiveV2,
} from '@aws-sdk/client-lambda';
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
import { getError, given, then, useBeforeAll, useThen, when } from 'test-fns';
import { z } from 'zod';

/**
 * .what = generates test log context
 * .why = provides valid ContextLogTrail for tests
 */
const genTestLog = (trail?: { exid: string; stack?: string[] }) =>
  genContextLogTrail({
    trail: trail ? { exid: trail.exid, stack: trail.stack ?? [] } : null,
    env: null,
  });

import { askLambdaEndpoint } from '../src/index';

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
      console.log(
        `attempt ${n}/${options.maxAttempts} failed, retry in ${options.backoffMs * n}ms...`,
      );
      await new Promise((r) => setTimeout(r, options.backoffMs * n));
      return attempt(n + 1);
    }
  };
  return attempt(1);
};

// handler path relative to this test file
const HANDLER_SOURCE = path.resolve(
  __dirname,
  './__test_assets__/seaTurtleHandler.ts',
);
const BUILD_DIR = path.resolve(__dirname, '../.build');
const BUNDLE_PATH = path.join(BUILD_DIR, 'seaTurtleHandler.js');
const ZIP_PATH = path.join(BUILD_DIR, 'seaTurtleHandler.zip');

// resource names
const ROLE_NAME = 'sdk-aws-lambda-e2e-seaturtle-role';
const LAMBDA_NAME = 'svc-seaturtle-prod-goSurf';

// schema for type inference (matches handler)
const goSurfSchema = {
  input: z.object({
    ocean: z.string(),
    style: z.enum(['longboard', 'shortboard', 'bodyboard']),
  }),
  output: z.object({
    success: z.literal(true),
    comment: z.string(),
    trailExid: z.string().nullable(),
  }),
};

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
  const { ZipArchive } = await import('archiver') as unknown as {
    ZipArchive: new (options: { zlib: { level: number } }) => import('archiver').Archiver;
  };
  const archive = new ZipArchive({ zlib: { level: 9 } });

  return new Promise((done, reject) => {
    output.on('close', () => done());
    archive.on('error', reject);
    archive.pipe(output);
    archive.file(BUNDLE_PATH, { name: 'seaTurtleHandler.js' });
    archive.finalize();
  });
};

describe('e2e: deployed goSurf lambda with trail propagation', () => {
  // deploy infrastructure before all tests
  const infra = useBeforeAll(async () => {
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
    console.log('bundle handler...');
    await bundleHandler();
    await createZip();
    console.log('handler bundled to:', ZIP_PATH);

    // get declastruct aws provider (resolves credentials)
    const provider = await getDeclastructAwsProvider({}, { log: console });
    const context = provider.context;

    // declare iam role
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

    // create/upsert role
    console.log('deploy iam role...');
    const roleDeployed = await setIamRole({ upsert: role }, context);
    console.log('role deployed:', roleDeployed.name);

    // declare lambda
    const lambda = DeclaredAwsLambda.as({
      name: LAMBDA_NAME,
      runtime: 'nodejs20.x',
      handler: 'seaTurtleHandler.handler',
      timeout: 30,
      memory: 128,
      role: RefByUnique.as<typeof DeclaredAwsIamRole>({ name: ROLE_NAME }),
      envars: { NODE_ENV: 'test' },
      code: genDeclaredAwsLambdaCode({ zipUri: ZIP_PATH }),
      tags: { managedBy: 'declastruct', purpose: 'e2e-acceptance-test' },
    });

    // create/upsert lambda (with retry for IAM role propagation)
    console.log('deploy lambda...');
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
    console.log('lambda deployed:', lambdaDeployed.name);

    // wait for lambda to be active
    console.log('wait for lambda to be active...');
    const sdkLambda = new LambdaClient({ region: 'us-east-1' });
    await waitUntilFunctionActiveV2(
      { client: sdkLambda, maxWaitTime: 60 },
      { FunctionName: LAMBDA_NAME },
    );
    console.log('lambda active');

    return { provider, context, roleDeployed, lambdaDeployed };
  });

  given('[case1] deployed goSurf lambda via declastruct', () => {
    when('[t0] invoked via askLambdaEndpoint with trail context', () => {
      const trailExid = 'exid:cowabunga-turtle-ride';

      const result = useThen('invocation succeeds', async () =>
        askLambdaEndpoint<
          z.infer<typeof goSurfSchema.input>,
          z.infer<typeof goSurfSchema.output>
        >(
          {
            which: {
              service: 'svc-seaturtle',
              function: 'goSurf',
            },
            event: {
              ocean: 'pacific',
              style: 'longboard',
            },
          },
          {
            ...genTestLog({ exid: trailExid }),
            env: { access: 'prod', region: 'us-east-1' },
          },
        ),
      );

      then('handler receives trail exid from caller', () => {
        expect(result.trailExid).toEqual(trailExid);
      });

      then('handler returns success with comment', () => {
        expect(result.success).toEqual(true);
        expect(result.comment).toEqual('caught a longboard wave in the pacific');
      });

      then('response matches snapshot', () => {
        expect(result.success).toEqual(true);
        expect(result.trailExid).toBeDefined();
        expect(result.comment).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] invoked without explicit trail context', () => {
      const result = useThen('invocation succeeds', async () =>
        askLambdaEndpoint<
          z.infer<typeof goSurfSchema.input>,
          z.infer<typeof goSurfSchema.output>
        >(
          {
            which: {
              service: 'svc-seaturtle',
              function: 'goSurf',
            },
            event: {
              ocean: 'atlantic',
              style: 'shortboard',
            },
          },
          {
            ...genTestLog(),
            env: { access: 'prod', region: 'us-east-1' },
          },
        ),
      );

      then('handler generates its own trail exid', () => {
        // when no trail provided by caller, askLambdaEndpoint generates one
        // and the handler receives it via the payload
        expect(result.trailExid).toMatch(/^exid:/);
      });

      then('handler returns correct comment', () => {
        expect(result.comment).toEqual('caught a shortboard wave in the atlantic');
      });
    });

    when('[t2] invoked with invalid input', () => {
      then('handler returns validation error', async () => {
        const error = await getError(
          async () =>
            askLambdaEndpoint<
              z.infer<typeof goSurfSchema.input>,
              z.infer<typeof goSurfSchema.output>
            >(
              {
                which: {
                  service: 'svc-seaturtle',
                  function: 'goSurf',
                },
                event: {
                  ocean: 'pacific',
                  // use type cast to bypass compile-time check,
                  // simulates runtime validation error from invalid data
                  style: 'surfboard' as 'longboard',
                },
              },
              {
                // pin a fixed exid so the error snapshot is stable; a generated
                // exid would land in the error message + metadata and permadiff
                ...genTestLog({ exid: 'exid:fixed-t2-validation' }),
                env: { access: 'prod', region: 'us-east-1' },
              },
            ),
        );
        expect(error).toBeDefined();
        expect(error.message).toContain('validation');
        // snapshot full error object for contract visibility
        // filter out undefined values for valid JSON representation
        const rawMetadata = (error as Error & { metadata?: Record<string, unknown> }).metadata;
        const cleanMetadata = rawMetadata
          ? Object.fromEntries(
              Object.entries(rawMetadata).filter(([, v]) => v !== undefined),
            )
          : undefined;
        const errorSnapshot = {
          name: error.name,
          message: error.message,
          // include all error properties for full contract visibility
          ...(error.cause ? { cause: String(error.cause) } : {}),
          ...(cleanMetadata ? { metadata: cleanMetadata } : {}),
          ...((error as Error & { service?: unknown }).service
            ? { service: (error as Error & { service?: unknown }).service }
            : {}),
          ...((error as Error & { function?: unknown }).function
            ? { function: (error as Error & { function?: unknown }).function }
            : {}),
          ...((error as Error & { errorType?: unknown }).errorType
            ? { errorType: (error as Error & { errorType?: unknown }).errorType }
            : {}),
          messageContainsValidation: error.message.includes('validation'),
        };
        expect(errorSnapshot).toMatchSnapshot();
      });
    });

    when('[t3] invoked with non-existent function', () => {
      then('handler returns function not found error', async () => {
        const error = await getError(
          async () =>
            askLambdaEndpoint<
              z.infer<typeof goSurfSchema.input>,
              z.infer<typeof goSurfSchema.output>
            >(
              {
                which: {
                  service: 'svc-seaturtle',
                  function: 'nonexistentFunction',
                },
                event: {
                  ocean: 'pacific',
                  style: 'longboard',
                },
              },
              {
                ...genTestLog(),
                env: { access: 'prod', region: 'us-east-1' },
              },
            ),
        );
        expect(error).toBeDefined();
        // snapshot error for contract visibility
        const errorSnapshot = {
          name: error.name,
          messageContainsNotFound:
            error.message.includes('not found') ||
            error.message.includes('ResourceNotFoundException') ||
            error.message.includes('Function not found'),
          ...((error as Error & { service?: unknown }).service
            ? { service: (error as Error & { service?: unknown }).service }
            : {}),
          ...((error as Error & { function?: unknown }).function
            ? { function: (error as Error & { function?: unknown }).function }
            : {}),
        };
        expect(errorSnapshot).toMatchSnapshot();
      });
    });
  });
});
