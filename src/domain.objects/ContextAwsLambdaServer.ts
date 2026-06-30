import type { EnvironmentAccessTier } from 'sdk-environment';
import type { LogMethods } from 'sdk-logs';

/**
 * .what = env access level for the introspection gate
 * .why = constrains a handler's declared access to valid values; the canonical
 *        access tier from sdk-environment (test | prep | prod)
 */
export type EnvAccess = EnvironmentAccessTier;

/**
 * .what = handler env config — static or async access extraction
 * .why = a deployed handler declares its own access (sync or via async lookup)
 *        so the introspection middleware can gate on env.access === 'prep'
 */
export type EnvConfig =
  | { access: EnvAccess }
  | (() => Promise<{ access: EnvAccess }>);

/**
 * .what = server-side context for lambda handler generators
 * .why = the context for code that DEFINES a lambda handler
 *        (genLambdaEndpoint, forApiGateway, and future forXyz variants share it)
 *
 * - env: the handler declares its own access for the introspection gate
 * - log: optional gen-time override; the trail middleware injects log at runtime
 */
export interface ContextAwsLambdaServer {
  env?: EnvConfig;
  log?: LogMethods;
}
