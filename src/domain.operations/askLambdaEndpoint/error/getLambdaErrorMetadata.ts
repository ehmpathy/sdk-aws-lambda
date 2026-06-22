import type { LambdaErrorResponseAncient } from './getIsLambdaErrorResponse';

/**
 * .what = error metadata for lambda error responses
 * .why = typed representation of optional error fields
 */
export interface LambdaErrorMetadata {
  details?: unknown;
  causeMessage?: string;
}

/**
 * .what = extracts optional metadata fields from lambda error response
 * .why = named transformer for clear narrative in getParsedResponse
 */
export const getLambdaErrorMetadata = (input: {
  errorResponse: LambdaErrorResponseAncient;
}): LambdaErrorMetadata => {
  return {
    ...(input.errorResponse.details !== undefined && {
      details: input.errorResponse.details,
    }),
    ...(input.errorResponse.causeMessage !== undefined && {
      causeMessage: input.errorResponse.causeMessage,
    }),
  };
};
