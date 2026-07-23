import { given, then, useThen, when } from 'test-fns';

import { gen } from './gen';

/**
 * .what = cli-level integration: arg parse + error → exit-code map
 * .why = verifies the boundary behavior (uc.5/6/7/8/9 → exit 2) without a real
 *        deploy; the full happy-path (exit 0 + files) is covered by the local
 *        acceptance test against the in-process harness
 *
 * .note = these cases fail before any AWS call (bad args) or on the prep gate
 *         (env=prod), so they need no injected sdk
 */
describe('gen (cli)', () => {
  given('[case1] absent required args', () => {
    when('[t0] invoked with no args', () => {
      const result = useThen('it resolves', async () => gen({ argv: [] }));

      then('it exits 2 (constraint)', () => {
        expect(result.exit).toEqual(2);
      });

      then('the result matches snapshot', () => {
        // explicit content assertion before the snapshot: the user-visible
        // message must name the absent --for flag
        expect(result.message).toContain('--for');
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] invoked with a non-svc --for', () => {
      const result = useThen('it resolves', async () =>
        gen({ argv: ['--for', 'jobs', '--into', 'd', '--env', 'prep'] }),
      );

      then('it exits 2 (constraint)', () => {
        expect(result.exit).toEqual(2);
      });

      then('the result matches snapshot', () => {
        // explicit content assertion before the snapshot: the message must name the
        // bad value they gave (distinct from the absent-flag message)
        expect(result.message).toContain(`invalid --for value 'jobs'`);
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case2] introspection blocked outside prep', () => {
    when('[t0] invoked with --env prod', () => {
      const result = useThen('it resolves', async () =>
        gen({
          argv: [
            '--for',
            'svc-jobs',
            '--into',
            '/tmp/should-not-write',
            '--env',
            'prod',
          ],
        }),
      );

      then('it exits 2 (blocked is a constraint)', () => {
        expect(result.exit).toEqual(2);
      });

      then('the result matches snapshot', () => {
        // explicit content assertion before the snapshot: the message must name
        // the prep-only introspection gate
        expect(result.message).toContain(
          'introspection is only available in prep',
        );
        expect(result).toMatchSnapshot();
      });
    });
  });
});
