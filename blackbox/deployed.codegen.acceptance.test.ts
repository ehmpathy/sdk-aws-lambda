/**
 * .what = e2e acceptance: run the sdk codegen against a REAL prep-deployed
 *         service whose handler surfaces a domain-object via `.contract`
 * .why = the vision's "aha" — proves the captured `SvcSurfSeaturtleSurfboard`
 *        IS the upstream dobj, reconstructed from a real `z.toJSONSchema`
 *        round-trip over the wire, with its identity + key metadata intact
 *
 * this test:
 * 1. bundles + deploys a getSurfboard handler (schema uses SeaturtleSurfboard.contract)
 * 2. runs genServiceSdk against the real deployed svc-surf service
 * 3. verifies the generated resources reconstruct the dobj with metadata
 */
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import * as esbuild from 'esbuild';

import {
  LambdaClient,
  waitUntilFunctionActiveV2,
  waitUntilFunctionUpdatedV2,
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
import { given, then, useBeforeAll, when } from 'test-fns';

import { genServiceSdk } from '../src/index';

const { log } = genContextLogTrail({ trail: null, env: null });

/**
 * .what = retry with backoff for AWS eventual consistency (IAM propagation)
 */
const withRetry = async <T>(
  operation: () => Promise<T>,
  options: { maxAttempts: number; backoffMs: number; shouldRetry: (error: Error) => boolean },
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

const HANDLER_SOURCE = resolve(
  __dirname,
  './__test_assets__/surfboardContractHandler.ts',
);
const BUILD_DIR = resolve(__dirname, '../.build');
const BUNDLE_PATH = join(BUILD_DIR, 'surfboardContractHandler.js');
const ZIP_PATH = join(BUILD_DIR, 'surfboardContractHandler.zip');

const ROLE_NAME = 'sdk-aws-lambda-e2e-seaturtle-role';
const SERVICE = 'svc-surf';
const FUNCTION = 'getSurfboard';
const LAMBDA_NAME = `${SERVICE}-prep-${FUNCTION}`;

const bundleHandler = async (): Promise<void> => {
  await mkdir(BUILD_DIR, { recursive: true });
  await esbuild.build({
    entryPoints: [HANDLER_SOURCE],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: BUNDLE_PATH,
    external: ['@aws-sdk/*'],
  });
};

const createZip = async (): Promise<void> => {
  const output = (await import('fs')).createWriteStream(ZIP_PATH);
  // archiver's runtime module exports `ZipArchive` (see archiver/index.js:8
  // `export class ZipArchive extends Archiver`), but its shipped .d.ts models the
  // package as a factory fn, so the named export is absent from its types. cast at
  // this external-package boundary; removable once archiver's types expose it.
  const { ZipArchive } = (await import('archiver')) as unknown as {
    ZipArchive: new (options: { zlib: { level: number } }) => import('archiver').Archiver;
  };
  const archive = new ZipArchive({ zlib: { level: 9 } });
  return new Promise((done, fail) => {
    output.on('close', () => done());
    archive.on('error', fail);
    archive.pipe(output);
    archive.file(BUNDLE_PATH, { name: 'surfboardContractHandler.js' });
    archive.finalize();
  });
};

describe('e2e: deployed codegen (real fidelity)', () => {
  const scene = useBeforeAll(async () => {
    // require AWS credentials (profile or keys)
    const hasProfile = !!process.env.AWS_PROFILE;
    const hasKeys =
      !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
    if (!hasProfile && !hasKeys)
      throw new ConstraintError('AWS credentials required for e2e test', {
        hint: 'run: rhx keyrack unlock --owner ehmpath --env prep',
      });

    // bundle + zip the handler
    await bundleHandler();
    await createZip();

    // provider sources credentials
    const provider = await getDeclastructAwsProvider({}, { log: console });
    const context = provider.context;

    // shared iam role
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

    // the getSurfboard lambda (introspection-enabled: env.access = prep)
    const lambda = DeclaredAwsLambda.as({
      name: LAMBDA_NAME,
      runtime: 'nodejs20.x',
      handler: 'surfboardContractHandler.handler',
      timeout: 30,
      memory: 128,
      role: RefByUnique.as<typeof DeclaredAwsIamRole>({ name: ROLE_NAME }),
      envars: { NODE_ENV: 'test' },
      code: genDeclaredAwsLambdaCode({ zipUri: ZIP_PATH }),
      tags: { managedBy: 'declastruct', purpose: 'e2e-acceptance-test' },
    });

    await withRetry(() => setLambda({ upsert: lambda }, context), {
      maxAttempts: 5,
      backoffMs: 3000,
      shouldRetry: (error) =>
        error.message.includes('role') ||
        error.message.includes('AssumeRole') ||
        error.message.includes('cannot be assumed'),
    });

    // wait for the lambda to be active (covers the initial-create path)
    const sdkLambda = new LambdaClient({ region: 'us-east-1' });
    await waitUntilFunctionActiveV2(
      { client: sdkLambda, maxWaitTime: 60 },
      { FunctionName: LAMBDA_NAME },
    );

    // wait for the code UPDATE to fully propagate before the introspection call. on
    // an update (vs a create), `State` stays `Active` throughout while
    // `LastUpdateStatus` goes InProgress → Successful; without this wait the
    // introspection can hit the STALE code + capture the prior schema (a real flake
    // observed when the fixture's shape changed). waitUntilFunctionUpdatedV2 blocks
    // on `LastUpdateStatus: Successful`, so the introspection always sees new code.
    await waitUntilFunctionUpdatedV2(
      { client: sdkLambda, maxWaitTime: 60 },
      { FunctionName: LAMBDA_NAME },
    );

    // run the codegen against the REAL deployed service into a temp dir
    const dir = await mkdtemp(join(tmpdir(), 'codegen-deployed-'));
    await genServiceSdk(
      { which: { service: SERVICE }, into: dir },
      { log, env: { access: 'prep', region: 'us-east-1' } },
    );
    const names = await readdir(dir);
    const files = Object.fromEntries(
      await Promise.all(
        names.map(async (n) => [n, await readFile(join(dir, n), 'utf-8')] as const),
      ),
    );
    return { dir, files };
  });
  afterAll(async () => {
    if (scene.dir) await rm(scene.dir, { recursive: true, force: true });
  });

  given('[case1] the codegen runs against the real deployed svc-surf', () => {
    when('[t0] the generated resources are inspected', () => {
      then('the captured dobj is prefixed with the originator service', () => {
        const resources = scene.files['svcSurf.resources.ts'] ?? '';
        expect(resources).toContain('SvcSurfSeaturtleSurfboard');
      });

      then('it reconstructs as a DomainEntity with the upstream keys', () => {
        const resources = scene.files['svcSurf.resources.ts'] ?? '';
        expect(resources).toContain(
          'extends DomainEntity<SvcSurfSeaturtleSurfboard>',
        );
        // biome formats the generated file with single quotes
        expect(resources).toContain(`public static primary = ['uuid'] as const;`);
        expect(resources).toContain(
          `public static unique = ['brand', 'length'] as const;`,
        );
      });

      then('it reconstructs the nested inline object shape', () => {
        const resources = scene.files['svcSurf.resources.ts'] ?? '';
        // the nested `length: { inches: number }` shape is reconstructed inline in
        // the interface (a plain nested object, not a separate dobj resource)
        expect(resources).toContain('length: { inches: number }');
      });

      then('it carries the propagated alias', () => {
        const resources = scene.files['svcSurf.resources.ts'] ?? '';
        expect(resources).toContain('public static alias =');
        expect(resources).toContain('surfboard');
      });

      then('it carries no re-declared validation schema', () => {
        const resources = scene.files['svcSurf.resources.ts'] ?? '';
        expect(resources).not.toContain('static schema');
      });
    });

    when('[t1] the generated mechanisms are inspected', () => {
      then('the svcSurf object exposes the getSurfboard fn', () => {
        const mechanisms = scene.files['svcSurf.mechanisms.ts'] ?? '';
        expect(mechanisms).toContain('export const svcSurf = {');
        expect(mechanisms).toContain('getSurfboard:');
      });
    });

    when('[t2] the full generated files are captured', () => {
      then('the barrel matches snapshot', () => {
        expect(scene.files['svcSurf.ts']).toBeDefined();
        expect(scene.files['svcSurf.ts']).toMatchSnapshot();
      });

      then('the mechanisms file matches snapshot', () => {
        expect(scene.files['svcSurf.mechanisms.ts']).toBeDefined();
        expect(scene.files['svcSurf.mechanisms.ts']).toMatchSnapshot();
      });

      then('the resources file matches snapshot', () => {
        expect(scene.files['svcSurf.resources.ts']).toBeDefined();
        expect(scene.files['svcSurf.resources.ts']).toMatchSnapshot();
      });
    });
  });
});
