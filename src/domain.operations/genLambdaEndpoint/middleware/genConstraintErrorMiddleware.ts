import type middy from '@middy/core';

import {
  getErrorResponseBodyAncient,
  getErrorResponseBodyContemp,
  type LambdaEndpointErrorResponseBodyAncient,
  type LambdaEndpointErrorResponseBodyContemp,
} from './getErrorResponseBody';
import { getIsConstraintError } from './getIsConstraintError';

export interface ApiGatewayResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

/**
 * .what = middleware that handles ConstraintError (and legacy BadRequestError)
 * .why = ConstraintError = caller fault, not server fault
 *        - for apiGateway: returns 400 response with error details
 *        - for standard: returns error response object (lambda succeeds)
 *
 * note: InternalServiceError is handled by genInternalServiceErrorMiddleware
 *
 * backwards compat: ancient callers (no { event, trail } wrapper) receive
 *                   flat errorType/errorMessage format
 *                   contemp callers receive nested { error: { _serde, class, message } }
 */
export const genConstraintErrorMiddleware = (opts?: {
  apiGateway?: boolean;
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
    const context = request.context as { isContempCaller?: boolean };
    const isContempCaller = context.isContempCaller ?? false;

    // build error response body via transformer based on caller type
    const body:
      | LambdaEndpointErrorResponseBodyContemp
      | LambdaEndpointErrorResponseBodyAncient = isContempCaller
      ? getErrorResponseBodyContemp({ error, errorClass: 'ConstraintError' })
      : getErrorResponseBodyAncient({ error, errorType: 'BadRequestError' });

    // for API Gateway: return HTTP response
    if (opts?.apiGateway) {
      /**
       * .as = middy types request.response as unknown, but we set it to ApiGatewayResponse
       * .removal = if middy gains typed response inference for API Gateway handlers, remove cast
       */
      request.response = {
        statusCode: 400,
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
        },
      } as ApiGatewayResponse;
      return;
    }

    // for standard handler: return error response object
    // lambda invocation succeeds, caller detects error shape and throws
    request.response = body;
  };
  return { onError };
};
