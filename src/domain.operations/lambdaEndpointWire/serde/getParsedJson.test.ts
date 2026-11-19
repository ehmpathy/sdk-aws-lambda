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

  /**
   * .what = the clamp on the allowlist: only a SyntaxError means "not json"
   * .why = any other throw is a defect, and a swallow would read it as text (`rule.forbid.failhide`)
   * .note = the real `JSON.parse` throws, never a mock: it calls `ToString` on its argument, so a
   *         value whose `toString` throws makes it throw a `TypeError`. `Reflect.apply` hands that
   *         value past the `string` type with no `as` cast
   */
  given('[case5] a parse that throws aught but a SyntaxError', () => {
    when('[t0] parsed', () => {
      then('the throw escapes, unchanged', () => {
        const jsonThatFaults = {
          toString: () => {
            throw new TypeError('a defect, not a syntax fault');
          },
        };
        expect(() =>
          Reflect.apply(getParsedJson, null, [{ json: jsonThatFaults }]),
        ).toThrow('a defect, not a syntax fault');
      });
    });
  });
});
