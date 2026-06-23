/**
 * .what = transforms service, access, and function into aws lambda function name
 * .why = aws lambda name convention follows ${service}-${access}-${function} pattern
 */
export const getLambdaFunctionName = (input: {
  service: string;
  access: string;
  function: string;
}): string => {
  return `${input.service}-${input.access}-${input.function}`;
};
