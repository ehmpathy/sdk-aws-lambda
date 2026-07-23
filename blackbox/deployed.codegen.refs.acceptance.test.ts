/**
 * .what = e2e acceptance: run the sdk codegen against a REAL prep-deployed
 *         service whose handlers surface domain-object REFERENCES via the real
 *         `X.contract.ref(by)` (domain-objects@0.33.0)
 * .why = proves the ref roundtrip end-to-end over the wire — the deployed
 *        getTrophy's `x-domain-object-ref` pragma survives `z.toJSONSchema`, and
 *        the codegen reconstructs `RefByPrimary`/`RefByUnique`/`Ref<typeof Svc...>`
 *        bound against the peer-surfaced prefixed resources
 *
 * this test:
 * 1. bundles one asset with four handler exports (getTrophy + 3 peers)
 * 2. deploys each as its own lambda under svc-trophy (prep)
 * 3. runs genServiceSdk against the real deployed svc-trophy service
 * 4. verifies the generated resources reconstruct each ref with its generic
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
  './__test_assets__/refTrophyHandlers.ts',
);
const BUILD_DIR = resolve(__dirname, '../.build');
const BUNDLE_PATH = join(BUILD_DIR, 'refTrophyHandlers.js');
const ZIP_PATH = join(BUILD_DIR, 'refTrophyHandlers.zip');

const ROLE_NAME = 'sdk-aws-lambda-e2e-trophy-role';
const SERVICE = 'svc-trophy';

// each lambda: [bare function name, handler export] — one bundle, four exports
const FUNCTIONS = [
  { fn: 'getTrophy', export: 'getTrophy' },
  { fn: 'getRider', export: 'getRider' },
  { fn: 'getBoard', export: 'getBoard' },
  { fn: 'getSponsor', export: 'getSponsor' },
] as const;

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
    archive.file(BUNDLE_PATH, { name: 'refTrophyHandlers.js' });
    archive.finalize();
  });
};

describe('e2e: deployed codegen refs (real fidelity)', () => {
  const scene = useBeforeAll(async () => {
    // require AWS credentials (profile or keys)
    const hasProfile = !!process.env.AWS_PROFILE;
    const hasKeys =
      !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
    if (!hasProfile && !hasKeys)
      throw new ConstraintError('AWS credentials required for e2e test', {
        hint: 'run: rhx keyrack unlock --owner ehmpath --env prep',
      });

    // bundle + zip the four-export handler asset
    await bundleHandler();
    await createZip();

    // provider sources credentials
    const provider = await getDeclastructAwsProvider({}, { log: console });
    const context = provider.context;

    // shared iam role
    const role = DeclaredAwsIamRole.as({
      name: ROLE_NAME,
      path: '/',
      description: 'role for sdk-aws-lambda e2e ref acceptance test',
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

    const sdkLambda = new LambdaClient({ region: 'us-east-1' });

    // deploy each function as its own lambda (all point at the same zip, each at
    // its own handler export), then wait for active + code-update propagation
    for (const spec of FUNCTIONS) {
      const lambdaName = `${SERVICE}-prep-${spec.fn}`;
      const lambda = DeclaredAwsLambda.as({
        name: lambdaName,
        runtime: 'nodejs20.x',
        handler: `refTrophyHandlers.${spec.export}`,
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

      // wait for active (covers create), then for the code UPDATE to propagate —
      // `waitUntilFunctionUpdatedV2` blocks on `LastUpdateStatus: Successful`, so
      // the introspection never hits stale code (see deployed.codegen note)
      await waitUntilFunctionActiveV2(
        { client: sdkLambda, maxWaitTime: 60 },
        { FunctionName: lambdaName },
      );
      await waitUntilFunctionUpdatedV2(
        { client: sdkLambda, maxWaitTime: 60 },
        { FunctionName: lambdaName },
      );
    }

    // run the codegen against the REAL deployed svc-trophy service into a temp dir
    const dir = await mkdtemp(join(tmpdir(), 'codegen-deployed-refs-'));
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

  given('[case1] the codegen runs against the real deployed svc-trophy', () => {
    when('[t0] the generated resources reconstruct the refs', () => {
      then('the rider is a RefByPrimary against the prefixed Seaturtle', () => {
        const resources = scene.files['svcTrophy.resources.ts'] ?? '';
        expect(resources).toContain(
          'rider: RefByPrimary<typeof SvcTrophySeaturtle>;',
        );
      });

      then('the board is a RefByUnique against the prefixed Surfboard', () => {
        const resources = scene.files['svcTrophy.resources.ts'] ?? '';
        expect(resources).toContain(
          'board: RefByUnique<typeof SvcTrophySurfboard>;',
        );
      });

      then('the sponsor is a Ref against the prefixed Sponsor', () => {
        const resources = scene.files['svcTrophy.resources.ts'] ?? '';
        expect(resources).toContain('sponsor: Ref<typeof SvcTrophySponsor>;');
      });

      then('the ref generics are imported from domain-objects', () => {
        const resources = scene.files['svcTrophy.resources.ts'] ?? '';
        expect(resources).toContain('Ref');
        expect(resources).toContain('RefByPrimary');
        expect(resources).toContain('RefByUnique');
        expect(resources).toContain(`from 'domain-objects';`);
      });

      then('each referenced dobj is declared in full so the refs bind', () => {
        const resources = scene.files['svcTrophy.resources.ts'] ?? '';
        expect(resources).toContain('export class SvcTrophySeaturtle');
        expect(resources).toContain('export class SvcTrophySurfboard');
        expect(resources).toContain('export class SvcTrophySponsor');
      });
    });

    when('[t1] the generated mechanisms are inspected', () => {
      then('the svcTrophy object exposes all four fns', () => {
        const mechanisms = scene.files['svcTrophy.mechanisms.ts'] ?? '';
        expect(mechanisms).toContain('export const svcTrophy = {');
        expect(mechanisms).toContain('getTrophy:');
        expect(mechanisms).toContain('getRider:');
        expect(mechanisms).toContain('getBoard:');
        expect(mechanisms).toContain('getSponsor:');
      });
    });

    when('[t2] the full generated files are captured', () => {
      then('the barrel matches snapshot', () => {
        expect(scene.files['svcTrophy.ts']).toBeDefined();
        expect(scene.files['svcTrophy.ts']).toMatchSnapshot();
      });

      then('the mechanisms file matches snapshot', () => {
        expect(scene.files['svcTrophy.mechanisms.ts']).toBeDefined();
        expect(scene.files['svcTrophy.mechanisms.ts']).toMatchSnapshot();
      });

      then('the resources file matches snapshot', () => {
        expect(scene.files['svcTrophy.resources.ts']).toBeDefined();
        expect(scene.files['svcTrophy.resources.ts']).toMatchSnapshot();
      });
    });
  });
});
