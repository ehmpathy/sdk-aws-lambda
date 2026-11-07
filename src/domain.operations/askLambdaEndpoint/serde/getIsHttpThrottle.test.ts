import { given, then, when } from 'test-fns';

import { getIsHttpThrottle } from './getIsHttpThrottle';

const TEST_CASES = [
  { description: 'a 429 is a throttle', given: { status: 429 }, expect: true },
  {
    description: 'a 400 is a refusal, not a throttle',
    given: { status: 400 },
    expect: false,
  },
  {
    description: 'a 408 still reads as a refusal',
    given: { status: 408 },
    expect: false,
  },
  {
    description: 'a 503 is a server fault, not a throttle',
    given: { status: 503 },
    expect: false,
  },
  { description: 'a 200 is a success', given: { status: 200 }, expect: false },
];

describe('getIsHttpThrottle', () => {
  TEST_CASES.map((thisCase, index) =>
    given(`[case${index + 1}] status ${thisCase.given.status}`, () => {
      when('[t0] the status is read', () => {
        then(thisCase.description, () => {
          expect(getIsHttpThrottle(thisCase.given)).toEqual(thisCase.expect);
        });
      });
    }),
  );
});
