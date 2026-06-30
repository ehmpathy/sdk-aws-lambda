import { LambdaClient } from '@aws-sdk/client-lambda';

/**
 * .what = returns the injected LambdaClient or creates a new one
 * .why = named transformer for clear narrative in orchestrator
 */
export const genLambdaSdk = (input: {
  sdk?: LambdaClient;
  env?: { region?: string };
}): LambdaClient => {
  // return injected LambdaClient if provided
  if (input.sdk) return input.sdk;

  // create LambdaClient, let sdk infer region unless explicitly provided
  return new LambdaClient(
    input.env?.region ? { region: input.env.region } : {},
  );
};
