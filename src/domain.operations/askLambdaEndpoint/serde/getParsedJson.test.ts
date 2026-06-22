import { given, then, when } from 'test-fns';

import { getParsedJson } from './getParsedJson';

describe('getParsedJson', () => {
  given('[case1] valid json string', () => {
    when('[t0] json is parsed', () => {
      then('returns success with data', () => {
        const result = getParsedJson({ json: '{"name":"test","value":42}' });
        expect(result).toEqual({
          success: true,
          data: { name: 'test', value: 42 },
        });
      });
    });
  });

  given('[case2] invalid json string', () => {
    when('[t0] json is malformed', () => {
      then('returns failure with SyntaxError', () => {
        const result = getParsedJson({ json: '{invalid json' });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(SyntaxError);
        }
      });
    });
  });

  given('[case3] empty object', () => {
    when('[t0] json is empty object', () => {
      then('returns success with empty object', () => {
        const result = getParsedJson({ json: '{}' });
        expect(result).toEqual({
          success: true,
          data: {},
        });
      });
    });
  });

  given('[case4] array json', () => {
    when('[t0] json is array', () => {
      then('returns success with array', () => {
        const result = getParsedJson({ json: '[1,2,3]' });
        expect(result).toEqual({
          success: true,
          data: [1, 2, 3],
        });
      });
    });
  });
});
