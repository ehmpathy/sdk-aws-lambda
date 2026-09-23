/**
 * .what = bundle a handler source with esbuild and upsert it onto disk as a zip
 * .why = `genDeclaredAwsLambdaCode({ zipUri })` takes a path, so every deployed suite
 *        needs this exact pair of steps before it can declare a lambda. four suites
 *        each rewrote it (rule.prefer.wet-over-dry's threshold, doubled)
 *
 * .note = `set` in the get/set/gen/del sense — an upsert that converges, so a re-run
 *         overwrites both artifacts rather than leaves a stale one behind
 *         (rule.require.idempotent-procedures)
 */
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import * as esbuild from 'esbuild';

export const setLambdaZip = async (input: {
  /** the `.ts` entrypoint to bundle — one bundle may carry several handler exports */
  handlerSource: string;
  /** where the `.js` and `.zip` artifacts land */
  buildDir: string;
  /**
   * the basename shared by both artifacts, WITHOUT an extension
   *
   * .note = this must match the first segment of each lambda's `handler` field — aws
   *         reads `refTrophyHandlers.getTrophy` as "the `getTrophy` export of
   *         `refTrophyHandlers.js` inside the zip", so the name inside the archive is
   *         material rather than cosmetic
   */
  bundleName: string;
}): Promise<{ zipPath: string }> => {
  const bundlePath = join(input.buildDir, `${input.bundleName}.js`);
  const zipPath = join(input.buildDir, `${input.bundleName}.zip`);

  // ⚠️ .why the ELAPSED line = this phase is one term of a deploy hook's timeout budget
  //         (`LAMBDA_DEPLOY_PREFLIGHT_BUDGET_MS`, `setLambdaLive.ts`), and that budget is a
  //         MEASURED bound rather than a derived arithmetic — neither this phase nor the iam
  //         upsert beside it has a waiter constant to sum. so without a duration on the wire,
  //         the budget is an assertion no later reader can check, and a hook that exceeds it
  //         reports `Exceeded timeout of N ms` while it names no phase
  //         (rule.require.measure-the-value-you-emit, rule.require.status-feedback)
  const startedAt = Date.now();

  await mkdir(input.buildDir, { recursive: true });
  await esbuild.build({
    entryPoints: [input.handlerSource],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: bundlePath,
    external: ['@aws-sdk/*'],
  });

  const output = createWriteStream(zipPath);
  // archiver's runtime module exports `ZipArchive` (see archiver/index.js:8
  // `export class ZipArchive extends Archiver`), but its shipped .d.ts models the
  // package as a factory fn, so the named export is absent from its types. cast at
  // this external-package boundary; removable once archiver's types expose it.
  const { ZipArchive } = (await import('archiver')) as unknown as {
    ZipArchive: new (options: {
      zlib: { level: number };
    }) => import('archiver').Archiver;
  };
  const archive = new ZipArchive({ zlib: { level: 9 } });

  // ⚠️ .why the `close` event and NOT the `finalize()` promise = `archive.finalize()`
  //         settles once the archiver has handed its last byte to the stream, which is one
  //         step short of those bytes on disk. the write stream's `close` is the event that
  //         says the file is complete and readable. a caller's next act is to hand `zipPath`
  //         to aws, so a wait on `finalize()` alone uploads a truncated zip — and that
  //         failure surfaces at deploy time, far from its cause
  //         (rule.forbid.race-conditions)
  // ⚠️ .why BOTH `error` listeners = they cover DIFFERENT failures, and neither covers the
  //         other. `archive.on('error')` fires for a fault INSIDE the archiver — an absent
  //         source file, a compression fault. `output.on('error')` fires for a fault at the
  //         DESTINATION — `ENOSPC`, `EACCES`, a path whose parent went away. `.pipe()` does
  //         not forward a destination error back to the source, so with the archive listener
  //         alone a write failure reaches neither `done` nor `fail`: the promise never
  //         settles, and the suite's `useBeforeAll` reports a jest TIMEOUT instead of the
  //         real io cause (rule.forbid.failhide, rule.require.failfast)
  // ⚠️ .why `.catch(fail)` on finalize and NOT `void` = a THIRD failure surface, and the two
  //         listeners above cover it no more than they cover each other. `finalize()` returns
  //         its own promise, which can reject before either event fires — so `void` hands that
  //         rejection to node's unhandled-rejection handler and the outer promise never
  //         settles. that is the identical silent hang the `output.on('error')` listener was
  //         added to prevent, one path over (rule.require.sweep-the-defect-class)
  // .note = it does NOT contradict the `close`-over-`finalize` decision above. the DONE half
  //         still waits on `close`, because only `close` says the bytes are on disk. what
  //         routes through `fail` here is the reject half, which `close` can never deliver
  await new Promise<void>((done, fail) => {
    output.on('close', () => done());
    output.on('error', fail);
    archive.on('error', fail);
    archive.pipe(output);
    archive.file(bundlePath, { name: `${input.bundleName}.js` });
    archive.finalize().catch(fail);
  });

  console.log(
    `⏱ ${input.bundleName}: bundle + zip took ${Date.now() - startedAt}ms`,
  );

  return { zipPath };
};
