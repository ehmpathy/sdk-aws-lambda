import { given, then, when } from 'test-fns';

import { getStackTraceString } from './getStackTraceString';

describe('getStackTraceString', () => {
  given('[case1] string array stack trace', () => {
    when('[t0] aws native format', () => {
      then('joins with newlines', () => {
        const result = getStackTraceString({
          stackTrace: ['at foo (file.js:1)', 'at bar (file.js:2)'],
        });
        expect(result).toEqual('at foo (file.js:1)\nat bar (file.js:2)');
      });
    });
  });

  given('[case2] string stack trace', () => {
    when('[t0] genLambdaEndpoint format', () => {
      then('returns as-is', () => {
        const trace = 'Error: test\n    at foo (file.js:1)';
        const result = getStackTraceString({ stackTrace: trace });
        expect(result).toEqual(trace);
      });
    });
  });

  given('[case3] undefined stack trace', () => {
    when('[t0] no stack trace', () => {
      then('returns undefined', () => {
        const result = getStackTraceString({ stackTrace: undefined });
        expect(result).toBeUndefined();
      });
    });
  });

  given('[case4] empty array', () => {
    when('[t0] empty stack trace array', () => {
      then('returns empty string', () => {
        const result = getStackTraceString({ stackTrace: [] });
        expect(result).toEqual('');
      });
    });
  });
});
