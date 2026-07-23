import { MalfunctionError } from 'helpful-errors';

import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { GeneratedFile } from '../../../domain.objects/GeneratedFile';

/**
 * .what = write a batch of generated files atomically (all-or-none on disk)
 * .why = three sequential single-file writes could leave a partial sdk if the fs
 *        fails on file 2 of 3; this stages all to temp names, then renames each
 *        into place — on any failure it removes the temp files and throws, so the
 *        target directory is never left with a partial set (uc.1 all-or-none)
 *
 * .throws MalfunctionError — a filesystem write/rename failed; temps are cleaned
 */
export const setGeneratedFilesBatch = async (input: {
  files: GeneratedFile[];
}): Promise<void> => {
  // pair each target path with an adjacent temp path
  const staged = input.files.map((file) => ({
    finalPath: file.path,
    tempPath: `${file.path}.tmp-${process.pid}-${Date.now()}`,
    content: file.content,
  }));

  try {
    // write every file to its temp path first (parent dirs made as needed)
    for (const item of staged) {
      await mkdir(dirname(item.finalPath), { recursive: true });
      await writeFile(item.tempPath, item.content, 'utf-8');
    }

    // commit: rename each temp into its final place
    for (const item of staged) {
      await rename(item.tempPath, item.finalPath);
    }
  } catch (error) {
    // cleanup: attempt to remove every temp file, then fail loud with the
    // original cause. allSettled (not a per-item catch) is deliberate — the
    // primary fs error is what must surface; a secondary cleanup failure must
    // neither mask it nor abort the other cleanups. `rm({ force: true })` is
    // already a no-op for an absent temp, so the only settle-rejections here
    // are genuine unlink faults, which are subordinate to the thrown cause.
    await Promise.allSettled(
      staged.map((item) => rm(item.tempPath, { force: true })),
    );
    throw new MalfunctionError('failed to write generated files', {
      cause: error instanceof Error ? error : new Error(String(error)),
      paths: input.files.map((f) => f.path),
    });
  }
};
