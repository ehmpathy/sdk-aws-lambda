import type middy from '@middy/core';
import { randomUUID } from 'crypto';
import {
  type ContextLogTrail,
  genContextLogTrail,
  type LogTrail,
} from 'sdk-logs';

import { getUnwrappedEventWithExid } from './getUnwrappedEventWithExid';

/**
 * .what = middleware that extracts or generates trail context and unwraps event
 * .why = enables request correlation via trail.exid across lambda invocations
 *
 * payload formats:
 *   - wrapped: { event: X, trail: { exid } } → extracts trail, unwraps to X
 *   - raw: X → generates trail, uses X as event
 */
export const genTrailMiddleware = (): {
  before: middy.MiddlewareFn<any, any>;
} => {
  const before: middy.MiddlewareFn<any, any> = async (request) => {
    // detect payload format and extract trail + event
    const { exidFromPayload, unwrappedEvent, isContempCaller } =
      getUnwrappedEventWithExid({
        payload: request.event,
      });

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
