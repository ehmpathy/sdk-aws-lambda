import type { LambdaClient } from '@aws-sdk/client-lambda';

import { sdkLambdaInvoke } from '../../../access/sdks/lambda/sdkLambdaInvoke';
import type { LambdaEndpoint } from '../../../domain.objects/LambdaEndpoint';
import { LambdaEndpointError } from '../../../domain.objects/LambdaEndpointError';
import { getStatusCodeHint } from '../error/getStatusCodeHint';
import { getParsedResponse } from '../serde/getParsedResponse';

/**
 * .what = minimal log interface for lambda invocation
 * .why = accepts console, sdk-logs LogMethods, or any object with debug method
 */
export interface MinimalLogMethods {
  debug: (message: string, meta?: Record<string, unknown>) => void;
}

/**
 * .what = invocation input for lambda execution
 * .why = what to invoke (the endpoint) with which payload + trail exid
 */
export type InvocationInput = {
  endpoint: LambdaEndpoint;
  payload: unknown;
  exid: string;
};

/**
 * .what = invocation context for lambda execution
 * .why = injected dependencies (sdk client + log), not invocation identity
 */
export type InvocationContext = {
  sdkLambda: LambdaClient;
  log: MinimalLogMethods | null;
};

/**
 * .what = the core lambda invocation logic
 * .why = extracted to enable cache wrapper composition
 */
export const executeLambdaInvocation = async <TResponse>(
  input: InvocationInput,
  context: InvocationContext,
): Promise<TResponse> => {
  // log invocation
  context.log?.debug('askLambdaEndpoint.invoke', {
    slug: input.endpoint.slug,
    exid: input.exid,
  });

  // invoke lambda via communicator
  // @error-enrichment: all sdkLambdaInvoke errors wrapped with endpoint context
  //   - allowlist: all errors (sdk, network, timeout) → wrap with endpoint context
  //   - original error preserved via `cause` for full stack trace
  //   - throw raw error would lose which endpoint failed
  const result = await sdkLambdaInvoke(
    { slug: input.endpoint.slug, payload: input.payload },
    { sdkLambda: context.sdkLambda },
  ).catch((error: unknown) => {
    // throw non-Error values (unexpected)
    if (!(error instanceof Error)) throw error;

    // wrap Error with endpoint context (error preserved via cause)
    throw new LambdaEndpointError(`lambda invocation threw: ${error.message}`, {
      endpoint: input.endpoint,
      exid: input.exid,
      cause: error,
    });
  });

  // check invocation status (200 = invocation succeeded, handler may have thrown)
  // non-200 = invocation itself failed (throttle, permission, not found, etc.)
  const statusCode = result.statusCode ?? 0;
  if (statusCode !== 200) {
    // construct actionable error message based on status code
    const statusHint = getStatusCodeHint(statusCode);
    throw new LambdaEndpointError(`lambda invocation failed: ${statusHint}`, {
      endpoint: input.endpoint,
      exid: input.exid,
      statusCode,
    });
  }

  // parse response
  const response = getParsedResponse<TResponse>({
    payload: result.payload,
    functionError: result.functionError,
    endpoint: input.endpoint,
    exid: input.exid,
  });

  // log result
  context.log?.debug('askLambdaEndpoint.result', {
    slug: input.endpoint.slug,
    statusCode: result.statusCode,
  });

  return response;
};
