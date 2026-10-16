import { TRAIL_EXID_HEADER } from '../../../domain.objects/TrailExidHeader';
import { isTrailExid } from './isTrailExid';

/**
 * .what = whether a headers bag holds an `x-trail-exid` a caller meant as the opt-in, which the endpoint
 *         reads as absent because the value is malformed
 * .why = a malformed value opts a caller out in silence: the caller is answered ancient and its trace does
 *        not join. the endpoint logs this, with the length and never the text, so the drop leaves a signal
 *
 * .note = an empty value is absent, not malformed: a client that sends an empty header meant no opt-in
 */
export const isTrailExidHeaderMalformed = (input: {
  headers: Record<string, string | undefined> | null | undefined;
}): boolean => {
  const value = input.headers?.[TRAIL_EXID_HEADER];
  if (typeof value !== 'string' || value === '') return false;
  return !isTrailExid.assess(value);
};
