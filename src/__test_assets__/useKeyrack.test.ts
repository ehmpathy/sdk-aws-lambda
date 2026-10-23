import { ConstraintError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import type { execFileSync } from 'node:child_process';
import { exportAwsCredentialsFromSsoProfile } from './useKeyrack';

describe('exportAwsCredentialsFromSsoProfile', () => {
  given('[case1] an sso session the aws cli cannot export', () => {
    // a fake injected via context: the cli's own refusal, with no aws call made
    const execExpired = (() => {
      throw new Error('sso token for this profile has expired');
    }) as unknown as typeof execFileSync;

    const attempt = (input: { env: string }) =>
      getError(async () =>
        exportAwsCredentialsFromSsoProfile(
          {
            profile: 'ehmpathy.demo.ehmpath',
            keyrack: { owner: 'ehmpath', env: input.env },
          },
          { exec: execExpired },
        ),
      );

    when('[t0] the export is attempted', () => {
      then(
        'the error names the paved fix, `rhx keyrack unlock`, for the same owner and env',
        async () => {
          const error = await attempt({ env: 'test' });
          expect(error).toBeInstanceOf(ConstraintError);
          expect(error.message).toContain(
            'run: rhx keyrack unlock --owner ehmpath --env test',
          );
        },
      );

      then(
        'the raw `aws sso login` is kept only as the last-resort hint',
        async () => {
          const error = await attempt({ env: 'prep' });
          const headline = error.message.split('\n')[0] ?? '';
          expect(headline).toContain('--env prep');
          expect(headline).not.toContain('aws sso login');
          expect(error.message).toContain(
            'last resort, if the unlock cannot refresh the session: aws sso login --profile ehmpathy.demo.ehmpath',
          );
        },
      );

      then('the cli refusal stays on the cause chain', async () => {
        const error = await attempt({ env: 'test' });
        expect((error.cause as Error).message).toContain('has expired');
      });
    });
  });
});
