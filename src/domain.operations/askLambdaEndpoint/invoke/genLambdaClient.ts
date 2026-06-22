import { LambdaClient } from '@aws-sdk/client-lambda';

/**
 * .what = returns the injected lambda client or creates a new one
 * .why = named transformer for clear narrative in orchestrator
 */
export const genLambdaClient = (input: {
  sdk?: LambdaClient;
  env?: { region?: string };
}): LambdaClient => {
  // return injected client if provided
  if (input.sdk) return input.sdk;

  // create client, let SDK infer region unless explicitly provided
  return new LambdaClient(
    input.env?.region ? { region: input.env.region } : {},
  );
};
