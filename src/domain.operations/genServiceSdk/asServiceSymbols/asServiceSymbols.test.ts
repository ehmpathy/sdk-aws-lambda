import { UnexpectedCodePathError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { asServiceSymbols } from './asServiceSymbols';

describe('asServiceSymbols', () => {
  // positive + edge cases: valid svc-{noun} → symbols
  const CASES_VALID = [
    {
      description: 'svc-jobs → svcJobs / SvcJobs',
      service: 'svc-jobs',
      expect: { object: 'svcJobs', prefix: 'SvcJobs' },
    },
    {
      description: 'single-letter noun',
      service: 'svc-x',
      expect: { object: 'svcX', prefix: 'SvcX' },
    },
    {
      description: 'noun with digits',
      service: 'svc-s3',
      expect: { object: 'svcS3', prefix: 'SvcS3' },
    },
  ];

  given('[case1] a valid svc-{noun} service', () => {
    CASES_VALID.map((thisCase) =>
      when(`[t0] ${thisCase.description}`, () => {
        const symbols = asServiceSymbols({ service: thisCase.service });

        then('it derives the object + prefix', () => {
          expect(symbols).toEqual(thisCase.expect);
        });
      }),
    );
  });

  // negative cases: malformed service → throws
  const CASES_INVALID = [
    { description: 'non-svc prefix', service: 'jobs-service' },
    { description: 'empty noun (svc-)', service: 'svc-' },
    { description: 'no dash', service: 'svcjobs' },
    { description: 'multi-hyphen (3 segments)', service: 'svc-trust-safety' },
    {
      description: 'extra hyphen at end (3 segments, empty last)',
      service: 'svc-jobs-',
    },
  ];

  given('[case2] a malformed service', () => {
    CASES_INVALID.map((thisCase) =>
      when(`[t0] ${thisCase.description}`, () => {
        then('it throws UnexpectedCodePathError', async () => {
          const error = await getError(() =>
            asServiceSymbols({ service: thisCase.service }),
          );
          expect(error).toBeInstanceOf(UnexpectedCodePathError);
        });
      }),
    );
  });
});
