import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { LambdaClient } from '@aws-sdk/client-lambda';
import { DomainEntity } from 'domain-objects';
import { given, then, useBeforeAll, when } from 'test-fns';
import { z } from 'zod';

import { asCapturableServiceSdk } from '../src/__test_assets__/asCapturableServiceSdk';
import { createInProcessLambdaHarness } from '../src/__test_assets__/createInProcessLambdaHarness';
import { gen } from '../src/contract/cli/gen';
import { genLambdaEndpoint } from '../src/index';

/**
 * .what = acceptance test for the sdk codegen — the generated file text (the
 *         codegen's contract stdout) + the cli error paths, snapshotted
 * .why = the generated files are what a consumer commits; snapshots let PR
 *        reviewers visually verify the emitted sdk, and catch drift
 *
 * .mock = in-process lambda transport (asCapturableServiceSdk)
 *   .rule = rule.forbid.acceptance.mocks
 * .why = the harness runs the REAL genLambdaEndpoint handlers and only fakes the
 *        sdk transport, so the codegen runs end-to-end without a deploy per case.
 * .real = real-service fidelity is verified in
 *         blackbox/deployed.codegen.acceptance.test.ts against a deployed svc.
 */
describe('codegen (local)', () => {
  given('[case1] a capturable service (svc-jobs, in-process)', () => {
    // the happy path runs the FULL cli contract: gen({ argv }) parses the flags →
    // routes --env into ambient access → genServiceSdk → writes files. the
    // in-process sdk is injected via context.aws (the cli's test seam), so the
    // whole file exercises the `gen` contract (not the bare orchestrator).
    const scene = useBeforeAll(async () => {
      const dir = await mkdtemp(join(tmpdir(), 'codegen-cli-'));
      const result = await gen(
        { argv: ['--for', 'svc-jobs', '--into', dir, '--env', 'prep'] },
        { aws: { lambda: { sdk: asCapturableServiceSdk() } } },
      );
      const names = await readdir(dir);
      const files = Object.fromEntries(
        await Promise.all(
          names.map(
            async (name) =>
              [name, await readFile(join(dir, name), 'utf-8')] as const,
          ),
        ),
      );
      return { dir, files, result };
    });
    afterAll(async () => rm(scene.dir, { recursive: true, force: true }));

    when('[t0] the sdk is generated', () => {
      then('the cli exits 0 with no error message', () => {
        expect(scene.result.exit).toEqual(0);
        expect(scene.result.message).toBeNull();
      });

      then('the barrel matches snapshot', () => {
        const barrel = scene.files['svcJobs.ts'] ?? '';
        // explicit assertions before snapshot: the barrel re-exports both files
        expect(barrel).toContain(
          `export { svcJobs } from './svcJobs.mechanisms';`,
        );
        expect(barrel).toContain(`export * from './svcJobs.resources';`);
        expect(barrel).toMatchSnapshot();
      });

      then('the mechanisms file matches snapshot', () => {
        const mechanisms = scene.files['svcJobs.mechanisms.ts'] ?? '';
        // explicit assertions before snapshot: the svcJobs object exposes each fn
        expect(mechanisms).toContain('export const svcJobs = {');
        expect(mechanisms).toContain('getJob:');
        expect(mechanisms).toContain('getJobs:');
        expect(mechanisms).toMatchSnapshot();
      });

      then('the resources file matches snapshot (dobj capture, metadata, no schema)', () => {
        const resources = scene.files['svcJobs.resources.ts'] ?? '';
        // explicit assertions before snapshot
        expect(resources).toContain('SvcJobsJob');
        expect(resources).toContain('static primary');
        expect(resources).not.toContain('static schema');
        expect(resources).toMatchSnapshot();
      });
    });
  });

  // the cli error paths that fail before any AWS call — each exits 2, no files.
  // exhaustive over every pre-AWS variant so the acceptance-layer cli contract is
  // fully vibecheckable (arg-validation + the prep access gate)
  const CLI_ERROR_CASES = [
    { description: 'absent --for', argv: ['--into', 'd', '--env', 'prep'] },
    { description: 'non-svc --for', argv: ['--for', 'jobs', '--into', 'd', '--env', 'prep'] },
    { description: 'absent --into', argv: ['--for', 'svc-jobs', '--env', 'prep'] },
    { description: 'absent --env', argv: ['--for', 'svc-jobs', '--into', 'd'] },
    { description: 'bad --env', argv: ['--for', 'svc-jobs', '--into', 'd', '--env', 'sandbox'] },
    { description: 'blocked outside prep (--env prod)', argv: ['--for', 'svc-jobs', '--into', '/tmp/x', '--env', 'prod'] },
  ];

  given('[case2] cli error paths', () => {
    CLI_ERROR_CASES.map((thisCase, index) =>
      when(`[t${index}] ${thisCase.description}`, () => {
        then('it exits 2 (constraint) and the exit is stable', async () => {
          const result = await gen({ argv: thisCase.argv });
          expect(result.exit).toEqual(2);
          expect(result).toMatchSnapshot();
        });
      }),
    );
  });

  // the cli error paths that fail AFTER the aws introspection call. the pre-AWS
  // CLI_ERROR_CASES never reach the spine; these lock the `gen` contract's
  // { exit, message } surface for each distinct post-AWS failure — the actual
  // user-visible messages, which would otherwise drift unsnapped.

  // a fake sdk whose ListFunctions yields no endpoints → LambdaServiceNotFoundError
  const asServiceNotFoundSdk = (): LambdaClient =>
    ({
      // .rule = rule.forbid.acceptance.mocks — transport-only fake: an empty
      //         function set. real fidelity is proven in the deployed test.
      send: jest.fn().mockImplementation(async (command) => {
        if (command.constructor.name === 'ListFunctionsCommand')
          return { Functions: [], NextMarker: undefined };
        throw new Error('unexpected command in service-not-found sdk');
      }),
    }) as unknown as LambdaClient;

  // a fake sdk that lists a prod-gated endpoint: introspected in prep, the handler
  // blocks + returns a non-schema payload → LambdaIntrospectionNotSupportedError
  const asNotSupportedSdk = (): LambdaClient => {
    const handlers = {
      getLegacy: genLambdaEndpoint(
        {
          schema: {
            input: z.object({ id: z.string() }),
            output: z.object({ ok: z.boolean() }),
          },
          invoke: async () => ({ ok: true }),
        },
        { env: { access: 'prod' } },
      ),
    };
    const { mockSend } = createInProcessLambdaHarness({ 'svc-jobs': handlers });
    return {
      // .rule = rule.forbid.acceptance.mocks — transport-only fake (see file jsdoc)
      send: jest.fn().mockImplementation(async (command) => {
        if (command.constructor.name === 'ListFunctionsCommand')
          return {
            Functions: [{ FunctionName: 'svc-jobs-prep-getLegacy' }],
            NextMarker: undefined,
          };
        return mockSend(command);
      }),
    } as unknown as LambdaClient;
  };

  // a fake sdk whose endpoint surfaces a schema-less pragma-tagged dobj that the
  // codegen cannot reconstruct → LambdaDomainObjectNotCapturableError
  const asUncapturableSdk = (): LambdaClient => {
    // a REAL dobj whose `static schema` is empty: `X.contract()` stamps the pragma onto
    // a shape with no properties, so the codegen cannot reconstruct it (uc.9). this
    // exercises the production `X.contract()` → empty-schema → pragma path.
    interface Ghost {
      id: string;
    }
    class Ghost extends DomainEntity<Ghost> implements Ghost {
      public static primary = ['id'] as const;
      public static schema = z.object({});
    }
    const handlers = {
      getGhost: genLambdaEndpoint(
        {
          schema: {
            input: z.object({ id: z.string() }),
            output: z.object({ ghost: Ghost.contract() }),
          },
          // .note = an instance, per the rule `refTrophyHandlers.ts` states. the empty schema
          //         is no exemption: uc.9 reads INTROSPECTION and never invokes this handler,
          //         measured on the `local.codegen.journey` twin before this landed
          invoke: async () => ({ ghost: new Ghost({ id: 'g1' }) }),
        },
        { env: { access: 'prep' } },
      ),
    };
    const { mockSend } = createInProcessLambdaHarness({ 'svc-jobs': handlers });
    return {
      // .rule = rule.forbid.acceptance.mocks — transport-only fake (see file jsdoc)
      send: jest.fn().mockImplementation(async (command) => {
        if (command.constructor.name === 'ListFunctionsCommand')
          return {
            Functions: [{ FunctionName: 'svc-jobs-prep-getGhost' }],
            NextMarker: undefined,
          };
        return mockSend(command);
      }),
    } as unknown as LambdaClient;
  };

  // a fake sdk whose transport raises an aws-style credentials error → the
  // discovery boundary maps it to a hinted LambdaCredentialsAbsentError (uc.7)
  const asNoCredentialsSdk = (): LambdaClient =>
    ({
      // .rule = rule.forbid.acceptance.mocks — transport-only fake: the aws sdk
      //         raises a CredentialsProviderError when creds are absent/expired
      send: jest.fn().mockImplementation(async () => {
        const error = new Error('Could not load credentials from any providers');
        error.name = 'CredentialsProviderError';
        throw error;
      }),
    }) as unknown as LambdaClient;

  const CLI_POST_AWS_ERROR_CASES = [
    { description: 'service not found (no endpoints)', sdk: asServiceNotFoundSdk },
    { description: 'endpoint lacks introspection support', sdk: asNotSupportedSdk },
    { description: 'dobj not capturable (schema-less)', sdk: asUncapturableSdk },
    { description: 'absent aws credentials', sdk: asNoCredentialsSdk },
  ];

  given('[case3] cli post-AWS error paths', () => {
    CLI_POST_AWS_ERROR_CASES.map((thisCase, index) =>
      when(`[t${index}] ${thisCase.description}`, () => {
        then('the cli exits 2 with a user-visible message (snapshot)', async () => {
          const dir = await mkdtemp(join(tmpdir(), 'codegen-cli-err-'));
          const result = await gen(
            { argv: ['--for', 'svc-jobs', '--into', dir, '--env', 'prep'] },
            { aws: { lambda: { sdk: thisCase.sdk() } } },
          );
          // explicit assertions before snapshot
          expect(result.exit).toEqual(2);
          expect(result.message).not.toBeNull();
          expect(result).toMatchSnapshot();
          // all-or-none invariant (uc.5/8/9): a failed run writes NO files — the
          // target dir stays empty, so a broken/half sdk is never emitted
          expect(await readdir(dir)).toEqual([]);
          await rm(dir, { recursive: true, force: true });
        });
      }),
    );
  });
});
