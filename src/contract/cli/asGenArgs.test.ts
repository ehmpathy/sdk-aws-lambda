import { ConstraintError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { asGenArgs } from './asGenArgs';

describe('asGenArgs', () => {
  given('[case1] a valid full arg set', () => {
    when('[t0] parsed', () => {
      const args = asGenArgs({
        argv: [
          '--for',
          'svc-jobs',
          '--into',
          'src/access/svcs',
          '--env',
          'prep',
        ],
      });

      then('it returns the typed shape', () => {
        expect(args).toEqual({
          service: 'svc-jobs',
          into: 'src/access/svcs',
          access: 'prep',
        });
      });
    });
  });

  // each row omits or corrupts one required arg → throws
  const CASES_INVALID = [
    { description: 'absent --for', argv: ['--into', 'd', '--env', 'prep'] },
    {
      description: 'absent --into',
      argv: ['--for', 'svc-jobs', '--env', 'prep'],
    },
    { description: 'absent --env', argv: ['--for', 'svc-jobs', '--into', 'd'] },
    {
      description: 'non-svc --for',
      argv: ['--for', 'jobs', '--into', 'd', '--env', 'prep'],
    },
    {
      description: 'bad --env',
      argv: ['--for', 'svc-jobs', '--into', 'd', '--env', 'sandbox'],
    },
  ];

  given('[case2] a malformed arg set', () => {
    CASES_INVALID.map((thisCase) =>
      when(`[t0] ${thisCase.description}`, () => {
        then('it throws ConstraintError with a usage hint', async () => {
          const error = await getError(() =>
            asGenArgs({ argv: thisCase.argv }),
          );
          expect(error).toBeInstanceOf(ConstraintError);
          const metadata = (error as ConstraintError).metadata as {
            usage?: string;
          };
          expect(metadata.usage).toContain('sdk-aws-lambda gen');
          // snapshot the exact message the user sees (it already embeds the usage
          // hint, so no separate usage field — keeps the snap clean + consistent
          // with the other cli error snaps)
          expect(error.message).toMatchSnapshot();
        });
      }),
    );
  });
});
