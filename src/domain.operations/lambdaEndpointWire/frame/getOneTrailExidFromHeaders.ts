import { TRAIL_EXID_HEADER } from '../../../domain.objects/TrailExidHeader';
import { isTrailExid } from './isTrailExid';

/**
 * .what = reads the caller's exid out of a headers bag, or null when the bag carries none
 * .why = the exid's presence IS the contemp opt-in at an aws-delivered family
 *        (`invariant.ancient-vs-contemp-callers.md`)
 *
 * .note = a value that is not a well-formed exid (empty, past the length bound, or with a control
 *         character) reads as ABSENT, so a public caller cannot place unbounded or forged text in the
 *         sdk's logs and responses. the request then reads as ancient, with a fresh exid
 * .note = exactly one key is read — no generic correlation header (`x-amzn-trace-id`, `traceparent`,
 *         `x-request-id`) ever opts a caller in, since a proxy that forwards one must not flip an
 *         error body (`domain.terms/x-trail-exid.md`)
 * .note = the bag's keys are lowercase by now — event normalization folds them (`headers.md`)
 */
export const getOneTrailExidFromHeaders = (input: {
  headers: Record<string, string | undefined> | null | undefined;
}): string | null => {
  const value = input.headers?.[TRAIL_EXID_HEADER];
  return isTrailExid.assess(value) ? value : null;
};
