import { MalfunctionError } from 'helpful-errors';

import type { LambdaEndpointDialect } from '../../../domain.objects/LambdaEndpointDialect';
import type { TrailCarrier } from '../../../domain.objects/TrailCarrier';
import { TRAIL_EXID_HEADER } from '../../../domain.objects/TrailExidHeader';
import { asHeadersWithoutKey } from '../../lambdaEndpointWire/frame/asHeadersWithoutKey';
import { asTrailExidHeaders } from '../../lambdaEndpointWire/frame/asTrailExidHeaders';
import { getOneTrailExidFromHeaders } from '../../lambdaEndpointWire/frame/getOneTrailExidFromHeaders';
import { asFramedPayload } from './asFramedPayload';
import { getOneTrailWithExid } from './getOneTrailWithExid';
import { isEventWithHeaders } from './isEventWithHeaders';

/**
 * .what = casts an event into the payload its endpoint's carrier reads, in the dialect declared
 * .why = a direct invoke reads a `{ event, trail }` wrapper; an api gateway event is built by aws
 *        and carries the opt-in in its own `headers`. the dialect is still derived from
 *        `struct.payload` alone, so the two knobs cannot disagree
 *        (`invariant.ancient-vs-contemp-callers.md`)
 *
 * | carrier | contemp | ancient |
 * |---------|---------|---------|
 * | wrapper | `{ event, trail }` | the event, untouched |
 * | headers | the event + `x-trail-exid` | the event, untouched: the sdk adds no opt-in |
 *
 * .note = the `wrapper` arm is `asFramedPayload`, unchanged. this adds the second carrier and
 *         owns no copy of the first (rule.forbid.parallel-codepaths)
 * .note = the `headers` arm owes an exid, since a header that holds no value holds no opt-in: it takes
 *         the caller's trail, else a well-formed one the event already holds in its header, else a
 *         generated one (`getOneTrailWithExid`)
 * .note = the `headers` arm merges the key into `multiValueHeaders` too when the event holds that
 *         twin, so a v1 event stays wire-faithful, and drops every case variant of the key first,
 *         so the sdk's key is the only one the endpoint reads. a hand-built v1 event that holds
 *         `X-Trail-Exid` loses that variant and gains the lowercase one; every other key keeps its
 *         author's case
 * .note = `ancient` leaves the event as it is, so an event that already holds the key (a request
 *         captured off a real wire) keeps the opt-in its caller placed there
 */
export const asCarriedPayload = (input: {
  event: unknown;
  trail: { exid?: string } | null;
  dialect: LambdaEndpointDialect;
  carrier: TrailCarrier;
}): unknown => {
  // the carrier is exhaustive: a third one added to the type fails to compile until it is handled here
  if (input.carrier !== 'wrapper' && input.carrier !== 'headers')
    return MalfunctionError.throw('the trail carrier is not one this writes', {
      carrier: input.carrier satisfies never,
    });
  if (input.carrier === 'wrapper') return asFramedPayload(input);

  // ancient: the sdk adds no opt-in, exactly as a browser's request carries none
  if (input.dialect === 'ancient') return input.event;

  // `input.event` is `unknown` because this operation serves every carrier; the header bags are
  // checked here, at run time, rather than asserted
  const event = isEventWithHeaders.assure(input.event);
  const headersCarried = asTrailExidHeaders({
    trail: getOneTrailWithExid({
      trail: input.trail ?? {
        exid: getOneTrailExidFromHeaders({ headers: event.headers }),
      },
    }),
  });
  return {
    ...event,
    headers: {
      ...asHeadersWithoutKey({
        headers: event.headers,
        key: TRAIL_EXID_HEADER,
      }),
      ...headersCarried,
    },
    ...(event.multiValueHeaders
      ? {
          multiValueHeaders: {
            ...asHeadersWithoutKey({
              headers: event.multiValueHeaders,
              key: TRAIL_EXID_HEADER,
            }),
            [TRAIL_EXID_HEADER]: [headersCarried[TRAIL_EXID_HEADER]],
          },
        }
      : {}),
  };
};
