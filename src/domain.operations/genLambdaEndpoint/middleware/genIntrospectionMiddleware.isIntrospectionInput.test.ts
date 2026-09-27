import { given, then, when } from 'test-fns';

import { isIntrospectionInput } from './genIntrospectionMiddleware.isIntrospectionInput';

describe('isIntrospectionInput', () => {
  given('[case1] input with { introspect: "schema" }', () => {
    const input = { introspect: 'schema' };

    when('[t0] checked', () => {
      then('returns true', () => {
        expect(isIntrospectionInput(input)).toBe(true);
      });
    });
  });

  given('[case2] input with { introspect: "other" }', () => {
    const input = { introspect: 'other' };

    when('[t0] checked', () => {
      then('returns false', () => {
        expect(isIntrospectionInput(input)).toBe(false);
      });
    });
  });

  given('[case3] empty object input', () => {
    const input = {};

    when('[t0] checked', () => {
      then('returns false', () => {
        expect(isIntrospectionInput(input)).toBe(false);
      });
    });
  });

  given('[case4] input with event wrapper', () => {
    const input = { event: { customerId: '123' } };

    when('[t0] checked', () => {
      then('returns false', () => {
        expect(isIntrospectionInput(input)).toBe(false);
      });
    });
  });

  given('[case5] null input', () => {
    const input = null;

    when('[t0] checked', () => {
      then('returns false', () => {
        expect(isIntrospectionInput(input)).toBe(false);
      });
    });
  });

  given('[case6] non-object input', () => {
    const input = 'string';

    when('[t0] checked', () => {
      then('returns false', () => {
        expect(isIntrospectionInput(input)).toBe(false);
      });
    });
  });
});
