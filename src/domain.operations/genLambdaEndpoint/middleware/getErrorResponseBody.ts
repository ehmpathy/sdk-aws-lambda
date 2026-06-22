/**
 * ancient error response body (flat, for backwards compat)
 */
export interface LambdaEndpointErrorResponseBodyAncient {
  errorMessage: string;
  errorType: string;
  causeMessage?: string;
  details?: unknown;
}

/**
 * contemp error response body (nested under error with explicit serde tag)
 */
export interface LambdaEndpointErrorResponseBodyContemp {
  error: {
    _serde: 'LambdaEndpointError::contemp';
    class: string;
    message: string;
    cause?: string;
    details?: unknown;
  };
}

/**
 * .what = extracts cause message from error if error has error cause
 * .why = named transformer for clear narrative
 */
const getCauseMessage = (input: { error: Error }): string | undefined => {
  if (input.error.cause instanceof Error) {
    return input.error.cause.message;
  }
  return undefined;
};

/**
 * .what = extracts metadata from error if present
 * .why = named transformer for clear narrative
 */
const getErrorMetadata = (input: { error: Error }): unknown | undefined => {
  if ('metadata' in input.error) {
    return (input.error as { metadata?: unknown }).metadata;
  }
  return undefined;
};

/**
 * .what = constructs ancient error response body (flat format)
 * .why = backwards compat for ancient callers that expect errorType/errorMessage
 */
export const getErrorResponseBodyAncient = (input: {
  error: Error;
  errorType: string;
}): LambdaEndpointErrorResponseBodyAncient => {
  const causeMessage = getCauseMessage({ error: input.error });
  const metadata = getErrorMetadata({ error: input.error });

  return {
    errorMessage: input.error.message,
    errorType: input.errorType,
    ...(causeMessage !== undefined ? { causeMessage } : {}),
    ...(metadata !== undefined ? { details: metadata } : {}),
  };
};

/**
 * .what = constructs contemp error response body (nested under error)
 * .why = clean error shape for contemp callers with explicit serde discriminator
 */
export const getErrorResponseBodyContemp = (input: {
  error: Error;
  errorClass: string;
}): LambdaEndpointErrorResponseBodyContemp => {
  const cause = getCauseMessage({ error: input.error });
  const details = getErrorMetadata({ error: input.error });

  return {
    error: {
      _serde: 'LambdaEndpointError::contemp',
      class: input.errorClass,
      message: input.error.message,
      ...(cause !== undefined ? { cause } : {}),
      ...(details !== undefined ? { details } : {}),
    },
  };
};
