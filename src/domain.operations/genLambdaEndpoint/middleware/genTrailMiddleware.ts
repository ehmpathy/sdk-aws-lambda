import type middy from '@middy/core';
import { randomUUID } from 'crypto';
import { MalfunctionError } from 'helpful-errors';
import {
  type ContextLogTrail,
  genContextLogTrail,
  type LogTrail,
} from 'sdk-logs';

import type { TrailCarrier } from '../../../domain.objects/TrailCarrier';
import { getOneTrailExidFromHeaders } from '../../lambdaEndpointWire/frame/getOneTrailExidFromHeaders';
import { isTrailExidHeaderMalformed } from '../../lambdaEndpointWire/frame/isTrailExidHeaderMalformed';
import { getUnwrappedEventWithExid } from './getUnwrappedEventWithExid';

/**
 * .what = reads the trail and the opt-in off a reconciled event's headers
 * .why = the header's presence IS the contemp opt-in; the event itself is never rewrapped
 */
const getTrailFromHeaders = <
  TEvent extends { headers?: Record<string, string | undefined> | null },
>(input: {
  event: TEvent;
}): {
  exidFromPayload: string | null;
  unwrappedEvent: TEvent;
  isContempCaller: boolean;
} => {
  const exidFromPayload = getOneTrailExidFromHeaders({
    headers: input.event?.headers,
  });
  return {
    exidFromPayload,
    unwrappedEvent: input.event,
    isContempCaller: exidFromPayload !== null,
  };
};

/**
 * .what = reads the caller's trail, the opt-in, and the event, from the carrier a family declares
 * .why = one place picks the read per carrier, so the middleware body stays one narrative
 */
const getTrailFromCarrier = (input: {
  carrier: TrailCarrier;
  event: any;
}): {
  exidFromPayload: string | null;
  unwrappedEvent: any;
  isContempCaller: boolean;
} => {
  switch (input.carrier) {
    case 'headers':
      return getTrailFromHeaders({ event: input.event });
    case 'wrapper':
      return getUnwrappedEventWithExid({ payload: input.event });
    default: {
      // a carrier added to the type and not handled here fails to compile at this line
      const carrierUnhandled: never = input.carrier;
      return MalfunctionError.throw('the trail carrier is not one this reads', {
        carrier: carrierUnhandled,
      });
    }
  }
};

/**
 * .what = middleware that extracts or generates trail context and unwraps event
 * .why = enables request correlation via trail.exid across lambda invocations
 *
 * | carrier | the caller's trail + opt-in ride | present → | absent → |
 * |---------|----------------------------------|-----------|----------|
 * | wrapper | `{ event: X, trail: { exid } }`  | unwrap to X, contemp | event as is, ancient |
 * | headers | `event.headers['x-trail-exid']`  | event as is, contemp | event as is, ancient |
 *
 * .note = `headers` reads the RECONCILED bag, so a family that carries it places this entry after
 *         its event normalization. a `{ event, trail }` wrapper is not honored there
 *
 * .note = `forSqs.*` keeps the `wrapper` carrier it ran before the headers carrier existed: a test
 *         runner frames one, and aws never sends one, so a deployed sqs endpoint reads no trail and
 *         mints a fresh id. the `messageAttributes` lift is recorded as next
 *         (`domain.terms/trail.md`, `invariant.ancient-vs-contemp-callers.md`)
 */
export const genTrailMiddleware = (input: {
  carrier: TrailCarrier;
}): {
  before: middy.MiddlewareFn<any, any>;
} => {
  const before: middy.MiddlewareFn<any, any> = async (request) => {
    // read the caller's trail + event off the carrier the family declares
    const { exidFromPayload, unwrappedEvent, isContempCaller } =
      getTrailFromCarrier({ carrier: input.carrier, event: request.event });

    // generate exid if not provided
    const exid = exidFromPayload ?? `exid:${randomUUID()}`;

    // create trail
    const trail: LogTrail = {
      exid,
      stack: [],
    };

    // generate log context with trail
    const contextLogTrail = genContextLogTrail({
      trail,
      env: null,
    });

    // a malformed opt-in header reads as absent, so say so: the caller is answered ancient and its trace
    // does not join. the length is logged, never the text, since the value came from a public caller
    if (
      input.carrier === 'headers' &&
      isTrailExidHeaderMalformed({ headers: request.event?.headers })
    )
      contextLogTrail.log.debug('trail.exid.header.rejected', {
        length: String(request.event?.headers?.['x-trail-exid']).length,
      });

    // unwrap event (if wrapped format)
    // .note = DELIBERATE MUTATION — `request` is middy's only channel to hand a value onward
    request.event = unwrappedEvent;

    // inject log and caller version flag into context
    /**
     * .as = TWO casts, one subject: middy types `request.context` as aws-lambda's `Context`,
     *       which declares neither `log` nor `isContempCaller`. the first widens the read so
     *       every extant key survives the spread; the second declares the extension this
     *       middleware writes
     *
     * .why not `asContextTrailed` = that reader returns only the TWO sdk-managed fields, so a
     *       spread of it would DROP every aws-supplied key. a writer needs the whole bag
     *
     * .removal = removable when middy's `Request` carries a caller-declared context type
     *       parameter this chain can bind, such that a middleware may declare what it adds
     */
    const contextBefore = (request.context ?? {}) as unknown as Record<
      string,
      unknown
    >;
    request.context = {
      ...contextBefore,
      log: contextLogTrail.log,
      isContempCaller,
    } as typeof request.context &
      ContextLogTrail & { isContempCaller: boolean };
  };

  return { before };
};
