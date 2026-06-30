import { createHash } from 'node:crypto';
import type { LambdaEndpoint } from '../../../domain.objects/LambdaEndpoint';

/**
 * .what = recursively sorts object keys for deterministic serialization
 * .why = JSON.stringify does not guarantee property order
 */
const asStableJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(asStableJson).join(',') + ']';
  }
  const sortedKeys = Object.keys(value).sort();
  const pairs = sortedKeys.map(
    (key) =>
      `${JSON.stringify(key)}:${asStableJson((value as Record<string, unknown>)[key])}`,
  );
  return '{' + pairs.join(',') + '}';
};

/**
 * .what = generates a unique cache key for LambdaClient requests
 * .why = enables request deduplication and response cache
 */
export const getAskLambdaCacheKey = (input: {
  endpoint: LambdaEndpoint;
  event: Record<string, unknown>;
}): string => {
  const idealKey = [input.endpoint.slug, asStableJson(input.event)].join('.');

  // create human part for observability
  const humanPart = idealKey
    .replace(/:/g, '.')
    .replace(/[^\w\-_.]/g, '')
    .replace(/\.\./g, '.');

  // create unique part for collision avoidance
  const uniquePart = createHash('sha256')
    .update(JSON.stringify(idealKey))
    .digest('hex');

  return [humanPart, uniquePart].join('.');
};
