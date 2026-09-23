/**
 * .what = e2e acceptance: run the sdk codegen against a REAL prep-deployed
 *         service whose handler surfaces a domain-object via `X.contract()`
 * .why = the vision's "aha" — proves the captured `SvcSurfSeaturtleSurfboard`
 *        IS the upstream dobj, reconstructed from a real `z.toJSONSchema`
 *        round-trip over the wire, with its identity + key metadata intact
 *
 * this test:
 * 1. bundles + deploys a getSurfboard handler (schema uses SeaturtleSurfboard.contract())
 * 2. runs genServiceSdk against the real deployed svc-surf service
 * 3. verifies the generated resources reconstruct the dobj with metadata
 */
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { DeclaredAwsLambda, genDeclaredAwsLambdaCode } from 'declastruct-aws';
import { genContextLogTrail } from 'sdk-logs';
import { given, then, useBeforeAll, when } from 'test-fns';

import { genServiceSdk } from '../src/index';
import { getOneDeployContext } from './__test_assets__/getOneDeployContext';
import {
  LAMBDA_DEPLOY_HOOK_BUDGET_MS,
  setLambdaLive,
} from './__test_assets__/setLambdaLive';
import { setLambdaRole } from './__test_assets__/setLambdaRole';
import { setLambdaZip } from './__test_assets__/setLambdaZip';

const { log } = genContextLogTrail({ trail: null, env: null });

const HANDLER_SOURCE = resolve(
  __dirname,
  './__test_assets__/surfboardContractHandler.ts',
);
const BUILD_DIR = resolve(__dirname, '../.build');
const BUNDLE_NAME = 'surfboardContractHandler';

const ROLE_NAME = 'sdk-aws-lambda-e2e-seaturtle-role';
const SERVICE = 'svc-surf';
const FUNCTION = 'getSurfboard';
const LAMBDA_NAME = `${SERVICE}-prep-${FUNCTION}`;
const REGION = 'us-east-1';

// this suite deploys ONE lambda, so its hook takes the whole-hook budget — the preflight
// (bundle + creds + iam role) plus the one `setLambdaLive` that follows it
jest.setTimeout(LAMBDA_DEPLOY_HOOK_BUDGET_MS);

describe('e2e: deployed codegen (real fidelity)', () => {
  const scene = useBeforeAll(async () => {
    // bundle + zip the handler
    const { zipPath } = await setLambdaZip({
      handlerSource: HANDLER_SOURCE,
      buildDir: BUILD_DIR,
      bundleName: BUNDLE_NAME,
    });

    // credentials, then the shared iam role the lambda below assumes
    const { context } = await getOneDeployContext();
    const { ref: roleRef } = await setLambdaRole(
      {
        name: ROLE_NAME,
        description: 'role for sdk-aws-lambda e2e acceptance test',
      },
      context,
    );

    // the getSurfboard lambda (introspection-enabled: env.access = prep)
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

    // upsert it and block until the code the introspection will read is THIS code
    await setLambdaLive({ lambda, region: REGION }, context);

    // run the codegen against the REAL deployed service into a temp dir
    const dir = await mkdtemp(join(tmpdir(), 'codegen-deployed-'));
    await genServiceSdk(
      { which: { service: SERVICE }, into: dir },
      { log, env: { access: 'prep', region: REGION } },
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
