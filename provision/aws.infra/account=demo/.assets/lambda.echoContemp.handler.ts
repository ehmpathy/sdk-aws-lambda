/**
 * .what = contemp lambda handler for round-trip tests
 * .why = tests contemp error format and caller detection
 *
 * .note = implements same logic as genLambdaEndpoint but standalone (no imports)
 */

type EchoEvent = {
  action: 'echo' | 'throwConstraintError' | 'throwInternalError';
  message?: string;
};

type WrappedPayload = {
  event: EchoEvent;
  trail?: { exid?: string };
};

type FlatPayload = EchoEvent;

type EchoOutput = {
  result: string;
};

type ContempErrorResponse = {
  error: {
    _serde: 'LambdaEndpointError::contemp';
    class: string;
    message: string;
    cause?: string;
    details?: unknown;
  };
};

type AncientErrorResponse = {
  errorMessage: string;
  errorType?: string;
  causeMessage?: string;
  details?: unknown;
};

/**
 * .what = detect if caller is contemp (sends wrapped payload with trail)
 * .why = contemp callers send { event, trail }, ancient send raw event
 */
const getIsContempCaller = (
  payload: WrappedPayload | FlatPayload,
): payload is WrappedPayload => {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'event' in payload &&
    typeof (payload as WrappedPayload).event === 'object'
  );
};

/**
 * .what = create contemp error response with _serde discriminator
 * .why = contemp callers expect structured error with class info
 */
const getContempErrorResponse = (
  error: Error,
  errorClass: string,
): ContempErrorResponse => ({
  error: {
    _serde: 'LambdaEndpointError::contemp',
    class: errorClass,
    message: error.message,
    cause: error.cause instanceof Error ? error.cause.message : undefined,
    details: (error as Error & { details?: unknown }).details,
  },
});

/**
 * .what = create ancient error response with flat format
 * .why = ancient callers expect flat errorMessage format
 */
const getAncientErrorResponse = (
  error: Error,
  errorType: string,
): AncientErrorResponse => ({
  errorMessage: error.message,
  errorType,
  causeMessage: error.cause instanceof Error ? error.cause.message : undefined,
  details: (error as Error & { details?: unknown }).details,
});

export const handler = async (
  payload: WrappedPayload | FlatPayload,
): Promise<EchoOutput | ContempErrorResponse | AncientErrorResponse> => {
  // detect caller type
  const isContempCaller = getIsContempCaller(payload);
  const event = isContempCaller ? payload.event : payload;

  try {
    // throw ConstraintError (caller's fault)
    if (event.action === 'throwConstraintError') {
      const error = new Error('contemp constraint error') as Error & {
        details?: unknown;
      };
      error.cause = new Error('cause message');
      error.details = { field: 'message' };
      throw Object.assign(error, { name: 'ConstraintError' });
    }

    // throw internal error (server's fault)
    if (event.action === 'throwInternalError') {
      throw new Error('contemp internal error');
    }

    // echo action
    return {
      result: `contemp: ${event.message ?? 'no message'}`,
    };
  } catch (error) {
    if (!(error instanceof Error)) throw error;

    // constraint errors return as response (not lambda failure)
    if (error.name === 'ConstraintError') {
      if (isContempCaller) {
        return getContempErrorResponse(error, 'ConstraintError');
      }
      // ancient callers expect BadRequestError for backwards compat
      return getAncientErrorResponse(error, 'BadRequestError');
    }

    // internal errors also return as response (not lambda failure)
    if (isContempCaller) {
      return getContempErrorResponse(error, 'Error');
    }
    return getAncientErrorResponse(error, 'Error');
  }
};
