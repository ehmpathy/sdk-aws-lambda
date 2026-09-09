import type middy from '@middy/core';

import { asContextTrailed } from './asContextTrailed';
import {
  getErrorResponseBodyAncient,
  getErrorResponseBodyContemp,
  type LambdaEndpointErrorResponseBodyAncient,
  type LambdaEndpointErrorResponseBodyContemp,
} from './getErrorResponseBody';
import { getIsConstraintError } from './getIsConstraintError';

/**
 * .what = middleware that handles ConstraintError (and legacy BadRequestError)
 * .why = ConstraintError = caller fault, not server fault, so the invocation SUCCEEDS either
 *        way — a caller fault must not emit a cloudwatch error nor signal a retry
 *        (invariant.badrequesterror-not-lambda-error)
 *
 * .note = this middleware does NOT know which families exist. it builds the error BODY and
 *         hands it to the family's own `asOutputAfter`, so the wire shape is the family's to
 *         state. a flag read here would fork one guarantee across two paths
 *         (rule.forbid.parallel-codepaths)
 *
 * note: InternalServiceError is handled by genInternalServiceErrorMiddleware
 *
 * backwards compat: ancient callers (no { event, trail } wrapper) receive
 *                   flat errorType/errorMessage format
 *                   contemp callers receive nested { error: { _serde, class, message } }
 */
export const genConstraintErrorMiddleware = (opts: {
  /**
   * .what = renders the error body as this family's `outputAfter`
   * .why = the two families owe DIFFERENT shapes for the same fault: api-gateway owes a wire
   *        payload with a 400 and a stringified body, while an ask-endpoint response IS its
   *        payload. only the family knows which, so the family supplies it — never a flag read
   *        here (rule.forbid.parallel-codepaths)
   */
  asOutputAfter: (
    body:
      | LambdaEndpointErrorResponseBodyContemp
      | LambdaEndpointErrorResponseBodyAncient,
  ) => unknown;
}): {
  onError: middy.MiddlewareFn<any, any>;
} => {
  const onError: middy.MiddlewareFn<any, any> = async (request) => {
    const error = request.error;
    if (!error) return;

    // only handle ConstraintError here (includes legacy BadRequestError)
    // InternalServiceError is handled by genInternalServiceErrorMiddleware
    const isConstraintError = getIsConstraintError({ error });
    if (!isConstraintError) return;

    // detect if caller is contemp (sent wrapped payload) or ancient
    const { isContempCaller = false } = asContextTrailed({
      context: request.context,
    });

    // build error response body via transformer based on caller type
    const body:
      | LambdaEndpointErrorResponseBodyContemp
      | LambdaEndpointErrorResponseBodyAncient = isContempCaller
      ? getErrorResponseBodyContemp({ error, errorClass: 'ConstraintError' })
      : getErrorResponseBodyAncient({ error, errorType: 'BadRequestError' });

    /**
     * .what = hand the wire whatever shape this family owes for a caller fault
     * .why = the lambda invocation SUCCEEDS either way — a caller fault must not emit a
     *        cloudwatch error nor signal a retry (invariant.badrequesterror-not-lambda-error)
     *
     * .note = DELIBERATE MUTATION — `request` is middy's only channel to hand a value onward
     */
    request.response = opts.asOutputAfter(body);
  };
  return { onError };
};
