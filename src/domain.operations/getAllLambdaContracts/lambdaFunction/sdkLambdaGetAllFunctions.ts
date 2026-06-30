import {
  type LambdaClient,
  ListFunctionsCommand,
} from '@aws-sdk/client-lambda';

/**
 * .what = list lambda function slugs via aws sdk
 * .why = communicator encapsulates raw aws sdk i/o at boundary
 *
 * .note = aws function names ARE endpoint slugs; sdkLambda (the client
 *         dependency) is injected via context
 */
export const sdkLambdaGetAllFunctions = async (
  input: {
    marker?: string;
  },
  context: {
    sdkLambda: LambdaClient;
  },
): Promise<{
  slugs: string[];
  nextMarker: string | undefined;
}> => {
  const result = await context.sdkLambda.send(
    new ListFunctionsCommand({
      Marker: input.marker,
      MaxItems: 50,
    }),
  );

  const slugs = (result.Functions ?? [])
    .map((fn) => fn.FunctionName)
    .filter((name): name is string => name !== undefined);

  return {
    slugs,
    nextMarker: result.NextMarker,
  };
};
