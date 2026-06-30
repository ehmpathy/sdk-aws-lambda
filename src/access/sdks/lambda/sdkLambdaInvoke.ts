import { InvokeCommand, type LambdaClient } from '@aws-sdk/client-lambda';

/**
 * .what = raw lambda invocation response
 * .why = typed response from aws lambda invoke
 */
export interface LambdaInvokeResponse {
  statusCode: number | undefined;
  functionError: string | undefined;
  payload: Uint8Array | undefined;
}

/**
 * .what = invoke a lambda function via aws sdk
 * .why = communicator encapsulates raw aws sdk i/o at boundary
 *
 * .note = input.slug is the endpoint slug = the aws function name (wire id);
 *         sdkLambda (the client dependency) is injected via context
 */
export const sdkLambdaInvoke = async (
  input: {
    slug: string;
    payload: unknown;
  },
  context: {
    sdkLambda: LambdaClient;
  },
): Promise<LambdaInvokeResponse> => {
  const result = await context.sdkLambda.send(
    new InvokeCommand({
      FunctionName: input.slug,
      Payload: Buffer.from(JSON.stringify(input.payload)),
    }),
  );

  return {
    statusCode: result.StatusCode,
    functionError: result.FunctionError,
    payload: result.Payload,
  };
};
