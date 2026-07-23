import { given, then, useThen, when } from 'test-fns';

import { formatTypescript } from './formatTypescript';

/**
 * .what = integration test for the biome formatter communicator
 * .why = it spawns the real biome native cli over a subprocess (an i/o boundary),
 *        so this is an integration test; it proves biome cleans the emitter's raw
 *        text (whitespace, quote consistency, layout) — the defects the L3 review
 *        found
 */
describe('formatTypescript', () => {
  given(
    '[case1] cramped generated resources text (raw-json alias, single-line interface)',
    () => {
      const messy = [
        '/**',
        ' * 🦾 generated — do not edit.',
        ' */',
        "import { DomainEntity } from 'domain-objects';",
        'export interface SvcJobsJob { uuid: string; title: string; }',
        'export class SvcJobsJob extends DomainEntity<SvcJobsJob> implements SvcJobsJob {',
        '  public static primary = ["uuid"] as const;',
        '  public static alias = { singular: "job", plural: "jobs" };',
        '}',
        '',
      ].join('\n');

      when('[t0] passed through biome', () => {
        // format once, then re-format the output — captures both to prove idempotency
        const results = useThen('biome formats it', async () => {
          const once = await formatTypescript({
            content: messy,
            path: 'svcJobs.resources.ts',
          });
          const twice = await formatTypescript({
            content: once,
            path: 'svcJobs.resources.ts',
          });
          return { once, twice };
        });

        then('it is a non-empty string that still declares the class', () => {
          expect(typeof results.once).toBe('string');
          expect(results.once).toContain(
            'export class SvcJobsJob extends DomainEntity',
          );
        });

        then('the class body + statics survive intact', () => {
          expect(results.once).toContain('public static primary');
          expect(results.once).toContain('public static alias');
          expect(results.once).toContain('singular');
          expect(results.once).toContain('plural');
        });

        then('the alias object keys are unquoted (no raw-json blemish)', () => {
          // biome normalizes { singular: ... } — never emits {"singular":...}
          expect(results.once).not.toContain('{"singular"');
          expect(results.once).not.toContain('{ "singular"');
        });

        then(
          'biome actually ran (quotes normalized to single per config, not a no-op)',
          () => {
            // proves the virtual src-path made biome format (not skip as out-of-includes):
            // the double-quoted `["uuid"]` + `"job"` become single-quoted
            expect(results.once).toContain("['uuid']");
            expect(results.once).toContain("singular: 'job'");
            expect(results.once).not.toContain('"uuid"');
          },
        );

        then(
          'the robot-arm glyph survives the biome/stdin pipe (not mangled)',
          () => {
            // guards the 5.3-i4 gotcha: an earlier alert emoji was mangled to `!` by
            // the pipe. the banner's robot arm must round-trip through biome intact.
            expect(results.once).toContain('🦾 generated — do not edit.');
            expect(results.once).not.toContain('! generated');
          },
        );

        then('the output is biome-idempotent (a re-format is a no-op)', () => {
          expect(results.twice).toEqual(results.once);
        });
      });
    },
  );
});
