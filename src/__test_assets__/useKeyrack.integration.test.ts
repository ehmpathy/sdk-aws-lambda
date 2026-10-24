import type { keyrack } from 'rhachet/keyrack';
import { given, then, when } from 'test-fns';

import { useKeyrack } from './useKeyrack';

/**
 * .what = clamp the skip that lets `jest.keyrack.globalsetup.ts` cure the sso export race
 * .why = a thrice-per-run red: each test file exported the sso creds itself, 22 concurrent cli
 *        calls on a thorough run, and the slow ones hit the 30s kill (`SIGTERM`, `ETIMEDOUT`).
 *        the cure exports once in the parent; it holds only while a per-file call with static
 *        creds present makes zero exports. a revert of that skip brings the race back silently
 * .note = integration, not unit: `useKeyrack` reads this repo's real `.agent/keyrack.yml`.
 *         the keyrack source and the export are fakes via context, so no aws call is made
 */
describe('useKeyrack', () => {
  const genFakes = () => {
    const calls = { source: 0, exportCreds: 0 };
    const source = (() => {
      calls.source += 1;
    }) as unknown as typeof keyrack.source; // a fake: only the call count matters here
    const exportCreds = () => {
      calls.exportCreds += 1;
      return {
        AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'example-secret',
        AWS_SESSION_TOKEN: 'example-token',
      };
    };
    return { calls, source, exportCreds };
  };

  given(
    '[case1] the global setup already spliced static creds into the env',
    () => {
      when('[t0] each of 22 test files runs its own useKeyrack', () => {
        then('not one of them calls the cli export', () => {
          const fakes = genFakes();
          const env: NodeJS.ProcessEnv = {
            AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
            AWS_PROFILE: 'ehmpathy.demo.ehmpath',
          };
          Array.from({ length: 22 }).forEach(() =>
            useKeyrack(
              { env: 'test' },
              { env, source: fakes.source, exportCreds: fakes.exportCreds },
            ),
          );
          expect(fakes.calls.exportCreds).toEqual(0);
          expect(env.AWS_PROFILE).toBeUndefined();
        });
      });
    },
  );

  given('[case2] a fresh env, as the global setup meets it', () => {
    when('[t0] useKeyrack runs once', () => {
      then('it exports once and splices the static creds', () => {
        const fakes = genFakes();
        const env: NodeJS.ProcessEnv = { AWS_PROFILE: 'ehmpathy.demo.ehmpath' };
        useKeyrack(
          { env: 'test' },
          { env, source: fakes.source, exportCreds: fakes.exportCreds },
        );
        expect(fakes.calls.exportCreds).toEqual(1);
        expect(env.AWS_ACCESS_KEY_ID).toEqual('AKIAEXAMPLE');
        expect(env.AWS_PROFILE).toBeUndefined();
      });
    });
  });
});
