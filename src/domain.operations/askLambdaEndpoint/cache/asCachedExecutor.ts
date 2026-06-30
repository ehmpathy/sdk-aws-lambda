import type { SimpleInMemoryCache } from 'simple-in-memory-cache';
import { type SimpleCache, withSimpleCacheAsync } from 'with-simple-cache';

import {
  executeLambdaInvocation,
  type InvocationContext,
  type InvocationInput,
} from '../invoke/executeLambdaInvocation';

/**
 * .what = executor type for lambda invocation
 * .why = typed for cache wrapper composition
 */
type LambdaExecutor<TResponse> = (
  input: InvocationInput,
  context: InvocationContext,
) => Promise<TResponse>;

/**
 * .what = wraps executor with cache if caches provided
 * .why = extracts cache selection logic from orchestrator
 */
export const asCachedExecutor = <TResponse>(input: {
  response?: SimpleCache<TResponse>;
  dedupe?: SimpleInMemoryCache<TResponse>;
  getCacheKey: () => string;
}): LambdaExecutor<TResponse> => {
  // no cache provided, return unwrapped executor
  if (!input.response)
    return executeLambdaInvocation as LambdaExecutor<TResponse>;

  // dedupe cache provided, wrap with both caches
  if (input.dedupe) {
    return withSimpleCacheAsync(executeLambdaInvocation, {
      cache: {
        output: input.response,
        deduplication: input.dedupe,
      },
      serialize: { key: input.getCacheKey },
    }) as LambdaExecutor<TResponse>;
  }

  // output cache only
  return withSimpleCacheAsync(executeLambdaInvocation, {
    cache: input.response,
    serialize: { key: input.getCacheKey },
  }) as LambdaExecutor<TResponse>;
};
