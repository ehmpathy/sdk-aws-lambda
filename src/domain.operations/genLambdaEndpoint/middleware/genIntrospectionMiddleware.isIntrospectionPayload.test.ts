import { given, then, when } from 'test-fns';

import { isIntrospectionPayload } from './genIntrospectionMiddleware.isIntrospectionPayload';

describe('isIntrospectionPayload', () => {
  given('[case1] payload with { introspect: "schema" }', () => {
    const payload = { introspect: 'schema' };

    when('[t0] checked', () => {
      then('returns true', () => {
        expect(isIntrospectionPayload(payload)).toBe(true);
      });
    });
  });

  given('[case2] payload with { introspect: "other" }', () => {
    const payload = { introspect: 'other' };

    when('[t0] checked', () => {
      then('returns false', () => {
        expect(isIntrospectionPayload(payload)).toBe(false);
      });
    });
  });

  given('[case3] empty object payload', () => {
    const payload = {};

    when('[t0] checked', () => {
      then('returns false', () => {
        expect(isIntrospectionPayload(payload)).toBe(false);
      });
    });
  });

  given('[case4] payload with event wrapper', () => {
    const payload = { event: { customerId: '123' } };

    when('[t0] checked', () => {
      then('returns false', () => {
        expect(isIntrospectionPayload(payload)).toBe(false);
      });
    });
  });

  given('[case5] null payload', () => {
    const payload = null;

    when('[t0] checked', () => {
      then('returns false', () => {
        expect(isIntrospectionPayload(payload)).toBe(false);
      });
    });
  });

  given('[case6] non-object payload', () => {
    const payload = 'string';

    when('[t0] checked', () => {
      then('returns false', () => {
        expect(isIntrospectionPayload(payload)).toBe(false);
      });
    });
  });
});
