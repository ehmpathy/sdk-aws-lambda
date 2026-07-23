import { MalfunctionError } from 'helpful-errors';

import { execFile } from 'node:child_process';
import { basename } from 'node:path';

/**
 * .what = format a generated typescript file's text via the biome formatter
 * .why = the emitter assembles bespoke text; running it through biome guarantees
 *        the output matches the extant biome config (quote style, spacing, object
 *        layout) instead of our hand-rolled whitespace — so the generated files are
 *        drop-in clean, not a source of lint churn
 *
 * .note = spawns the biome native cli (found from `@biomejs/biome`) as a
 *         subprocess over stdin. `--stdin-file-path` is a VIRTUAL name biome uses
 *         for (a) language detection and (b) matching the config's `files.includes`
 *         — NOT a real fs read. we pass `src/<filename>` so it matches the standard
 *         `src/**` include (generated sdks live under src/access/svcs/); biome
 *         discovers the config from cwd and falls back to defaults if none.
 *
 * .throws MalfunctionError — biome could not be spawned or exited non-zero
 */
export const formatTypescript = async (input: {
  content: string;
  path: string;
}): Promise<string> => {
  // locate the biome cli shim shipped by the `@biomejs/biome` package
  const biomeBin = require.resolve('@biomejs/biome/bin/biome');

  // a src-conventional virtual name so biome's `files.includes` matches + formats
  const virtualPath = `src/${basename(input.path)}`;

  // format over stdin; `--stdin-file-path` tells biome the language + include match
  return new Promise((done, fail) => {
    const child = execFile(
      process.execPath,
      [biomeBin, 'format', `--stdin-file-path=${virtualPath}`],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error)
          return fail(
            new MalfunctionError('biome failed to format generated text', {
              cause: error,
              path: input.path,
              stderr,
            }),
          );
        return done(stdout);
      },
    );

    // feed the unformatted text to biome's stdin
    child.stdin?.end(input.content);
  });
};
