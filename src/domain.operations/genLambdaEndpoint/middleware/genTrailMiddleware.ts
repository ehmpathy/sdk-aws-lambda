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
    request.event = unwrappedEvent;

    // inject log and client version flag into context
    const contextBefore = (request.context ?? {}) as unknown as Record<
      string,
      unknown
    >;
    /**
     * .as = middy types request.context as aws-lambda Context, but we extend
     *       it with ContextLogTrail and isContempCaller
     * .removal = if middy gains typed middleware inference that tracks context extensions, remove cast
     */
    request.context = {
      ...contextBefore,
      log: contextLogTrail.log,
      isContempCaller,
    } as typeof request.context &
      ContextLogTrail & { isContempCaller: boolean };
  };

  return { before };
};
