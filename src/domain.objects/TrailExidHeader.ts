/**
 * .what = the key, in a transport's `headers` bag, that carries the caller's `trail.exid`
 * .why = an aws-delivered event arrives in an envelope aws builds, so no caller can wrap it in
 *        `{ event, trail }`. the opt-in and the trail ride the envelope's metadata bag instead,
 *        under this one key (`domain.terms/x-trail-exid.md`)
 *
 * .note = lowercase always: http keys get lowercased in transit, and sqs keys are case-sensitive,
 *         so one lowercase-hyphen form is correct in every bag
 */
export const TRAIL_EXID_HEADER = 'x-trail-exid' as const;
