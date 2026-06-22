/**
 * contemp error response shape from genLambdaEndpoint
 * .note = has explicit _serde discriminator for clean detection
 */
export interface LambdaErrorResponseContemp {
  error: {
    _serde: 'LambdaEndpointError::contemp';
    class: string;
    message: string;
    cause?: string;
    details?: unknown;
  };
}

/**
 * ancient error response shape from AWS Lambda or old genLambdaEndpoint
 * .note = stackTrace can be string[] (aws native) or string (genLambdaEndpoint)
 */
export interface LambdaErrorResponseAncient {
  errorMessage: string;
  errorType?: string;
  stackTrace?: string[] | string;
  /**
   * validation issues or other error details from genLambdaEndpoint
   * .note = genConstraintErrorMiddleware sends error.metadata as details
   */
  details?: unknown;
  /**
   * cause error message from genLambdaEndpoint
   * .note = genConstraintErrorMiddleware sends error.cause.message as causeMessage
   */
  causeMessage?: string;
}

/**
 * .what = checks if parsed response is a contemp lambda error response
 * .why = contemp errors have { error: { _serde: 'LambdaEndpointError::contemp' } }
 */
export const getIsContempErrorResponse = (
  parsed: unknown,
): parsed is LambdaErrorResponseContemp =>
  typeof parsed === 'object' &&
  parsed !== null &&
  'error' in parsed &&
  typeof (parsed as Record<string, unknown>).error === 'object' &&
  (parsed as Record<string, unknown>).error !== null &&
  ((parsed as Record<string, Record<string, unknown>>).error as Record<string, unknown>)._serde === 'LambdaEndpointError::contemp';

/**
 * .what = checks if parsed response is an ancient lambda error response
 * .why = ancient errors have flat errorMessage property
 */
export const getIsAncientErrorResponse = (
  parsed: unknown,
): parsed is LambdaErrorResponseAncient =>
  typeof parsed === 'object' && parsed !== null && 'errorMessage' in parsed;

