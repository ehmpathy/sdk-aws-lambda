import { createHash } from 'node:crypto';

/**
 * .what = generates a unique cache key for lambda client requests
 * .why = enables request deduplication and response cache
 */
export const getAskLambdaCacheKey = (input: {
  service: string;
  function: string;
  access: string;
  event: Record<string, unknown>;
}): string => {
  const idealKey = [
    [input.service, input.access, input.function].join('-'),
    JSON.stringify(input.event),
  ].join('.');

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
