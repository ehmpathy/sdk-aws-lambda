/**
 * .what = converts stack trace to string format
 * .why = stack trace can be string[] (aws native) or string (genLambdaEndpoint)
 */
export const getStackTraceString = (input: {
  stackTrace: string | string[] | undefined;
}): string | undefined => {
  if (input.stackTrace === undefined) return undefined;
  if (Array.isArray(input.stackTrace)) return input.stackTrace.join('\n');
  return input.stackTrace;
};
