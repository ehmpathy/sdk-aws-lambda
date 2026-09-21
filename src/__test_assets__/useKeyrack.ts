import { ConstraintError } from 'helpful-errors';
import { keyrack } from 'rhachet/keyrack';

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * .what = parse the `export KEY=VALUE` lines of `aws ... export-credentials --format env` into a
 *         `{ KEY: VALUE }` record.
 * .why = names the line-parse as one pure transform, so `exportAwsCredentialsFromSsoProfile` reads
 *        what-not-how rather than an inline positional decode a reader must simulate.
 */
const asCredentialsRecordFromExportLines = (input: {
  output: string;
}): Record<string, string> =>
  Object.fromEntries(
    input.output
      .split('\n')
      .map((line) => line.match(/^export\s+(\w+)=(.*)$/))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => [match[1]!, match[2]!] as const),
  );

// an sso refresh is network-bound (identity-provider round-trip); a slow-but-valid refresh must
// not read as a dead login. bound it generously, and name the budget so it is not a magic number.
const SSO_EXPORT_TIMEOUT_MS = 30000;

/**
 * .what = export the aws credentials of an sso profile into a `{ KEY: VALUE }` record, via
 *         `aws configure export-credentials --format env`.
 * .why = this sdk builds a v3 `LambdaClient`, and v3's default credential provider chain
 *        resolves `AWS_PROFILE` through the ambient grove EC2 instance's own credentials first
 *        (`credential_source = Ec2InstanceMetadata`) — which invokes against the grove's OWN
 *        account rather than the chained target account the profile names. a splice of static
 *        creds settles the ambiguity deterministically, the same guard this org's shared
 *        `useKeyrack` practice already carries for every other aws-dependent repo.
 * .note = a failed export is CALLER-must-fix (a stale/absent sso login), so it throws a
 *         `ConstraintError` (exit 2) that NAMES the fix and PRESERVES the real cause on the
 *         chain. the profile is passed as an argv element, never interpolated into a shell
 *         string, so a profile with shell metacharacters cannot be interpreted (no injection).
 */
export const exportAwsCredentialsFromSsoProfile = (
  input: { profile: string },
  context: { exec?: typeof execFileSync } = {},
): Record<string, string> => {
  const exec = context.exec ?? execFileSync;

  const credOutput = ((): string => {
    try {
      return exec(
        'aws',
        [
          'configure',
          'export-credentials',
          '--profile',
          input.profile,
          '--format',
          'env',
        ],
        { encoding: 'utf8', timeout: SSO_EXPORT_TIMEOUT_MS },
      ) as string;
    } catch (error) {
      throw new ConstraintError(
        `failed to export aws credentials from sso profile '${input.profile}'. run: aws sso login --profile ${input.profile}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
  })();

  return asCredentialsRecordFromExportLines({ output: credOutput });
};

/**
 * .what = splice the sso profile's static creds into `env` and remove `AWS_PROFILE`, so the
 *         v3 sdk authenticates against the intended target rather than a fallback ambient
 *         credential.
 * .why = `keyrack.source` sets only `AWS_PROFILE`; a splice of static creds AND a removal of
 *        `AWS_PROFILE` makes the target account deterministic regardless of how the sdk's
 *        credential provider chain resolves a profile with `credential_source =
 *        Ec2InstanceMetadata`.
 * .note = the splice is scoped to an `AWS_`-prefixed allowlist, never every key the cli emits,
 *         so a future cli line or proxy banner never leaks into the shared process env.
 */
const AWS_CRED_KEY_PREFIX = 'AWS_';
export const spliceAwsStaticCredsIntoEnv = (
  input: { profile: string },
  context: {
    env: NodeJS.ProcessEnv;
    exportCreds?: typeof exportAwsCredentialsFromSsoProfile;
  },
): void => {
  const exportCreds = context.exportCreds ?? exportAwsCredentialsFromSsoProfile;

  const creds = exportCreds({ profile: input.profile });
  for (const [key, value] of Object.entries(creds))
    if (key.startsWith(AWS_CRED_KEY_PREFIX)) context.env[key] = value;

  delete context.env.AWS_PROFILE;
};

/**
 * .what = read the sso profile from `env.AWS_PROFILE`, or throw a ConstraintError that names
 *         the fix.
 * .why = both aws jest envs need an sso profile, which `keyrack.source` sets from this repo's
 *        `.agent/keyrack.yml`. when that manifest never declares `AWS_PROFILE`, keyrack sets no
 *        key and this guard fires — so the error names the exact key to add.
 */
export const getOneAwsSsoProfileFromEnv = (
  input: Record<string, never>,
  context: { env: NodeJS.ProcessEnv },
): string => {
  const profile = context.env.AWS_PROFILE;
  if (!profile)
    throw new ConstraintError(
      'AWS_PROFILE not set. declare it in .agent/keyrack.yml (under env.test, and env.all so every tier sources it), so keyrack.source() can set it.',
    );
  return profile;
};

/**
 * .what = source aws credentials from keyrack for the target tier and export them to
 *         `process.env` in ONE call — the single entrypoint both jest envs use for credential
 *         setup.
 * .how =
 *   1. skip in CI (credentials arrive from secrets, not keyrack)
 *   2. skip if this repo declares no `.agent/keyrack.yml`
 *   3. keyrack.source for the tier (sets AWS_PROFILE)
 *   4. if static creds are already present, clear AWS_PROFILE so the sdk prefers them, and return
 *   5. else, export the sso profile's static creds via the guard above
 */
export const useKeyrack = (input?: {
  env?: 'test' | 'prep' | 'prod';
  owner?: string;
  mode?: 'strict' | 'lenient';
}): void => {
  const env = input?.env ?? 'test';
  const owner = input?.owner ?? 'ehmpath';
  const mode = input?.mode ?? 'lenient';

  if (process.env.CI) return;

  const keyrackYmlPath = join(process.cwd(), '.agent/keyrack.yml');
  if (!existsSync(keyrackYmlPath)) return;

  keyrack.source({ env, owner, mode });

  if (process.env.AWS_ACCESS_KEY_ID) {
    delete process.env.AWS_PROFILE;
    delete process.env.AWS_DEFAULT_PROFILE;
    return;
  }

  const awsSsoProfile = getOneAwsSsoProfileFromEnv({}, { env: process.env });
  spliceAwsStaticCredsIntoEnv({ profile: awsSsoProfile }, { env: process.env });
};
