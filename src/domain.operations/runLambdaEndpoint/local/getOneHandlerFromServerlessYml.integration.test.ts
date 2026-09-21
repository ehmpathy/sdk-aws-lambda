import { ConstraintError } from 'helpful-errors';
import { genTempDir, getError, given, then, when } from 'test-fns';

import { appendFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join, parse } from 'node:path';
import { getOneHandlerFromServerlessYml } from './getOneHandlerFromServerlessYml';

/**
 * .what = the peer test for the local lookup
 * .why = the module's own docblock claims, in red, that **every failure names the
 *        fix**. that is a universal claim, so every throw path owes a clamp:
 *
 *        | # | the failure | its clamp |
 *        |---|---|---|
 *        | 1 | no project root — no package.json in any ancestor | [case5] |
 *        | 2 | no serverless.yml at the root | [case1] |
 *        | 3 | the yml declares a different service | case=10 [t1] |
 *        | 4 | the yml declares no such function | case=10 [t2] |
 *        | 5 | the handler string is malformed | [case2] |
 *        | 6 | the handler FILE does not exist | case=10 [t0] |
 *        | 7 | the file exists and exports no such name | [case3] |
 *        | 8 | the file is found and the import itself fails | [case6] |
 *
 * 🟡 it is an INTEGRATION test because it reads the filesystem
 *    (`rule.forbid.unit.remote-boundaries`).
 */
describe('getOneHandlerFromServerlessYml', () => {
  given('[case1] a project root with no serverless.yml at all', () => {
    // a repo that deploys by some other mechanism has no serverless.yml, so
    // `at: 'local'` has naught to read — and must say so.
    when('[t0] the lookup runs', () => {
      then('the error names the sought path AND the way out', async () => {
        const dir = genTempDir({ slug: 'serverless-yml-absent' });
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 't' }));

        const error = await getError(
          getOneHandlerFromServerlessYml({
            service: 'svc-surf',
            function: 'getWaveByUuid',
            from: dir,
          }),
        );

        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('no serverless.yml found');

        // the fix, not merely the symptom (rule.require.errors-name-the-fix)
        const serialized = JSON.stringify(error);
        expect(serialized).toContain('serverless.yml');
        expect(serialized).toContain("at: 'cloud'");

        expect({
          messageNamesAbsence: error.message.includes(
            'no serverless.yml found',
          ),
          namesServerlessYml: serialized.includes('serverless.yml'),
          namesCloudFix: serialized.includes("at: 'cloud'"),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case2] a serverless.yml whose handler string is malformed', () => {
    // `path/to/file.exportName` is the only shape the regex admits. a yml that
    // drops the export half lands here.
    when('[t0] the lookup runs', () => {
      then(
        'the error shows what it found, so the typo is visible',
        async () => {
          const dir = genTempDir({ slug: 'serverless-yml-malformed' });
          writeFileSync(
            join(dir, 'package.json'),
            JSON.stringify({ name: 't' }),
          );
          writeFileSync(
            join(dir, 'serverless.yml'),
            [
              'service: svc-surf',
              'functions:',
              '  getWaveByUuid:',
              '    handler: handler', // ← no `.exportName`
            ].join('\n'),
          );

          const error = await getError(
            getOneHandlerFromServerlessYml({
              service: 'svc-surf',
              function: 'getWaveByUuid',
              from: dir,
            }),
          );

          expect(error).toBeInstanceOf(ConstraintError);
          expect(error.message).toContain('malformed');
          expect(error.message).toContain('path/to/file.exportName');
          expect(JSON.stringify(error)).toContain('handler');

          expect({
            messageNamesMalformed: error.message.includes('malformed'),
            namesExpectedShape: error.message.includes(
              'path/to/file.exportName',
            ),
          }).toMatchSnapshot();
        },
      );
    });
  });

  given(
    '[case3] a handler file that exists and exports a different name',
    () => {
      // case=10 covers a stale handler PATH; this covers a right path and a stale
      // export NAME — a rename with no edit to the yml.
      when('[t0] the lookup runs', () => {
        then('the error lists what the file DOES export', async () => {
          const dir = genTempDir({ slug: 'serverless-yml-export-stale' });
          writeFileSync(
            join(dir, 'package.json'),
            JSON.stringify({ name: 't' }),
          );
          writeFileSync(
            join(dir, 'serverless.yml'),
            [
              'service: svc-surf',
              'functions:',
              '  getWaveByUuid:',
              '    handler: handler.getWaveByUuid',
            ].join('\n'),
          );
          // the file is present; the export was renamed and the yml was not
          writeFileSync(
            join(dir, 'handler.js'),
            'exports.getWaveByUuidV2 = async () => ({ found: true });',
          );

          const error = await getError(
            getOneHandlerFromServerlessYml({
              service: 'svc-surf',
              function: 'getWaveByUuid',
              from: dir,
            }),
          );

          expect(error).toBeInstanceOf(ConstraintError);
          expect(error.message).toContain('exports no such function');

          // the `found` list turns a dead end into a one-step fix
          const serialized = JSON.stringify(error);
          expect(serialized).toContain('getWaveByUuidV2');
          expect(serialized).toContain('getWaveByUuid');

          expect({
            messageNamesStaleExport: error.message.includes(
              'exports no such function',
            ),
            listsRealExport: serialized.includes('getWaveByUuidV2'),
          }).toMatchSnapshot();
        });
      });
    },
  );

  given('[case4] a serverless.yml that names a live handler', () => {
    // the happy path, so the three cases above are known to fail for their own
    // reason rather than because the lookup never worked at all.
    when('[t0] the lookup runs', () => {
      then('it hands back the exported function', async () => {
        const dir = genTempDir({ slug: 'serverless-yml-found' });
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 't' }));
        writeFileSync(
          join(dir, 'serverless.yml'),
          [
            'service: svc-surf',
            'functions:',
            '  getWaveByUuid:',
            '    handler: handler.getWaveByUuid',
          ].join('\n'),
        );
        writeFileSync(
          join(dir, 'handler.js'),
          'exports.getWaveByUuid = async () => ({ found: true });',
        );

        const handler = await getOneHandlerFromServerlessYml({
          service: 'svc-surf',
          function: 'getWaveByUuid',
          from: dir,
        });

        expect(typeof handler).toEqual('function');
        expect(await handler({}, {})).toEqual({ found: true });
      });
    });

    when('[t1] the root is sought from a NESTED directory', () => {
      then('it walks up to the package.json and finds the yml', async () => {
        const dir = genTempDir({ slug: 'serverless-yml-nested' });
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 't' }));
        writeFileSync(
          join(dir, 'serverless.yml'),
          [
            'service: svc-surf',
            'functions:',
            '  getWaveByUuid:',
            '    handler: handler.getWaveByUuid',
          ].join('\n'),
        );
        writeFileSync(
          join(dir, 'handler.js'),
          'exports.getWaveByUuid = async () => ({ found: true });',
        );

        // 🟡 a test runs from an arbitrary cwd, so the upward walk is what makes
        //    `at: 'local'` work at all. a regression here reads as "no
        //    serverless.yml found", which points at the wrong file entirely.
        const handler = await getOneHandlerFromServerlessYml({
          service: 'svc-surf',
          function: 'getWaveByUuid',
          from: join(dir, 'src', 'deep', 'nested'),
        });

        expect(typeof handler).toEqual('function');
      });
    });
  });

  // ⚠️ **this case cannot use `genTempDir`.** it hands back a dir inside this
  //    repo's `.temp`, so THIS repo's `package.json` is always in the ancestry
  //    and the upward walk always terminates — the one path that never finds a
  //    root is unreachable from the pavement.
  //
  //    ⇒ the filesystem ROOT is the one location with no ancestor at all, and
  //      `parse().root` reads it portably. no write, no temp dir, no cleanup
  //      (rule.require.hermetic-tests).
  given('[case5] a directory with no package.json in ANY ancestor', () => {
    when('[t0] the lookup runs from the filesystem root', () => {
      then('the error names the absent precondition', async () => {
        const error = await getError(
          getOneHandlerFromServerlessYml({
            service: 'svc-surf',
            function: 'getWaveByUuid',
            from: parse(process.cwd()).root,
          }),
        );

        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('could not find a project root');

        // it names WHAT is absent, so the reader knows which file to add
        expect(error.message).toContain('package.json');

        // and it carries the path it walked from, so the reader can check it
        expect(JSON.stringify(error)).toContain('from');

        // 🔴 and it names the FIX. every assertion above reads the SYMPTOM half,
        //    and all three stay green on a throw that carries no `hint` at all
        //    (`rule.require.errors-name-the-fix`).
        const metadata = (error as ConstraintError).metadata as {
          hint?: string;
        };
        expect(metadata.hint).toContain('from:');

        expect({
          messageNamesAbsentRoot: error.message.includes(
            'could not find a project root',
          ),
          namesAbsentFile: error.message.includes('package.json'),
          hintNamesFromPath: String(metadata.hint).includes('from:'),
        }).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = path 8 — the file is found, and the import itself fails
   * .why = the `catch` around the dynamic import has TWO exits: "Cannot find
   *        module" (path 6), and every other fault — a syntax error, a throw at
   *        module scope, a bad transitive import.
   *
   * ⚠️ **the throw must KEEP the original, never replace it.** a syntax error's
   *    own message and stack name the file and line, which IS the fix for that
   *    class — so the sdk's context goes on top and the original rides as
   *    `cause`. this clamp asserts both halves; one alone reads as done.
   */
  given('[case6] a handler file that exists but cannot be imported', () => {
    when('[t0] the module throws at import time', () => {
      then(
        'the error names the sdk context AND keeps the original',
        async () => {
          const dir = genTempDir({ slug: 'serverless-yml-import-failure' });
          writeFileSync(
            join(dir, 'package.json'),
            JSON.stringify({ name: 't' }),
          );
          writeFileSync(
            join(dir, 'serverless.yml'),
            [
              'service: svc-surf',
              'functions:',
              '  getWaveByUuid:',
              '    handler: handler.getWaveByUuid',
            ].join('\n'),
          );

          // a module that throws on load — the sdk must surface it, never bury it
          writeFileSync(
            join(dir, 'handler.js'),
            "throw new Error('the handler blew up at module scope');",
          );

          const error = await getError(
            getOneHandlerFromServerlessYml({
              service: 'svc-surf',
              function: 'getWaveByUuid',
              from: dir,
            }),
          );

          // 🔴 half one — the sdk's own context, which a bare rethrow has none of
          expect(error.message).toContain('could not be imported');
          expect(JSON.stringify(error)).toContain(
            'the fault is inside the handler',
          );

          // .note = `pathOfHandler` carries no extension — the resolver appends
          //   it — so the clamp reads the yml's own declared string, which is
          //   what the author would edit.
          expect(JSON.stringify(error)).toContain('handler.getWaveByUuid');

          // 🔴 half two — the ORIGINAL survives. a replace passes half one and
          //    buries the file and line the author needs.
          //
          //  ⚠️ read as a STRUCTURED field, never through `JSON.stringify` —
          //     `helpful-errors` omits `cause` from the serialized message
          //     (`HelpfulError.js:23-25`) and hands it to the native `Error`
          //     `cause` option, which is non-enumerable.
          expect((error as { cause?: Error }).cause?.message).toContain(
            'the handler blew up at module scope',
          );

          expect({
            messageNamesImportFailure: error.message.includes(
              'could not be imported',
            ),
            namesFaultLocation: JSON.stringify(error).includes(
              'the fault is inside the handler',
            ),
            causeNamesOriginal: Boolean(
              (error as { cause?: Error }).cause?.message.includes(
                'the handler blew up at module scope',
              ),
            ),
          }).toMatchSnapshot();
        },
      );
    });
  });

  /**
   * .what = the memo must not outlive the file it parsed
   * .why = the parse is memoized because it is ~78% of this operation's cost
   *        (8.778 ms of ~11). the key is the file's own CONTENT; the obvious
   *        alternative — `(service, function, from)` — caches a path's CONTENT
   *        under a lookup's IDENTITY.
   *
   * ⚠️ the clamp BITES, probed both ways:
   *
   *  | the key | this test |
   *  |---|---|
   *  | the content, as shipped | ✅ green |
   *  | the path alone | 🔴 `declares no such function` |
   */
  given(
    '[case7] a serverless.yml that is REWRITTEN between two lookups',
    () => {
      when('[t0] the second lookup runs against the new content', () => {
        then('it reads the new file, never the memoized parse', async () => {
          const dir = genTempDir({ slug: 'serverless-yml-rewritten' });
          writeFileSync(
            join(dir, 'package.json'),
            JSON.stringify({ name: 't' }),
          );
          writeFileSync(
            join(dir, 'handler.js'),
            [
              'exports.getWaveByUuid = async () => ({ which: "first" });',
              'exports.getSurferByUuid = async () => ({ which: "second" });',
            ].join('\n'),
          );

          const pathOfConfig = join(dir, 'serverless.yml');
          writeFileSync(
            pathOfConfig,
            [
              'service: svc-surf',
              'functions:',
              '  getWaveByUuid:',
              '    handler: handler.getWaveByUuid',
            ].join('\n'),
          );

          const before = await getOneHandlerFromServerlessYml({
            service: 'svc-surf',
            function: 'getWaveByUuid',
            from: dir,
          });
          expect(await before({}, {})).toEqual({ which: 'first' });

          // 🟡 the byte length differs here, so this case passes under a
          //    mtime+size key too. `[t2]` is the one where it does not.
          writeFileSync(
            pathOfConfig,
            [
              'service: svc-surf',
              'functions:',
              '  getSurferByUuid:',
              '    handler: handler.getSurferByUuid',
              '# a comment, so the byte length differs from the first write',
            ].join('\n'),
          );

          const after = await getOneHandlerFromServerlessYml({
            service: 'svc-surf',
            function: 'getSurferByUuid',
            from: dir,
          });
          expect(await after({}, {})).toEqual({ which: 'second' });
        });
      });

      when(
        '[t2] the rewrite keeps the SAME byte length, inside one tick',
        () => {
          /**
           * 🔴 the exact race an mtime+size key leaves open, and the reason the
           * key is the content itself: a function renamed to another of equal
           * length, written back inside one millisecond, produces a file whose
           * mtime AND size both match the memo.
           *
           * ⇒ probed both ways: content ✅ green · mtime+size 🔴 `declares no
           *   such function`.
           */
          then('it reads the new file, never the memoized parse', async () => {
            const dir = genTempDir({ slug: 'serverless-yml-same-length' });
            writeFileSync(
              join(dir, 'package.json'),
              JSON.stringify({ name: 't' }),
            );
            writeFileSync(
              join(dir, 'handler.js'),
              [
                'exports.getWaveByUuid = async () => ({ which: "first" });',
                'exports.getSurfByUuid = async () => ({ which: "second" });',
              ].join('\n'),
            );

            // 🔴 both names are 13 characters, so the two files are equal in size
            const asConfig = (fn: string): string =>
              [
                'service: svc-surf',
                'functions:',
                `  ${fn}:`,
                `    handler: handler.${fn}`,
              ].join('\n');

            // 🔴 an integer second, never a captured `Date` — `utimesSync`
            //    round-trips through a float, so a copied stamp comes back
            //    ~0.02 ms off and an `mtimeMs ===` compare would see two
            //    different files, which would make this probe prove naught.
            const AT = 1_700_000_000;

            const pathOfConfig = join(dir, 'serverless.yml');
            writeFileSync(pathOfConfig, asConfig('getWaveByUuid'));
            utimesSync(pathOfConfig, AT, AT);

            const before = await getOneHandlerFromServerlessYml({
              service: 'svc-surf',
              function: 'getWaveByUuid',
              from: dir,
            });
            expect(await before({}, {})).toEqual({ which: 'first' });

            const stampBefore = statSync(pathOfConfig);
            writeFileSync(pathOfConfig, asConfig('getSurfByUuid'));
            utimesSync(pathOfConfig, AT, AT);

            // the premise, asserted — if these ever differ, this no longer
            // probes the race it was written for
            const stampAfter = statSync(pathOfConfig);
            expect(stampAfter.size).toEqual(stampBefore.size);
            expect(stampAfter.mtimeMs).toEqual(stampBefore.mtimeMs);

            const after = await getOneHandlerFromServerlessYml({
              service: 'svc-surf',
              function: 'getSurfByUuid',
              from: dir,
            });
            expect(await after({}, {})).toEqual({ which: 'second' });
          });
        },
      );

      when('[t1] the file is UNCHANGED between two lookups', () => {
        // the anti-vacuous half — a memo that invalidated on every call passes
        // [t0] and buys naught.
        //
        // 🔴 time is the ONLY observable: a hit does `readFileSync` + `Map.get`,
        //    a miss adds `parseYaml`, and any content edit a test could observe
        //    busts the key by construction. so the clamp cannot avoid a
        //    measurement — only an ABSOLUTE one.
        then('the second lookup is served from the memo', async () => {
          const dir = genTempDir({ slug: 'serverless-yml-memo-hit' });
          writeFileSync(
            join(dir, 'package.json'),
            JSON.stringify({ name: 't' }),
          );
          writeFileSync(
            join(dir, 'handler.js'),
            'exports.getWaveByUuid = async () => ({ found: true });',
          );

          // a yml large enough that a parse dominates the call, as a real one does
          const pathOfYml = join(dir, 'serverless.yml');
          writeFileSync(
            pathOfYml,
            [
              'service: svc-surf',
              'functions:',
              ...Array.from({ length: 40 }, (_, i) =>
                [
                  `  fn${i}:`,
                  `    handler: handler.getWaveByUuid`,
                  `    timeout: 30`,
                  `    memorySize: 512`,
                ].join('\n'),
              ),
              '  getWaveByUuid:',
              '    handler: handler.getWaveByUuid',
            ].join('\n'),
          );

          const ask = () =>
            getOneHandlerFromServerlessYml({
              service: 'svc-surf',
              function: 'getWaveByUuid',
              from: dir,
            });

          const asMillisOf = async (act: () => Promise<unknown>) => {
            const began = process.hrtime.bigint();
            await act();
            return Number(process.hrtime.bigint() - began) / 1e6;
          };

          await ask(); // the first miss — pays `import('yaml')` AND the parse

          /**
           * 🔴 the bound is RELATIVE and taken as a MINIMUM
           * (`rule.forbid.time-assumptions`):
           *
           * | the flaw | the repair |
           * |---|---|
           * | an absolute bar drifts with machine load — measured to flake at 4.80 ms under `--thorough` | measure a REAL re-parse in the same test, under the same load |
           * | one sample can catch a scheduler pause | take the MIN of several |
           *
           * ✅ the miss baseline excludes `import('yaml')`, already amortized by
           *    the first call — so it prices the PARSE, the only work the memo
           *    removes.
           */
          const TRIALS = 5;

          const millisOfHit: number[] = [];
          for (let trial = 0; trial < TRIALS; trial += 1)
            millisOfHit.push(await asMillisOf(ask));

          const millisOfMiss: number[] = [];
          for (let trial = 0; trial < TRIALS; trial += 1) {
            // a fresh comment at the end busts the content key without a
            // semantic change, so each miss re-parses the very same document
            appendFileSync(pathOfYml, `\n# bust ${trial}`);
            millisOfMiss.push(await asMillisOf(ask));
          }

          const fastestHit = Math.min(...millisOfHit);
          const fastestMiss = Math.min(...millisOfMiss);

          // 🟡 a hit is ~0.004 ms and a parse ~8.8 ms, so the true ratio is
          //    ~2000×. a 4× bar leaves ~500× of headroom and still goes red the
          //    moment the parse re-runs.
          expect(fastestHit * 4).toBeLessThan(fastestMiss);
        });
      });
    },
  );
});
