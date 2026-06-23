import { given, then, when } from 'test-fns';

import { getCorsOrigin } from './getCorsOrigin';

describe('getCorsOrigin', () => {
  given('[case1] wildcard origin', () => {
    when('[t0] called without credentials', () => {
      then('it should return wildcard', () => {
        const result = getCorsOrigin({ origins: '*' });
        expect(result).toBe('*');
      });
    });

    when('[t1] called with credentials and request origin', () => {
      then('it should echo request origin (browsers require this)', () => {
        const result = getCorsOrigin({
          origins: '*',
          requestOrigin: 'https://client.example.com',
          credentials: true,
        });
        expect(result).toBe('https://client.example.com');
      });
    });

    when('[t2] called with credentials but no request origin', () => {
      then('it should return wildcard', () => {
        const result = getCorsOrigin({
          origins: '*',
          credentials: true,
          requestOrigin: null,
        });
        expect(result).toBe('*');
      });
    });
  });

  given('[case2] single origin string', () => {
    when('[t0] request origin matches', () => {
      then('it should return the origin', () => {
        const result = getCorsOrigin({
          origins: 'https://example.com',
          requestOrigin: 'https://example.com',
        });
        expect(result).toBe('https://example.com');
      });
    });

    when('[t1] request origin does not match', () => {
      then('it should return configured origin anyway', () => {
        const result = getCorsOrigin({
          origins: 'https://example.com',
          requestOrigin: 'https://other.com',
        });
        expect(result).toBe('https://example.com');
      });
    });

    when('[t2] no request origin provided', () => {
      then('it should return configured origin', () => {
        const result = getCorsOrigin({ origins: 'https://example.com' });
        expect(result).toBe('https://example.com');
      });
    });
  });

  given('[case3] array of origins (dynamic match)', () => {
    const allowedOrigins = ['https://a.com', 'https://b.com', 'https://c.com'];

    when('[t0] request origin matches first in list', () => {
      then('it should return matched origin', () => {
        const result = getCorsOrigin({
          origins: allowedOrigins,
          requestOrigin: 'https://a.com',
        });
        expect(result).toBe('https://a.com');
      });
    });

    when('[t1] request origin matches middle of list', () => {
      then('it should return matched origin', () => {
        const result = getCorsOrigin({
          origins: allowedOrigins,
          requestOrigin: 'https://b.com',
        });
        expect(result).toBe('https://b.com');
      });
    });

    when('[t2] request origin matches last in list', () => {
      then('it should return matched origin', () => {
        const result = getCorsOrigin({
          origins: allowedOrigins,
          requestOrigin: 'https://c.com',
        });
        expect(result).toBe('https://c.com');
      });
    });

    when('[t3] request origin does not match any', () => {
      then('it should return null (no CORS header)', () => {
        const result = getCorsOrigin({
          origins: allowedOrigins,
          requestOrigin: 'https://evil.com',
        });
        expect(result).toBeNull();
      });
    });

    when('[t4] no request origin provided', () => {
      then('it should fall back to first origin for backwards compat', () => {
        const result = getCorsOrigin({ origins: allowedOrigins });
        expect(result).toBe('https://a.com');
      });
    });
  });

  given('[case4] array with single origin', () => {
    when('[t0] request origin matches', () => {
      then('it should return the matched origin', () => {
        const result = getCorsOrigin({
          origins: ['https://example.com'],
          requestOrigin: 'https://example.com',
        });
        expect(result).toBe('https://example.com');
      });
    });

    when('[t1] no request origin', () => {
      then('it should return the single origin', () => {
        const result = getCorsOrigin({ origins: ['https://example.com'] });
        expect(result).toBe('https://example.com');
      });
    });
  });

  given('[case5] empty origins array', () => {
    when('[t0] called with empty array', () => {
      then('it should return null', () => {
        const result = getCorsOrigin({
          origins: [],
          requestOrigin: 'https://example.com',
        });
        expect(result).toBeNull();
      });
    });
  });
});
