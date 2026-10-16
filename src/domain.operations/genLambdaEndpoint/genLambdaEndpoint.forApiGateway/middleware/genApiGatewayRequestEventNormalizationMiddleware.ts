import type middy from '@middy/core';
import { ConstraintError } from 'helpful-errors';

import type { ApiGatewayRequestEventOnwire } from '../../../../domain.objects/ApiGatewayRequestEventOnwire';
import { TRAIL_EXID_HEADER } from '../../../../domain.objects/TrailExidHeader';
import { getIsWrappedPayload } from '../../../lambdaEndpointWire/frame/getIsWrappedPayload';
import { asApiGatewayRequestEventUnified } from '../asApiGatewayRequestEventUnified';

/**
 * .what = replaces the event with the v1/v2-reconciled shape
 * .why = the api-gateway chain must read the same whichever version the trigger delivers, so
 *        this runs first and every step after it reads one shape
 *
 * .note = this DELEGATES to `asApiGatewayRequestEventUnified` rather than hold its own copy of the
 *         reconcile logic. one guarantee, one implementation, two entry points — a second
 *         copy would be the parallel code path (rule.forbid.parallel-codepaths)
 */
export const genApiGatewayRequestEventNormalizationMiddleware = (input: {
  parsePayload: boolean;
}): {
  before: middy.MiddlewareFn<any, any>;
} => {
  const before: middy.MiddlewareFn<any, any> = async (request) => {
    /**
     * .what = refuses a `{ event, trail }` wrapper, and names the two remedies
     * .why = aws builds every event this family receives and never wraps one, so a wrapper means
     *        a caller framed an http event as a direct invoke — the 0.7.1 defect. the opt-in
     *        rides the request's `x-trail-exid` header instead (`invariant.ancient-vs-contemp-callers.md`).
     *        without this, the throw below says only "neither v1 nor v2" and names no fix
     * .why ConstraintError = a wrapper here is a fault in the frame the caller chose, so the caller
     *        fixes it, and its message reaches the response, where its author looks. a public caller
     *        cannot send one, since aws builds the event
     */
    if (getIsWrappedPayload(request.event))
      ConstraintError.throw(
        'a { event, trail } wrapper reached an api gateway endpoint; aws never sends one',
        {
          fix: [
            `run the endpoint through runLambdaEndpoint with an event built by asLambdaEvent.fromApiGateway: it sends the opt-in as an ${TRAIL_EXID_HEADER} header`,
            'a copy of that event (spread, structuredClone, json round trip) loses its declaration at the cloud locus: pass the changes to asLambdaEvent.fromApiGateway (headers, requestContext, path, ...) instead of a copy',
            `for a raw event captured from aws, pass struct: { payload: 'ancient' }: it arrives as is, with any ${TRAIL_EXID_HEADER} header it holds`,
            'to ask a deployed http endpoint over the network, use askLambdaEndpoint.viaApiGateway',
          ],
        },
      );

    /**
     * .as = both casts exist because this middleware is typed `<any, any>`, so `request.event`
     *       is `any` on the way in and its declared type on the way out. the transform is
     *       real — `ApiGatewayRequestEventOnwire` becomes `ApiGatewayRequestEventUnified` — and middy
     *       cannot track a shape change across a `before` hook
     * .removal = drops when middy gains typed inference across `.use`, at which point the
     *            middleware's own two type parameters name these shapes and no cast is owed
     *
     * .note = DELIBERATE MUTATION — `request` is middy's only channel to hand a value onward
     */
    request.event = asApiGatewayRequestEventUnified(
      { wire: request.event as ApiGatewayRequestEventOnwire },
      { deserialize: { payload: input.parsePayload } },
    ) as unknown as typeof request.event;
  };

  return { before };
};
