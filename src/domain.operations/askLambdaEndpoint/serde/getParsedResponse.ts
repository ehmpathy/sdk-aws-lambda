import { ConstraintError } from 'helpful-errors';

import { LambdaEndpointError } from '../../../domain.objects/LambdaEndpointError';
import {
  getIsAncientErrorResponse,
  getIsContempErrorResponse,
} from '../error/getIsLambdaErrorResponse';
import { getLambdaErrorMetadata } from '../error/getLambdaErrorMetadata';
import { getStackTraceString } from '../error/getStackTraceString';
import { getDecodedPayload } from './getDecodedPayload';
import { getParsedJson } from './getParsedJson';

/**
 * .what = parses lambda response payload and throws on error
 * .why = orchestrator composes decode, parse, and error detection
 *
 * supports both contemp and ancient error response shapes:
 * - contemp: { error: { _serde, class, message, cause?, details? } }
 * - ancient: { errorMessage, errorType?, causeMessage?, details? }
 */
export const getParsedResponse = <TResponse>(input: {
  payload: Uint8Array | undefined;
  functionError: string | undefined;
  service: string;
  function: string;
  exid: string | null;
}): TResponse => {
  // validate payload exists
  if (!input.payload) {
    throw new LambdaEndpointError('lambda returned empty payload', {
      service: input.service,
      function: input.function,
      exid: input.exid,
    });
  }

  // decode payload to string
  const payloadString = getDecodedPayload({ payload: input.payload });

  // parse json
  const parseResult = getParsedJson({ json: payloadString });
  if (!parseResult.success) {
    throw new LambdaEndpointError('lambda returned invalid json', {
      service: input.service,
      function: input.function,
      exid: input.exid,
      cause: parseResult.error,
    });
  }
  const parsed = parseResult.data;

  // detect contemp error response (preferred, check first)
  if (getIsContempErrorResponse(parsed)) {
    const err = parsed.error;

    // ConstraintError = caller's fault, not lambda error (lambda succeeded)
    if (err.class === 'ConstraintError') {
      throw new ConstraintError(err.message, {
        service: input.service,
        function: input.function,
        exid: input.exid,
        causeMessage: err.cause,
        details: err.details,
      });
    }

    // all other error classes = lambda invocation error
    throw new LambdaEndpointError(err.message, {
      service: input.service,
      function: input.function,
      exid: input.exid,
      errorType: err.class,
      causeMessage: err.cause,
      details: err.details,
    });
  }

  // detect ancient error response (backwards compat)
  if (getIsAncientErrorResponse(parsed)) {
    const stackTrace = getStackTraceString({ stackTrace: parsed.stackTrace });
    const errorMeta = getLambdaErrorMetadata({ errorResponse: parsed });

    // ConstraintError/BadRequestError = caller's fault, not lambda error (lambda succeeded)
    // .note = check both for backwards compat with handlers that use old error types
    if (
      parsed.errorType === 'ConstraintError' ||
      parsed.errorType === 'BadRequestError'
    ) {
      throw new ConstraintError(parsed.errorMessage, {
        service: input.service,
        function: input.function,
        exid: input.exid,
        stackTrace,
        ...errorMeta,
      });
    }

    // all other error types = lambda invocation error
    throw new LambdaEndpointError(parsed.errorMessage, {
      service: input.service,
      function: input.function,
      exid: input.exid,
      errorType: parsed.errorType,
      stackTrace,
      ...errorMeta,
    });
  }

  /**
   * .cast = TResponse
   * .why = caller specifies expected response type via generic; runtime validation
   *        occurs at endpoint via zod schema, not here
   * .removal = add runtime schema validation to askLambdaEndpoint when needed
   */
  return parsed as TResponse;
};
