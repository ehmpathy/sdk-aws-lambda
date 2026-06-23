import type middy from '@middy/core';

import { getIsConstraintError } from './getIsConstraintError';

/**
 * .what = middleware that logs and handles internal service errors
 * .why = all errors that are not BadRequestError are internal service errors
 *        - logs the error loudly
 *        - for apiGateway: returns 500 response (no details to avoid leaks)
 *        - for standard: passes error up the chain
 */
export const genInternalServiceErrorMiddleware = (opts?: {
  apiGateway?: boolean;
}): {
  onError: middy.MiddlewareFn<any, any>;
} => {
  const onError: middy.MiddlewareFn<any, any> = async (request) => {
    const error = request.error;
    if (!error) return;

    // check if the error was due to a bad request from the user
    // if it was, do not handle here - this was not an internal service error
    const isBadRequest = getIsConstraintError({ error });
    if (isBadRequest) return;

    // get log from context if available
    const log = (
      request.context as { log?: { error?: (...args: any[]) => void } }
    )?.log;

    // log the error via context.log or fallback to console
    const logError = log?.error ?? console.error;
    logError('handler.error', {
      errorMessage: error.message,
      stackTrace: error.stack,
    });

    // if we're in the api gateway context, handle the error and return a standard response
    if (opts?.apiGateway) {
      // get exid from trail context if available for correlation
      const exid = (request.context as { log?: { trail?: { exid?: string } } })
        ?.log?.trail?.exid;

      // build the response object with generic message
      // note: we include a generic message and correlation id (exid) but no details to avoid leaks
      request.response = {
        statusCode: 500,
        body: JSON.stringify({
          errorMessage: 'internal server error',
          errorType: 'InternalServiceError',
          ...(exid ? { correlationId: exid } : {}),
        }),
        headers: { 'Content-Type': 'application/json' },
      };

      // return undefined so that middy knows we handled the error
      // prevents cloudWatch from classifying this as a lambda error
      return;
    }

    // if we didn't handle the error above, rethrow it
    throw error;
  };
  return { onError };
};
