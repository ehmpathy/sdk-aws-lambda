import { readFileSync } from 'node:fs';
import { resolve as asAbsolutePath, dirname, join } from 'node:path';

/**
 * .what = walks the import graph reachable from an entrypoint, returns each path
 * .why = a structural guard that greps ONE file grades that file, never the
 *        module graph it pulls in. a forbidden import one hop away is as fatal
 *        as one in the entrypoint itself, and a single-file grep cannot see it.
 *
 * .note = shared by TWO structural guards — jest-free and credential-chain.
 *   two hand-maintained copies would drift, and the drift makes a guard
 *   SILENTLY weaker rather than red: a shorter graph still returns a list, and
 *   an offender check over a short list passes.
 */
export const getAllReachableSources = (input: { from: string }): string[] => {
  /**
   * .note = DELIBERATE MUTATION ZONE (rule.require.immutable-vars, the scoped
   *   exception). a graph walk has no pure fold form — the work list GROWS as
   *   the walk reads each file, so the collection is not known until the fold
   *   ends. the mutation is confined to this body and escapes through one
   *   return of a fresh array.
   */
  const seen = new Set<string>(); // candidates tried — saves a re-resolve
  const reported = new Set<string>(); // files pushed — keeps the list unique
  const queue = [input.from];
  const sources: string[] = [];

  while (queue.length) {
    const at = queue.pop()!;
    if (seen.has(at)) continue;
    seen.add(at);

    const source = (() => {
      for (const candidate of [at, `${at}.ts`, join(at, 'index.ts')]) {
        try {
          return { path: candidate, text: readFileSync(candidate, 'utf8') };
        } catch (error) {
          /**
           * .what = tolerates only the three codes that mean "wrong candidate
           *         shape", and rethrows each other read fault
           * .why = a bare `catch {}` swallows every error class, so a permission
           *   denial or an i/o fault SHRINKS the graph — and a shorter graph
           *   still satisfies every assertion made over it (rule.forbid.failhide).
           *
           * 🟡 the anti-vacuous clamps catch a TOTAL collapse, never a partial
           *    one, which is why a narrow catch is the repair.
           */
          const code = (error as { code?: unknown })?.code;
          const isWrongShape =
            code === 'ENOENT' || // no such candidate
            code === 'ENOTDIR' || // `at/index.ts` where `at` is a file
            code === 'EISDIR'; // bare `at` where `at` is a directory
          if (!isWrongShape) throw error;
        }
      }
      return null;
    })();
    if (!source) continue;

    /**
     * .what = dedupes on the RESOLVED path, not merely the candidate
     * .why = `seen` is keyed on the specifier AS WRITTEN, and one file is
     *   reachable under several spellings (`./a`, `./a.ts`, `./a/index`) — so a
     *   second spelling misses `seen`, resolves to the same file, and reports
     *   it twice. the walk still terminates, so the defect is a duplicate.
     *
     * ⚠️ it needs its OWN set. `seen.add(at)` runs BEFORE resolution, so where
     *    the candidate already IS the resolved path a re-use of `seen` reports a
     *    hit on the module's own first visit and skips it.
     */
    if (reported.has(source.path)) continue;
    reported.add(source.path);

    sources.push(source.path);

    for (const specifier of getAllRelativeSpecifiers(source.text))
      queue.push(asAbsolutePath(dirname(source.path), specifier));
  }

  return sources;
};

/**
 * .what = reads every relative import specifier out of a source, in all FOUR
 *         syntaxes
 * .why = a bare specifier is a package rather than our graph, so the walk keeps
 *        to `.`-prefixed paths — but it must catch each way one is written,
 *        never only the `from` clause.
 *
 * 🔴 a `from`-only matcher is a SILENT TRUNCATION: a contributor who adds
 *    `require('./x')`, a side-effect `import './x'`, or `await import('./x')`
 *    has that module dropped from the walk — the offender check reads a shorter
 *    list, finds none, and stays green while the graph gained a forbidden edge.
 *
 * ⚠️ the dynamic form is not hypothetical. F4 weighs a lazy load to keep `yaml`
 *    off the production path, which takes exactly that shape — and would drop
 *    the whole local-locus subtree out of both guards.
 */
const getAllRelativeSpecifiers = (text: string): string[] =>
  [
    ...text.matchAll(/from\s+['"](\.[^'"]+)['"]/g), // import x from './y'
    ...text.matchAll(/require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g), // require('./y')
    ...text.matchAll(/import\s+['"](\.[^'"]+)['"]/g), // import './y'
    ...text.matchAll(/import\s*\(\s*['"](\.[^'"]+)['"]/g), // await import('./y')
  ].map((match) => match[1]!);

/**
 * .what = drops comments, so a scan grades CODE rather than prose
 * .why = 🔴 a doc comment that explains WHY a construct must stay in one place
 *        will name that construct to do so. a scan that matched it would flag
 *        the very file that documents the boundary — caught by the jest-free
 *        guard's own first run, and it bites the credential-chain guard too:
 *        `onSerialized`'s docblock names `LambdaClient` to explain what it does
 *        NOT construct.
 */
export const asCodeWithoutComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
