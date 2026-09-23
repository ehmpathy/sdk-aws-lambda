import { given, then, when } from 'test-fns';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * .what = asserts that every `@example` this package SHIPS has a case in
 *         `advertisedExamples.test.ts`
 * .why = that file's `.what` claims it runs EVERY advertised sample, and a prose
 *        claim of completeness reads identical whether it is true or false.
 *
 * ⇒ so this is a DERIVED guard: it walks the tree rather than compares against a
 *   declared list, so the next `@example` is covered on the day it is authored.
 *
 * .why INTEGRATION = it reads the filesystem
 *   (`rule.forbid.unit.remote-boundaries`).
 */
const SRC = join(__dirname);

/**
 * .what = every non-test source file under `src/`, recursively
 * .why = a test file's own `@example` is a fixture rather than an advertisement,
 *        and a snapshot is generated output — neither is a sample a reader copies.
 */
const getAllSourcePaths = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === '__snapshots__' ? [] : getAllSourcePaths(path);
    if (!entry.name.endsWith('.ts')) return [];
    if (entry.name.includes('.test.')) return [];
    return [path];
  });

/**
 * .what = casts a source path into the SYMBOL a `given` label would name it by
 * .why = a label names the symbol, never the file — `asLambdaEvent.fromSqs.ts` is
 *        titled *"the fromSqs docblock"*, so the match needs the last dotted
 *        segment of the basename.
 *
 * @example `/src/domain.operations/asLambdaEvent/asLambdaEvent.fromSqs.ts` → `fromSqs`
 * @example `/src/domain.operations/askLambdaEndpoint/askLambdaEndpoint.ts` → `askLambdaEndpoint`
 */
const asAdvertisedSymbol = (path: string): string =>
  path.split('/').pop()!.replace(/\.ts$/, '').split('.').pop()!;

/**
 * .what = reads the text of every `given(...)` label out of a test source
 * .why = the coverage sweep matches an advertised symbol against the LABELS a
 *        runner declares, never against the whole file — an import line names
 *        the symbol too, so a whole-file search passes while the gap is live.
 *
 *  ⚠️ the regex tolerates the newline prettier inserts after `given(` when the
 *     label is long, which is why it is `\s*\n?\s*` rather than `\s*`.
 *
 * @example `given('[case1] the shipped source tree', () => {` → `[case1] the shipped source tree`
 */
const getAllGivenLabels = (text: string): string[] =>
  [...text.matchAll(/given\(\s*\n?\s*'([^']*)'/g)].map((match) => match[1]!);

describe('advertisedExamples.coverage', () => {
  given('[case1] the shipped source tree', () => {
    when('[t0] every file that carries an `@example` is collected', () => {
      then('each one is named by a case in advertisedExamples.test.ts', () => {
        // scoped to the `given` LABELS — `getAllGivenLabels` carries why
        const labels = getAllGivenLabels(
          readFileSync(join(SRC, 'advertisedExamples.test.ts'), 'utf8'),
        );

        const advertisers = getAllSourcePaths(SRC)
          .filter((path) => readFileSync(path, 'utf8').includes('@example'))
          .map(asAdvertisedSymbol);

        const uncovered = advertisers.filter(
          (name) => !labels.some((label) => label.includes(name)),
        );

        expect(uncovered).toEqual([]);
      });

      then('the sweep found some advertisers, so it is not vacuous', () => {
        // 🔴 a filter that matches naught passes the clamp above trivially. this
        //    is the bite check on the instrument itself — without it, a broken
        //    walk reads exactly like a clean tree
        //    (`rule.require.clamp-edge-cases`: prove the clamp bites).
        const advertisers = getAllSourcePaths(SRC).filter((path) =>
          readFileSync(path, 'utf8').includes('@example'),
        );

        expect(advertisers.length).toBeGreaterThan(5);
      });
    });
  });

  /**
   * 🔴 the README. its fences carry ellipses and free variables, so they cannot
   * EXECUTE — and an un-swept surface is not a small risk merely because the
   * sweep is hard.
   *
   * ⇒ what CAN be checked mechanically is checked here: every package symbol the
   *   readme advertises must actually be exported. that catches the drift class
   *   a rename produces, which is the one a reader cannot detect.
   */
  given('[case2] the readme', () => {
    when('[t0] every package symbol it names is collected', () => {
      then('each one is a real export of the barrel', async () => {
        const readme = readFileSync(join(SRC, '..', 'readme.md'), 'utf8');
        const barrel: Record<string, unknown> = await import('./index');

        // this repo's own verb prefixes (`rule.require.get-set-gen-verbs`), so a
        // foreign symbol like `createStandardHandler` is correctly out of scope
        //
        // 🟡 the INVERSE trap, and it has fired: a CONSUMER-side function in an
        //    example fence — `genSurfLesson(event.surfer)` — carries one of these
        //    prefixes and is caught here. that is the clamp right, never a false
        //    positive: every other `gen*` in the readme IS an export, so a reader
        //    takes this one for an export too.
        //
        //  ⇒ the fix is to RENAME it in the readme to a verb this repo does not
        //    claim (`bookSurfLesson`), never to exempt it. an exemption list would
        //    blunt the clamp for every rename drift it exists to catch.
        const named = [
          ...new Set(readme.match(/\b(?:as|is|gen|run|ask)[A-Z]\w*/g) ?? []),
        ];

        const absent = named.filter((name) => !(name in barrel));

        expect(absent).toEqual([]);
      });

      then('the sweep named some symbols, so it is not vacuous', () => {
        // 🔴 the bite check on THIS sweep. `[t0]` asserts an empty `absent` list,
        //    which an empty `named` list satisfies trivially — so a readme moved,
        //    renamed, or a regex that stopped to match would read as a clean pass.
        const readme = readFileSync(join(SRC, '..', 'readme.md'), 'utf8');
        const named = [
          ...new Set(readme.match(/\b(?:as|is|gen|run|ask)[A-Z]\w*/g) ?? []),
        ];

        expect(named.length).toBeGreaterThan(3);
      });
    });
  });
});
