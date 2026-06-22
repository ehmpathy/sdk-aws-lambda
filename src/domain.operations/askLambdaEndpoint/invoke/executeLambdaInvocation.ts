import type { LambdaClient } from '@aws-sdk/client-lambda';

import { LambdaEndpointError } from '../../../domain.objects/LambdaEndpointError';
import { getStatusCodeHint } from '../error/getStatusCodeHint';
import { getParsedResponse } from '../serde/getParsedResponse';
import { sdkLambdaInvoke } from './sdkLambdaInvoke';

/**
 * .what = minimal log interface for lambda invocation
 * .why = accepts console, sdk-logs LogMethods, or any object with debug method
 */
export interface MinimalLogMethods {
  debug: (message: string, meta?: Record<string, unknown>) => void;
}

/**
 * .what = invocation args for lambda execution
 * .why = typed input for executor functions
 */
export type InvocationArgs = {
  functionName: string;
  payload: unknown;
  exid: string;
  service: string;
  function: string;
  lambdaClient: LambdaClient;
  log: MinimalLogMethods | null;
};

/**
 * .what = the core lambda invocation logic
 * .why = extracted to enable cache wrapper composition
 */
export const executeLambdaInvocation = async <TResponse>(
  input: InvocationArgs,
): Promise<TResponse> => {
  // log invocation
  input.log?.debug('askLambdaEndpoint.invoke', {
    functionName: input.functionName,
    exid: input.exid,
  });

  // invoke lambda via communicator
  const result = await sdkLambdaInvoke({
    client: input.lambdaClient,
    functionName: input.functionName,
    payload: input.payload,
  }).catch((error: unknown) => {
    throw new LambdaEndpointError(
      `lambda invocation threw: ${error instanceof Error ? error.message : String(error)}`,
      {
        service: input.service,
        function: input.function,
        exid: input.exid,
        cause: error instanceof Error ? error : undefined,
      },
    );
  });

  // check invocation status (200 = invocation succeeded, handler may have thrown)
  // non-200 = invocation itself failed (throttle, permission, not found, etc.)
  const statusCode = result.statusCode ?? 0;
  if (statusCode !== 200) {
    // construct actionable error message based on status code
    const statusHint = getStatusCodeHint(statusCode);
    throw new LambdaEndpointError(`lambda invocation failed: ${statusHint}`, {
      service: input.service,
      function: input.function,
      exid: input.exid,
      statusCode,
    });
  }

  // parse response
  const response = getParsedResponse<TResponse>({
    payload: result.payload,
    functionError: result.functionError,
    service: input.service,
    function: input.function,
    exid: input.exid,
  });

  // log result
  input.log?.debug('askLambdaEndpoint.result', {
    functionName: input.functionName,
    statusCode: result.statusCode,
  });

  return response;
};
