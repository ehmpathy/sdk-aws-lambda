import type middy from '@middy/core';

/**
 * .what = the key under which the raw invoke rides in middy's `request.internal`
 * .why = one name, shared by the writer and the reader, so the two cannot drift
 */
export const KEY_OF_ASK_EVENT_ONWIRE = 'askEventOnwire';

/**
 * .what = keeps the invoke exactly as it arrived, before `genTrailMiddleware` unwraps it
 * .why = the envelope's `_.raw` must hold what arrived — trail wrapper included — and the trail
 *        step replaces `request.event` with the unwrapped body. so the raw value is saved first
 *
 * .why `request.internal` = middy's sanctioned side-channel between middlewares; no vendor
 *        middleware reads our key (`rule.require.read-the-slot-a-dependency-reads`)
 * .where = anywhere ahead of `genTrailMiddleware` in the chain
 */
export const genAskEventOnwireCaptureMiddleware = (): {
  before: middy.MiddlewareFn<any, any>;
} => {
  const before: middy.MiddlewareFn<any, any> = async (request) => {
    // .note = deliberate mutation — `request` is middy's only channel to hand a value onward
    request.internal = {
      ...request.internal,
      [KEY_OF_ASK_EVENT_ONWIRE]: request.event,
    };
  };

  return { before };
};
