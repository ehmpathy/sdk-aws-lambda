import { genTempDir, given, then, when } from 'test-fns';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAllReachableSources } from './getAllReachableSources';

/**
 * .what = the peer test for the module walker
 * .why = 🔴 the walker is the substrate under BOTH structural guards —
 *        jest-free and credential-chain — and its defects are invisible to them
 *        BY CONSTRUCTION: a walker that drops a module makes both read a SHORTER
 *        list, find no offender, and pass green. the guards cannot grade their
 *        own instrument.
 *
 * ⚠️ this cannot catch a fifth syntax nobody has thought of. it clamps the four
 *    that ARE known, so a refactor of the matcher cannot silently drop one.
 *
 * 🟡 INTEGRATION because it writes and reads real files
 *    (rule.forbid.unit.remote-boundaries).
 */
describe('getAllReachableSources', () => {
  given('[case1] a module graph that uses all four import syntaxes', () => {
    /**
     * .what = writes a root that reaches four leaves, one per syntax
     * .why = one fixture grades all four at once, so a matcher that drops any
     *        one of them fails on a NAMED file rather than on a count.
     */
    const genGraph = (): string => {
      const at = genTempDir({ slug: 'reachable-sources' });

      writeFileSync(
        join(at, 'root.ts'),
        [
          // a package the walk must NOT follow — a bare specifier is not our graph
          `import { z } from 'zod';`,
          `import { a } from './leafFrom';`, //          1. the from clause
          `const b = require('./leafRequire');`, //      2. require()
          `import './leafBare';`, //                     3. bare side-effect
          `const c = await import('./leafDynamic');`, // 4. dynamic import
          `export const use = [z, a, b, c];`,
        ].join('\n'),
        'utf8',
      );

      for (const leaf of ['leafFrom', 'leafRequire', 'leafBare', 'leafDynamic'])
        writeFileSync(join(at, `${leaf}.ts`), `export const x = 1;\n`, 'utf8');

      return at;
    };

    when('[t0] the walk runs from the root', () => {
      then('it reaches the leaf behind EVERY syntax', () => {
        const at = genGraph();
        const reached = getAllReachableSources({
          from: join(at, 'root.ts'),
        }).map((path) => path.replace(`${at}/`, ''));

        // 🔴 asserted per-syntax, never as a count. a count tells you that one
        //    is absent; the name tells you WHICH — and "which" is the whole
        //    diagnosis, since each syntax is a separate line in the matcher.
        expect(reached).toContain('leafFrom.ts'); //    from './y'
        expect(reached).toContain('leafRequire.ts'); // require('./y')
        expect(reached).toContain('leafBare.ts'); //    import './y'
        expect(reached).toContain('leafDynamic.ts'); // import('./y')
      });

      then('it includes the root it started from', () => {
        const at = genGraph();
        const reached = getAllReachableSources({
          from: join(at, 'root.ts'),
        }).map((path) => path.replace(`${at}/`, ''));

        expect(reached).toContain('root.ts');
      });

      then('it does NOT follow a bare package specifier', () => {
        // the walk keeps to `.`-prefixed paths on purpose — `zod` is a package,
        // not our graph. a matcher that dropped the `\.` anchor would try to
        // resolve `zod.ts` beside the root and silently widen every guard.
        const at = genGraph();
        const reached = getAllReachableSources({ from: join(at, 'root.ts') });

        expect(reached.some((path) => path.includes('zod'))).toEqual(false);
      });
    });
  });

  given('[case2] a graph with a cycle', () => {
    // the walk carries a `seen` set. absent it, a cycle hangs the guard rather
    // than fails it — and a hung guard is worse than a red one, because a
    // timeout reads as flake.
    when('[t0] two modules import each other', () => {
      then('the walk terminates and reports both once', () => {
        const at = genTempDir({ slug: 'reachable-sources-cycle' });
        writeFileSync(
          join(at, 'a.ts'),
          `import './b';\nexport const a = 1;\n`,
          'utf8',
        );
        writeFileSync(
          join(at, 'b.ts'),
          `import './a';\nexport const b = 1;\n`,
          'utf8',
        );

        const reached = getAllReachableSources({ from: join(at, 'a.ts') }).map(
          (path) => path.replace(`${at}/`, ''),
        );

        expect(reached.sort()).toEqual(['a.ts', 'b.ts']);
      });
    });
  });
});
