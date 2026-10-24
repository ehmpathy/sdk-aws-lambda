import { useKeyrack } from './src/__test_assets__/useKeyrack';

/**
 * .what = export the tier's aws sso creds ONCE per jest run, in the parent process, before any
 *         worker forks
 * .why = `setupFilesAfterEnv` runs once per test FILE. when each file ran the export itself, a
 *        thorough integration run made 22 concurrent `aws configure export-credentials` calls,
 *        and the slow ones hit the 30s kill (`signal: SIGTERM`, `code: ETIMEDOUT`) on a valid
 *        sso session, so a random file failed to boot each run. the parent's `process.env` is
 *        what each worker inherits, so one export here reaches every file, and each file's own
 *        `useKeyrack` finds `AWS_ACCESS_KEY_ID` set and skips its export
 * .note = the per-file `useKeyrack` call stays: it is the backstop for a run that bypasses this
 *         setup, and it costs naught once the creds are present
 * .note = `AWS_EC2_METADATA_DISABLED` is NOT set here. each suite's env file sets it before any
 *         aws client is built; this file builds none, and the cli export must stay free to read
 *         the profile's own credential source
 */
// eslint-disable-next-line import/no-default-export
export default async (): Promise<void> => {
  useKeyrack({ env: 'test' });
};
