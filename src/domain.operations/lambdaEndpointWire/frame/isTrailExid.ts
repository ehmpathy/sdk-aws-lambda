import { withAssure } from 'type-fns';

/**
 * .what = the longest exid the sdk accepts from, or writes to, a header
 * .why = an exid is a correlation key, not a payload. the form the sdk mints is `exid:<uuid>`, 41
 *        characters, so 128 leaves room for a request id or a prefixed trace without a header that
 *        can hold a page of text
 */
export const TRAIL_EXID_LENGTH_MAX = 128;

/**
 * .what = whether a value is a well-formed trail exid: a string of 1 to 128 printable ascii characters
 * .why = `x-trail-exid` is the first value a public caller can place in this sdk's logs, in every 500's
 *        `correlationId`, and in the trail of every downstream call. a caller who sends a page of text,
 *        or a control character, would write it all into those places. a bounded printable value cannot
 *        forge a log line or grow a header without limit (`domain.terms/x-trail-exid.md`)
 *
 * .note = printable ascii is U+0020 to U+007E. a space is allowed inside the value, never at an end: http
 *         trims the ends of a header value, so a padded exid would read differently at each side of the
 *         wire and the trace would not join. a tab, a newline, and every control character are not allowed
 */
export const isTrailExid = withAssure(
  (value: unknown): value is string =>
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= TRAIL_EXID_LENGTH_MAX &&
    /^[\x21-\x7e]([\x20-\x7e]*[\x21-\x7e])?$/.test(value),
  { name: 'isTrailExid' },
);
