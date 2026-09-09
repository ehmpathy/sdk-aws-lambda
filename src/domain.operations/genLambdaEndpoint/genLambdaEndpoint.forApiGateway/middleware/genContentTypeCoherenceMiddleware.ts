import type middy from '@middy/core';

/**
 * .what = removes `Content-Type` from a response that carries no body
 * .why = a content-type that contradicts the body is the exact shape that raises twilio 11200 —
 *        the defect this whole affordance exists to retire. a 204 and a 308 each reach the wire
 *        body-less and would otherwise claim `application/json`
 *
 * ⚠️ .note = MUST be registered FIRST in the chain array. middy `unshift`s `after` and `onError`,
 *         so index 0 runs LAST on both — the only position later than the serializer that stamps
 *         the header, and later than the error builders that set `request.response`. anywhere
 *         else, the `onError` hook meets an absent response and returns early
 *
 * .note = the same function serves both hooks, so one implementation holds the guarantee on
 *         either path. no error response is body-less today, so `onError` finds no work yet; it
 *         is registered for a future body-less error status (a 304, a 205)
 */
export const genContentTypeCoherenceMiddleware = (): {
  after: middy.MiddlewareFn<any, any>;
  onError: middy.MiddlewareFn<any, any>;
} => {
  const onResponse: middy.MiddlewareFn<any, any> = async (request) => {
    // an error path can reach here before any response was set
    if (!request.response) return;

    // a body present means the Content-Type describes real bytes, so leave it be
    if (request.response.body !== undefined) return;

    /**
     * .as = middy types `request.response` as `unknown`, so `.headers` arrives untyped. the cast
     *       declares the shape this chain always puts there — `httpSecurityHeaders`, `httpCors`,
     *       and the error builders each write a flat string map
     * .removal = drops when middy gains typed response inference, at which point
     *            `ApiGatewayResponsePayload['headers']` types this member directly
     */
    const headers = request.response.headers as
      | Record<string, string>
      | undefined;
    if (!headers) return;

    /**
     * .note = DELIBERATE MUTATION. `request` is middy's ONLY channel to hand a value onward,
     *         so a middleware that must alter the response has no immutable form available
     *         (rule.require.immutable-vars, the annotated-exception clause). the write is
     *         bounded to `headers` and replaces it with a fresh object rather than a splice
     */
    request.response.headers = Object.fromEntries(
      Object.entries(headers).filter(
        ([key]) => key.toLowerCase() !== 'content-type',
      ),
    );
  };

  return { after: onResponse, onError: onResponse };
};
