import type middy from '@middy/core';

import type { ApiGatewayRequestEventOnwire } from '../../../../domain.objects/ApiGatewayRequestEventOnwire';
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
