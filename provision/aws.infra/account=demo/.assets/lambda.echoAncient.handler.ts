/**
 * .what = ancient lambda handler that returns flat errorMessage format
 * .why = simulates old simple-lambda-handlers for backwards compat tests
 *
 * .note = expects flat payload (no wrapper)
 *         always returns flat { errorMessage, errorType } on business errors
 *         (BadRequestError is returned as response, not thrown)
 */

type EchoEvent = {
  action: 'echo' | 'throwConstraintError' | 'throwInternalError';
  message?: string;
};

type EchoOutput = { result: string };

type AncientErrorResponse = {
  errorMessage: string;
  errorType: string;
  causeMessage?: string;
  details?: unknown;
};

export const handler = async (
  event: EchoEvent,
): Promise<EchoOutput | AncientErrorResponse> => {
  // constraint error returns flat error response (caller's fault)
  if (event.action === 'throwConstraintError') {
    return {
      errorMessage: 'ancient constraint error',
      errorType: 'BadRequestError',
      causeMessage: 'cause message',
      details: { field: 'message' },
    };
  }

  // internal error returns flat error response (server's fault)
  if (event.action === 'throwInternalError') {
    return {
      errorMessage: 'ancient internal error',
      errorType: 'Error',
    };
  }

  // echo action
  return {
    result: `ancient: ${event.message ?? 'no message'}`,
  };
};
