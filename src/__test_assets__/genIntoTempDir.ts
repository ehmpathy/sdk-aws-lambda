import type { LambdaClient } from '@aws-sdk/client-lambda';
import type { EnvironmentAccessTier } from 'sdk-environment';
import { type ContextLogTrail, genContextLogTrail } from 'sdk-logs';

import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { genServiceSdk } from '../domain.operations/genServiceSdk/genServiceSdk';

/**
 * .what = run genServiceSdk against an in-process harness sdk into a fresh temp
 *         dir, then read back the generated files
 * .why = a reusable seam for orchestrator + acceptance tests to exercise the full
 *        codegen (introspect real handlers → emit files) without a deploy or a
 *        real fs footprint in the repo
 *
 * .note = `access` is required (no default) per rule.require.env-access-in-context;
 *         the caller may inject `log` via context (defaults when absent)
 *
 * .returns { dir, files } — the temp dir + a map of filename → content
 */
export const genIntoTempDir = async (
  input: {
    service: string;
    sdk: LambdaClient;
    access: EnvironmentAccessTier;
  },
  context?: { log?: ContextLogTrail['log'] },
): Promise<{ dir: string; files: Record<string, string> }> => {
  // a throwaway temp dir for this run
  const dir = await mkdtemp(join(tmpdir(), 'codegen-run-'));

  const log =
    context?.log ?? genContextLogTrail({ trail: null, env: null }).log;

  // run the codegen with the harness sdk injected + the caller's access
  await genServiceSdk(
    { which: { service: input.service }, into: dir },
    {
      log,
      env: { access: input.access },
      aws: { lambda: { sdk: input.sdk } },
    },
  );

  // read back every emitted file as filename → content
  const names = await readdir(dir);
  const entries = await Promise.all(
    names.map(
      async (name) => [name, await readFile(join(dir, name), 'utf-8')] as const,
    ),
  );

  return { dir, files: Object.fromEntries(entries) };
};
