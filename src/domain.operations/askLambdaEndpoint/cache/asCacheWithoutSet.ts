import type { SimpleCache } from 'with-simple-cache';

/**
 * .what = disables set functionality on a cache
 * .why = enables read-only cache access when service owns the data
 *
 * .note = use this when
 *   - a lambda service owns the cached data
 *   - you want to read from cache to avoid calls
 *   - but the service manages cache writes
 */
export const asCacheWithoutSet = <T>(cache: SimpleCache<T>): SimpleCache<T> =>
  ({
    ...cache,
    set: (() => {}) as SimpleCache<T>['set'],
  }) as SimpleCache<T>;
