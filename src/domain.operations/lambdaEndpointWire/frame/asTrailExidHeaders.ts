import { ConstraintError } from 'helpful-errors';

import { TRAIL_EXID_HEADER } from '../../../domain.objects/TrailExidHeader';
import { isTrailExid, TRAIL_EXID_LENGTH_MAX } from './isTrailExid';

/**
 * .what = casts a trail into the http headers that opt a request into the contemp dialect
 * .why = an api gateway event is built by aws, so no caller can wrap it in `{ event, trail }`.
 *        the opt-in rides the request's own `headers` instead. any http client spreads this in
 *        (`domain.terms/x-trail-exid.md`, `invariant.ancient-vs-contemp-callers.md`)
 *
 * .note = the sender always supplies a well-formed exid: 1 to 128 printable ascii characters. the
 *         endpoint reads any other value as ABSENT, so the request would silently stay ancient —
 *         refused here instead, loudly
 *
 * .usage = `fetch(url, { headers: { ...asTrailExidHeaders({ trail: { exid } }) } })`
 *
 * .note = the usage is prose on purpose. a docblock example tag is a promise the advertised-examples
 *         sweep runs verbatim, and a snippet that needs a live url cannot keep it
 */
export const asTrailExidHeaders = (input: {
  trail: { exid: string };
}): { [TRAIL_EXID_HEADER]: string } => {
  // an exid the endpoint would read as absent would opt out in silence
  if (!isTrailExid.assess(input.trail.exid))
    ConstraintError.throw(
      'trail.exid is not a well-formed exid, so the request would carry no opt-in',
      {
        trail: input.trail,
        hint: `supply the exid of the invoke that makes this call: 1 to ${TRAIL_EXID_LENGTH_MAX} printable ascii characters`,
      },
    );

  return { [TRAIL_EXID_HEADER]: input.trail.exid };
};
