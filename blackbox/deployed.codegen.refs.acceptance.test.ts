/**
 * .what = e2e acceptance: run the sdk codegen against a REAL prep-deployed
 *         service whose handlers surface domain-object REFERENCES via the real
 *         `X.contract().ref(by)`
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
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { DeclaredAwsLambda, genDeclaredAwsLambdaCode } from 'declastruct-aws';
import { genContextLogTrail } from 'sdk-logs';
import { given, then, useBeforeAll, useThen, when } from 'test-fns';

import { genServiceSdk, getOneLambdaContract } from '../src/index';
import { getOneDeployContext } from './__test_assets__/getOneDeployContext';
import {
  LAMBDA_DEPLOY_BUDGET_MS,
  LAMBDA_DEPLOY_PREFLIGHT_BUDGET_MS,
  setLambdaLive,
} from './__test_assets__/setLambdaLive';
import { setLambdaRole } from './__test_assets__/setLambdaRole';
import { setLambdaZip } from './__test_assets__/setLambdaZip';

const { log } = genContextLogTrail({ trail: null, env: null });

const HANDLER_SOURCE = resolve(
  __dirname,
  './__test_assets__/refTrophyHandlers.ts',
);
const BUILD_DIR = resolve(__dirname, '../.build');
const BUNDLE_NAME = 'refTrophyHandlers';

const ROLE_NAME = 'sdk-aws-lambda-e2e-trophy-role';
const SERVICE = 'svc-trophy';
const REGION = 'us-east-1';

// each lambda: [bare function name, handler export] — one bundle, four exports
const FUNCTIONS = [
  { fn: 'getTrophy', export: 'getTrophy' },
  { fn: 'getRider', export: 'getRider' },
  { fn: 'getBoard', export: 'getBoard' },
  { fn: 'getSponsor', export: 'getSponsor' },
] as const;

// this suite deploys FOUR lambdas in series, so its hook needs four `setLambdaLive`
// budgets — plus the preflight ONCE, never once per lambda: one bundle and one iam role
// serve all four, since they share a single zip with four exports
jest.setTimeout(
  LAMBDA_DEPLOY_PREFLIGHT_BUDGET_MS +
    LAMBDA_DEPLOY_BUDGET_MS * FUNCTIONS.length,
);

describe('e2e: deployed codegen refs (real fidelity)', () => {
  const scene = useBeforeAll(async () => {
    // bundle + zip the four-export handler asset
    const { zipPath } = await setLambdaZip({
      handlerSource: HANDLER_SOURCE,
      buildDir: BUILD_DIR,
      bundleName: BUNDLE_NAME,
    });

    // credentials, then the shared iam role each lambda below assumes
    const { context } = await getOneDeployContext();
    const { ref: roleRef } = await setLambdaRole(
      {
        name: ROLE_NAME,
        description: 'role for sdk-aws-lambda e2e ref acceptance test',
      },
      context,
    );

    // deploy each function as its own lambda (all point at the same zip, each at
    // its own handler export), and block until each one's code is live
    for (const spec of FUNCTIONS) {
      const lambda = DeclaredAwsLambda.as({
        name: `${SERVICE}-prep-${spec.fn}`,
        runtime: 'nodejs20.x',
        handler: `${BUNDLE_NAME}.${spec.export}`,
        timeout: 30,
        memory: 128,
        role: roleRef,
        envars: { NODE_ENV: 'test' },
        code: genDeclaredAwsLambdaCode({ zipUri: zipPath }),
        tags: { managedBy: 'declastruct', purpose: 'e2e-acceptance-test' },
      });
      await setLambdaLive({ lambda, region: REGION }, context);
    }

    // run the codegen against the REAL deployed svc-trophy service into a temp dir
    const dir = await mkdtemp(join(tmpdir(), 'codegen-deployed-refs-'));
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

  /**
   * .what = the BYTES a direct `{ introspect: 'schema' }` consumer meets, pinned
   *         against the real deployed getTrophy
   * .why = case1 proves the pragmas survive the wire by their DOWNSTREAM EFFECT —
   *        the codegen cannot emit `RefByPrimary`/`RefByUnique`/`Ref` unless they
   *        crossed intact. that leaves the payload itself pinned nowhere, so a
   *        consumer who reads the contract directly (never through the codegen) has
   *        no byte-exact contract to hold
   *
   * .why HERE, not in `deployed.introspection.acceptance.test.ts` = the subject is a
   *      DEPLOYED DOBJ payload, and the four lambdas that carry one are the four this
   *      suite's own hook already put live. to host it there would deploy a fifth
   *      lambda for a schema these four already publish, and would charge the cold
   *      budget `F34` measured as insufficient. `deployed.introspection` carries a
   *      pointer at this case so a reader who looks there is not told it is absent
   *
   * .note = `getTrophy` is the one endpoint that carries EVERY pragma shape at once —
   *         `x-domain-object` on the trophy, plus all three ref flavors beneath it
   *         (rider by primary, board by unique, sponsor bare). so one payload pins
   *         the whole marker family
   */
  given('[case2] a direct consumer introspects the deployed trophy', () => {
    when('[t0] getOneLambdaContract is called against the live getTrophy', () => {
      const contract = useThen('returns the endpoint schema', async () =>
        getOneLambdaContract(
          { which: { service: SERVICE, function: 'getTrophy' } },
          { log, env: { access: 'prep', region: REGION } },
        ),
      );

      then('the output carries the x-domain-object pragma for SurfTrophy', () => {
        const trophy = (
          contract.output as {
            properties?: { trophy?: { 'x-domain-object'?: { name?: string } } };
          }
        ).properties?.trophy;
        expect(trophy).toBeDefined();
        expect(trophy?.['x-domain-object']?.name).toEqual('SurfTrophy');
      });

      then('each ref field carries its x-domain-object-ref pragma', () => {
        const fields = (
          contract.output as {
            properties?: {
              trophy?: {
                properties?: Record<
                  string,
                  { 'x-domain-object-ref'?: { of?: string; by?: string } }
                >;
              };
            };
          }
        ).properties?.trophy?.properties;
        expect(fields).toBeDefined();
        expect(fields?.rider?.['x-domain-object-ref']).toEqual({
          of: 'Seaturtle',
          by: 'primary',
        });
        expect(fields?.board?.['x-domain-object-ref']).toEqual({
          of: 'Surfboard',
          by: 'unique',
        });
        // .note = a BARE `.ref()` still carries a `by` — the pragma's `by` is required
        //         and `'ref'` is its third legal value, the union of primary|unique
        //         (`domain-objects/dist/manipulation/DomainObjectPragma.d.ts:83,114`).
        //         an absent `by` was this test's own first guess, and the deployed
        //         payload refuted it
        expect(fields?.sponsor?.['x-domain-object-ref']).toEqual({
          of: 'Sponsor',
          by: 'ref',
        });
      });

      then('the published payload matches snapshot', () => {
        expect(contract).toMatchSnapshot();
      });
    });
  });
});
