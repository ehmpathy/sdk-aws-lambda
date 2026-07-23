import { MalfunctionError } from 'helpful-errors';
import { getError, given, then, useBeforeAll, when } from 'test-fns';

import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GeneratedFile } from '../../../domain.objects/GeneratedFile';
import { setGeneratedFilesBatch } from './setGeneratedFilesBatch';

describe('setGeneratedFilesBatch', () => {
  given('[case1] a batch into a not-yet-existent nested dir', () => {
    const scene = useBeforeAll(async () => {
      const root = await mkdtemp(join(tmpdir(), 'codegen-batch-'));
      const dir = join(root, 'access', 'svcs'); // does not exist yet
      return { root, dir };
    });
    afterAll(async () => rm(scene.root, { recursive: true, force: true }));

    when('[t0] written', () => {
      const files = (): GeneratedFile[] => [
        { path: join(scene.dir, 'svcJobs.ts'), content: 'a' },
        { path: join(scene.dir, 'svcJobs.mechanisms.ts'), content: 'b' },
        { path: join(scene.dir, 'svcJobs.resources.ts'), content: 'c' },
      ];

      then('all three files land with the right content', async () => {
        await setGeneratedFilesBatch({ files: files() });
        expect(await readFile(join(scene.dir, 'svcJobs.ts'), 'utf-8')).toEqual(
          'a',
        );
        expect(
          await readFile(join(scene.dir, 'svcJobs.mechanisms.ts'), 'utf-8'),
        ).toEqual('b');
        expect(
          await readFile(join(scene.dir, 'svcJobs.resources.ts'), 'utf-8'),
        ).toEqual('c');
      });

      then('no temp files are left behind', async () => {
        const entries = await readdir(scene.dir);
        expect(entries.some((e) => e.includes('.tmp-'))).toEqual(false);
      });
    });
  });

  given('[case2] a batch where one target path cannot be written', () => {
    const scene = useBeforeAll(async () => {
      const root = await mkdtemp(join(tmpdir(), 'codegen-batch-fail-'));
      // occupy a path with a FILE, then ask to write UNDER it (ENOTDIR on mkdir)
      const blocker = join(root, 'blocker');
      await writeFile(blocker, 'x', 'utf-8');
      return { root, blocker };
    });
    afterAll(async () => rm(scene.root, { recursive: true, force: true }));

    when('[t0] written with a good file + a doomed file', () => {
      const files = (): GeneratedFile[] => [
        { path: join(scene.root, 'ok.ts'), content: 'ok' },
        // this parent is a file, so mkdir/write fails
        { path: join(scene.blocker, 'nested', 'bad.ts'), content: 'bad' },
      ];

      then('it throws MalfunctionError', async () => {
        const error = await getError(
          setGeneratedFilesBatch({ files: files() }),
        );
        expect(error).toBeInstanceOf(MalfunctionError);
      });

      then('no partial output remains (no final ok.ts, no temps)', async () => {
        // run again to observe post-failure state deterministically
        await getError(setGeneratedFilesBatch({ files: files() }));
        const entries = await readdir(scene.root);
        // ok.ts must NOT have been committed (temp for it is cleaned; rename never ran)
        expect(entries.includes('ok.ts')).toEqual(false);
        expect(entries.some((e) => e.includes('.tmp-'))).toEqual(false);
      });
    });
  });
});
