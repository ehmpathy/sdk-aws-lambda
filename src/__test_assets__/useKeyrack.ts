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

/**
 * .what = read the aws cli's own refusal off a failed `execFileSync`: its stderr, exit status,
 *         signal, and error code.
 * .why = jest prints a thrown error's message and metadata, never its `cause`. without this
 *        the log names a failed export but hides why it failed (a timeout, an expired token, a
 *        contended sso cache), and the cause cannot be diagnosed from the log.
 */
const asCliRefusalFromExecError = (input: {
  error: unknown;
}): {
  stderr: string | null;
  status: number | null;
  signal: string | null;
  code: string | null;
} => {
  // note: node types a thrown exec error as `unknown`; each field is guarded by typeof below
  const error = (input.error ?? {}) as {
    stderr?: unknown;
    status?: unknown;
    signal?: unknown;
    code?: unknown;
  };
  const stderr =
    typeof error.stderr === 'string' || Buffer.isBuffer(error.stderr)
      ? String(error.stderr).trim()
      : null;
  return {
    stderr: stderr || null,
    status: typeof error.status === 'number' ? error.status : null,
    signal: typeof error.signal === 'string' ? error.signal : null,
    code: typeof error.code === 'string' ? error.code : null,
  };
};

// an sso refresh is network-bound (identity-provider round-trip); a slow-but-valid refresh must
// not read as a dead login. bound it generously, and name the budget so it is not a magic number.
// measured: one export, alone in jest's global setup on a fresh sso session, ran past 30s and
// was killed (`SIGTERM`, `ETIMEDOUT`). 120s holds that measure with headroom.
const SSO_EXPORT_TIMEOUT_MS = 120000;

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
 *         chain. the fix it names is the paved `rhx keyrack unlock` for the same owner and env
 *         that sourced the profile: it refreshes the sso session with no browser prompt where
 *         one is cached. the raw `aws sso login` stays only as the last resort. the profile is
 *         passed as an argv element, never interpolated into a shell string, so a profile with
 *         shell metacharacters cannot be interpreted (no injection).
 */
export const exportAwsCredentialsFromSsoProfile = (
  input: { profile: string; keyrack: { owner: string; env: string } },
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
        `failed to export aws credentials from sso profile '${input.profile}'. run: rhx keyrack unlock --owner ${input.keyrack.owner} --env ${input.keyrack.env}`,
        {
          hint: `last resort, if the unlock cannot refresh the session: aws sso login --profile ${input.profile}`,
          cli: asCliRefusalFromExecError({ error }),
          cause: error instanceof Error ? error : undefined,
        },
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
  input: { profile: string; keyrack: { owner: string; env: string } },
  context: {
    env: NodeJS.ProcessEnv;
    exportCreds?: typeof exportAwsCredentialsFromSsoProfile;
  },
): void => {
  const exportCreds = context.exportCreds ?? exportAwsCredentialsFromSsoProfile;

  const creds = exportCreds({ profile: input.profile, keyrack: input.keyrack });
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
 * .note = step 4 is what makes `jest.keyrack.globalsetup.ts` cure the export race: that setup
 *         runs this once in the parent, so each per-file call finds static creds and skips the
 *         cli. `context` exists so a unit test can clamp that skip with no aws call
 */
export const useKeyrack = (
  input?: {
    env?: 'test' | 'prep' | 'prod';
    owner?: string;
    mode?: 'strict' | 'lenient';
  },
  context: {
    env?: NodeJS.ProcessEnv;
    source?: typeof keyrack.source;
    exportCreds?: typeof exportAwsCredentialsFromSsoProfile;
  } = {},
): void => {
  const env = input?.env ?? 'test';
  const owner = input?.owner ?? 'ehmpath';
  const mode = input?.mode ?? 'lenient';
  const processEnv = context.env ?? process.env;
  const source = context.source ?? keyrack.source;

  if (processEnv.CI) return;

  const keyrackYmlPath = join(process.cwd(), '.agent/keyrack.yml');
  if (!existsSync(keyrackYmlPath)) return;

  source({ env, owner, mode });

  if (processEnv.AWS_ACCESS_KEY_ID) {
    delete processEnv.AWS_PROFILE;
    delete processEnv.AWS_DEFAULT_PROFILE;
    return;
  }

  const awsSsoProfile = getOneAwsSsoProfileFromEnv({}, { env: processEnv });
  spliceAwsStaticCredsIntoEnv(
    { profile: awsSsoProfile, keyrack: { owner, env } },
    { env: processEnv, exportCreds: context.exportCreds },
  );
};
