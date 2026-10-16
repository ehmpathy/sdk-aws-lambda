import { TRAIL_EXID_HEADER } from '../../../domain.objects/TrailExidHeader';

/**
 * .what = appends the trail header to a comma-separated list of allowed cors request headers
 * .why = a browser that sends `x-trail-exid` preflights it, and a preflight that does not list it
 *        blocks the real request. the sdk expects the header on every endpoint
 *        (`domain.terms/x-trail-exid.md`)
 *
 * .note = http header names are case-insensitive (rfc 9110 §5.1), so an author's `X-Trail-Exid` is
 *         already listed and is not appended again
 */
export const asCorsHeadersWithTrail = (input: { headers: string }): string => {
  const listed = input.headers
    .split(',')
    .map((header) => header.trim().toLowerCase());
  if (listed.includes(TRAIL_EXID_HEADER)) return input.headers;

  // an empty list, or one that ends in a comma, gains the key with no stray comma
  const listedBefore = input.headers.trim().replace(/,+$/, '');
  return listedBefore === ''
    ? TRAIL_EXID_HEADER
    : `${listedBefore},${TRAIL_EXID_HEADER}`;
};
