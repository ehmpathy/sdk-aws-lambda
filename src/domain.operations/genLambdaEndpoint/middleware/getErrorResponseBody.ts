import {
  LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP,
  type LambdaEndpointErrorResponseBodyAncient,
  type LambdaEndpointErrorResponseBodyContemp,
} from '../../../domain.objects/LambdaEndpointErrorResponseBody';

/**
 * .what = re-exports the envelope shapes this module WRITES
 * .why = they are DECLARED in `domain.objects/`, because a peer operation types
 *   its public return against them. this module is their producer, never their
 *   owner — the re-export keeps its own consumers on one import.
 */
export type {
  LambdaEndpointErrorResponseBodyAncient,
  LambdaEndpointErrorResponseBodyContemp,
};

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
  // .note = the `in` guard narrows, so this needs no cast (rule.forbid.as-cast)
  if ('metadata' in input.error) {
    return input.error.metadata;
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
      // the tag is the whole discriminator, so it has ONE writer — a producer
      // that spells it by hand can fork from the detectors, and that fork fails
      // silent: the envelope stops to be recognized and a caller fault reads as
      // a success payload.
      _serde: LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP,
      class: input.errorClass,
      message: input.error.message,
      ...(cause !== undefined ? { cause } : {}),
      ...(details !== undefined ? { details } : {}),
    },
  };
};
