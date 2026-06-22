import { given, then, when } from 'test-fns';

import { getStatusCodeHint } from './getStatusCodeHint';

describe('getStatusCodeHint', () => {
  const TEST_CASES = [
    {
      description: 'returns actionable hint for 400 bad request',
      given: { statusCode: 400 },
      expect: { contains: 'bad request' },
    },
    {
      description: 'returns actionable hint for 403 access denied',
      given: { statusCode: 403 },
      expect: { contains: 'access denied' },
    },
    {
      description: 'returns actionable hint for 404 not found',
      given: { statusCode: 404 },
      expect: { contains: 'function not found' },
    },
    {
      description: 'returns actionable hint for 408 timeout',
      given: { statusCode: 408 },
      expect: { contains: 'timeout' },
    },
    {
      description: 'returns actionable hint for 413 payload too large',
      given: { statusCode: 413 },
      expect: { contains: 'payload too large' },
    },
    {
      description: 'returns actionable hint for 429 rate limit',
      given: { statusCode: 429 },
      expect: { contains: 'rate limit' },
    },
    {
      description: 'returns actionable hint for 500 internal error',
      given: { statusCode: 500 },
      expect: { contains: 'internal error' },
    },
    {
      description: 'returns actionable hint for 502 service error',
      given: { statusCode: 502 },
      expect: { contains: 'service error' },
    },
    {
      description: 'returns actionable hint for 503 unavailable',
      given: { statusCode: 503 },
      expect: { contains: 'service unavailable' },
    },
    {
      description: 'returns actionable hint for 504 gateway timeout',
      given: { statusCode: 504 },
      expect: { contains: 'gateway timeout' },
    },
    {
      description: 'returns generic hint for unknown status code',
      given: { statusCode: 418 },
      expect: { contains: 'status 418' },
    },
  ];

  given('[case1] known status codes', () => {
    when('[t0] status code is transformed', () => {
      TEST_CASES.forEach((testCase) => {
        then(testCase.description, () => {
          const hint = getStatusCodeHint(testCase.given.statusCode);
          expect(hint).toContain(testCase.expect.contains);
        });
      });
    });
  });

  given('[case2] snapshot all hints', () => {
    when('[t0] hints are generated', () => {
      then('all hints match snapshot', () => {
        const allHints = [
          400, 403, 404, 408, 413, 429, 500, 502, 503, 504, 418,
        ].map((code) => ({
          statusCode: code,
          hint: getStatusCodeHint(code),
        }));
        expect(allHints).toMatchSnapshot();
      });
    });
  });
});
