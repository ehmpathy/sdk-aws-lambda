import { ConstraintError } from 'helpful-errors';
import {
  type EnvironmentAccessTier,
  isEnvironmentAccessTier,
} from 'sdk-environment';

/**
 * .what = parse + validate the `gen` cli args into a typed, safe shape
 * .why = the cli boundary must fail loud on bad input (per rule.require.failfast)
 *        before the orchestrator runs; a malformed invocation should never reach
 *        the spine
 *
 * .args
 *   --for <service>   a svc-{noun} service name (required)
 *   --into <dir>      the target directory (required)
 *   --env <access>    the env access tier: test | prep | prod (required)
 *
 * .throws ConstraintError — a required arg is absent or invalid (with usage hint)
 */
export const asGenArgs = (input: {
  argv: string[];
}): { service: string; into: string; access: EnvironmentAccessTier } => {
  // parse `--flag value` pairs from argv
  const flags = asFlagMap(input.argv);

  // --for: required, must be svc-<noun> shaped. distinguish the two faults so the
  // user sees which mistake they made — absent flag vs a malformed value
  const service = flags['for'];
  if (!service)
    return throwUsage(`--for is required; must be a svc-<noun> service name`);
  if (!/^svc-[a-z0-9]+$/.test(service))
    return throwUsage(
      `invalid --for value '${service}'; must be a svc-<noun> service name`,
    );

  // --into: required, non-empty
  const into = flags['into'];
  if (!into) return throwUsage(`--into <dir> is required`);

  // --env: required, must be a valid access tier
  const env = flags['env'];
  if (!env) return throwUsage(`--env <test|prep|prod> is required`);
  if (!isEnvironmentAccessTier(env))
    return throwUsage(`--env must be one of: test | prep | prod`);

  return { service, into, access: env };
};

/**
 * .what = collect `--flag value` pairs from an argv array into a map
 * .why = a tiny hand-parse; a full arg framework is unwarranted for 3 flags
 */
const asFlagMap = (argv: string[]): Record<string, string> => {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token?.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1];
      if (value !== undefined && !value.startsWith('--')) {
        flags[key] = value;
        i += 1;
      }
    }
  }
  return flags;
};

/**
 * .what = throw a ConstraintError with the standard usage hint
 */
const throwUsage = (reason: string): never => {
  throw new ConstraintError(reason, {
    usage:
      'sdk-aws-lambda gen --for svc-<noun> --into <dir> --env <test|prep|prod>',
  });
};
