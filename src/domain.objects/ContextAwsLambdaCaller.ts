import type { LambdaClient } from '@aws-sdk/client-lambda';
import type { EnvironmentAccessTier } from 'sdk-environment';
import type { ContextLogTrail } from 'sdk-logs';

/**
 * .what = caller-side context to invoke lambda endpoints
 * .why = the context for code that INVOKES a lambda
 *        (askLambdaEndpoint, getOneLambdaContract, getAllLambdaContracts share it)
 *
 * - log: required (extends ContextLogTrail) for trail propagation + observability
 * - env: the caller's ambient runtime; access is required (no default) per
 *        rule.require.env-access-in-context. access is the canonical
 *        EnvironmentAccessTier (test | prep | prod) from sdk-environment
 * - aws: injectable sdk client (dependency injection: test seams, reuse)
 */
export interface ContextAwsLambdaCaller extends ContextLogTrail {
  env: {
    access: EnvironmentAccessTier;
    region?: string;
  };
  aws?: {
    lambda?: { sdk?: LambdaClient };
  };
}
