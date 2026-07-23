import { genContextLogTrail } from 'sdk-logs';
import { getError, given, then, useBeforeAll, when } from 'test-fns';

import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { asCapturableServiceSdk } from '../../__test_assets__/asCapturableServiceSdk';
import { genIntoTempDir } from '../../__test_assets__/genIntoTempDir';
import { LambdaIntrospectionBlockedError } from '../../domain.objects/LambdaIntrospectionBlockedError';
import { genServiceSdk } from './genServiceSdk';

/**
 * .mock = in-process lambda transport (asCapturableServiceSdk) + a faked
 *         ListFunctions response
 *   .rule = rule.forbid.integration.mocks
 * .why = the harness runs the REAL genLambdaEndpoint handlers and only fakes the
 *        sdk transport, so the codegen is exercised end-to-end (introspect →
 *        capture → emit) without a deploy per case. ListFunctions is faked to a
 *        fixed set so discovery is deterministic.
 * .real = real-service fidelity is verified in
 *         blackbox/deployed.codegen.acceptance.test.ts against a deployed svc.
 */

// alias to keep the case bodies terse
const asCapturableSdk = asCapturableServiceSdk;

describe('genServiceSdk', () => {
  given('[case1] a capturable service (svc-jobs)', () => {
    const scene = useBeforeAll(async () =>
      genIntoTempDir({
        service: 'svc-jobs',
        sdk: asCapturableSdk(),
        access: 'prep',
      }),
    );
    afterAll(async () => rm(scene.dir, { recursive: true, force: true }));

    when('[t0] the sdk is generated', () => {
      then('it emits exactly the three files', () => {
        expect(Object.keys(scene.files).sort()).toEqual([
          'svcJobs.mechanisms.ts',
          'svcJobs.resources.ts',
          'svcJobs.ts',
        ]);
      });

      then('the barrel re-exports mechanisms + resources', () => {
        expect(scene.files['svcJobs.ts']).toContain(
          `export { svcJobs } from './svcJobs.mechanisms';`,
        );
        expect(scene.files['svcJobs.ts']).toContain(
          `export * from './svcJobs.resources';`,
        );
      });

      then(
        'resources declare the prefixed dobjs (entity + nested literal)',
        () => {
          const resources = scene.files['svcJobs.resources.ts'] ?? '';
          // biome wraps long class headers across lines, so assert name + base
          // class separately (the class declaration is present either way)
          expect(resources).toContain('export class SvcJobsJob');
          expect(resources).toContain('extends DomainEntity<SvcJobsJob>');
          expect(resources).toContain('export class SvcJobsAddress');
          expect(resources).toContain('extends DomainLiteral<SvcJobsAddress>');
        },
      );

      then('the dobj is de-duped (declared once despite 2 endpoints)', () => {
        const resources = scene.files['svcJobs.resources.ts'] ?? '';
        const occurrences =
          resources.split('export class SvcJobsJob').length - 1;
        expect(occurrences).toEqual(1);
      });

      then('mechanisms expose one fn per endpoint', () => {
        const mechanisms = scene.files['svcJobs.mechanisms.ts'] ?? '';
        expect(mechanisms).toContain('getJob:');
        expect(mechanisms).toContain('getJobs:');
      });
    });
  });

  given('[case2] re-generation with an unchanged upstream', () => {
    when('[t0] generated twice', () => {
      then('the output is byte-identical (idempotent)', async () => {
        const first = await genIntoTempDir({
          service: 'svc-jobs',
          sdk: asCapturableSdk(),
          access: 'prep',
        });
        const second = await genIntoTempDir({
          service: 'svc-jobs',
          sdk: asCapturableSdk(),
          access: 'prep',
        });
        try {
          expect(second.files).toEqual(first.files);
        } finally {
          await rm(first.dir, { recursive: true, force: true });
          await rm(second.dir, { recursive: true, force: true });
        }
      });
    });
  });

  given('[case3] introspection blocked outside prep', () => {
    const { log } = genContextLogTrail({ trail: null, env: null });

    when('[t0] genServiceSdk is called with prod access', () => {
      then(
        'it throws LambdaIntrospectionBlockedError and writes no files',
        async () => {
          // a fresh parent temp dir; the target subdir must never be created
          const parent = await mkdtemp(join(tmpdir(), 'codegen-blocked-'));
          const into = join(parent, 'svcs');
          try {
            const error = await getError(
              genServiceSdk(
                { which: { service: 'svc-jobs' }, into },
                {
                  log,
                  env: { access: 'prod' },
                  aws: { lambda: { sdk: asCapturableSdk() } },
                },
              ),
            );
            expect(error).toBeInstanceOf(LambdaIntrospectionBlockedError);
            // recovery invariant: a blocked run leaves no files on disk
            expect(existsSync(into)).toBe(false);
          } finally {
            await rm(parent, { recursive: true, force: true });
          }
        },
      );
    });
  });
});
