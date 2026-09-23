import { readdir, readFile } from 'fs/promises';
import { join, relative, sep } from 'path';
import { given, then, when } from 'test-fns';

/**
 * .what = clamp the ONE-DOOR invariant: exactly one prod call site reaches
 *         `z.toJSONSchema`, it is `getJsonSchemaFromZod`, and it passes `{ io: 'input' }`
 *
 * .why = `{ io: 'input' }` is the repair that keeps `getAllLambdaContracts` alive for the whole
 *        service. zod's default is `io: 'output'`, which THROWS
 *        `Transforms cannot be represented in JSON Schema` for every `X.contract()` position —
 *        and `X.contract()` always coerces on `domain-objects@0.34.0`. so a SECOND prod call
 *        site, added without the flag, silently reintroduces a service-wide introspection crash
 *
 * .why a test rather than a note = the invariant was verified by a one-time grep and carried in
 *        a doc-comment at the door itself. a comment cannot go red. `F36` recorded that gap;
 *        this closes it — the invariant now fails a run rather than a reader's memory
 *
 * .why integration = it reads the `src/` tree off disk, a remote boundary
 *        (`rule.forbid.unit.remote-boundaries`)
 *
 * .note = a call site is matched by the PAREN form, `toJSONSchema(`. every prose mention in
 *         this repo writes the bare name with no paren, so prose does not match — and a doc that
 *         ever did write the paren form grades RED, which is the safe direction to fail
 *
 * .why a shared promise rather than `useThen` = measured — `useThen`'s proxy re-reads a string
 *        subject as a char-indexed object, so `toMatch` and `toContain` both break on it. a
 *        promise awaited N times runs its executor ONCE, which is the guarantee
 *        `rule.forbid.redundant-expensive-operations` asks for, at no ceremony
 */

/** the door itself — the one prod call site this invariant permits */
const PATH_OF_THE_ONE_DOOR =
  'domain.operations/genLambdaEndpoint/middleware/genIntrospectionMiddleware.getJsonSchemaFromZod.ts';

/** where the walk starts: `src/`, three levels up from this file */
const PATH_OF_SRC_ROOT = join(__dirname, '..', '..', '..');

/** a call site, never a prose mention — see the `.note` above. GLOBAL, so it also counts */
const PATTERN_OF_CALL_SITE = /toJSONSchema\s*\(/g;

/**
 * .what = one option, asserted inside the door's `toJSONSchema` options object
 * .why = an earlier form demanded the object hold `io` and CLOSE — `\{\s*io:\s*'input'\s*\}`.
 *        that graded the option LIST rather than the option, so it went red the moment a
 *        second option was added for an unrelated guarantee. these are order-independent and
 *        each grades exactly one key
 *
 * .note = `[^}]*` is a precise bound rather than a lazy `[\s\S]*?`, because the door's options
 *         object holds no nested brace — so the scan cannot run past the call it belongs to.
 *         and the anchor is the PAREN form, so no prose mention can satisfy it
 */
const asPatternOfOption = (option: string): RegExp =>
  new RegExp(`toJSONSchema\\(\\s*schema,\\s*\\{[^}]*${option}`);

/** the wire face — the repair that keeps `getAllLambdaContracts` alive service-wide */
const PATTERN_OF_FACE = asPatternOfOption(`io:\\s*'input'`);

/** the half that DISARMS zod's refusal, for every un-renderable kind at once */
const PATTERN_OF_FLAG = asPatternOfOption(`unrepresentable:\\s*'any'`);

/** the half that RE-ARMS it, for every kind but the two that have an honest render */
const PATTERN_OF_OVERRIDE = asPatternOfOption(`override:`);

/** every `.ts` file under a root, absolute */
const getAllTypescriptPathsAbsolute = async (input: {
  root: string;
}): Promise<string[]> => {
  const entries = await readdir(input.root, { withFileTypes: true });
  const branches = await Promise.all(
    entries.map(async (entry) => {
      const absolute = join(input.root, entry.name);
      if (entry.isDirectory())
        return getAllTypescriptPathsAbsolute({ root: absolute });
      if (entry.name.endsWith('.ts')) return [absolute];
      return [];
    }),
  );
  return branches.flat();
};

/**
 * .what = every `.ts` file under `src/`, as a path relative to `src/`
 * .why = the corpus the invariant is stated over; a walk that reached a subset would report a
 *        false zero, so the positive control below proves this walk reaches test files too
 *
 * .note = the relativize happens ONCE, here — a relativize inside the recursion would fire at
 *         every level and mangle the path (measured: it produced repo-root-relative paths that
 *         then failed to open)
 */
const getAllTypescriptPaths = async (input: {
  root: string;
}): Promise<string[]> =>
  (await getAllTypescriptPathsAbsolute(input)).map((absolute) =>
    relative(PATH_OF_SRC_ROOT, absolute).split(sep).join('/'),
  );

/** how many times a text actually CALLS it */
const getCountOfCallSites = (input: { text: string }): number =>
  input.text.match(PATTERN_OF_CALL_SITE)?.length ?? 0;

/** a test file, by this repo's own suffixes */
const isPathOfTestFile = (path: string): boolean =>
  path.endsWith('.test.ts') || path.includes('__test_assets__/');

describe('the one door to z.toJSONSchema', () => {
  given('[case1] the whole `src/` tree, read off disk', () => {
    // one construction, awaited by every row below
    const scan = (async () => {
      const paths = await getAllTypescriptPaths({ root: PATH_OF_SRC_ROOT });
      const hits = await Promise.all(
        paths.map(async (path) => {
          const text = await readFile(join(PATH_OF_SRC_ROOT, path), 'utf8');
          return getCountOfCallSites({ text }) > 0 ? path : null;
        }),
      );
      const callSites = hits.filter((path): path is string => path !== null);
      return {
        paths,
        callSites,
        callSitesOfProd: callSites.filter((path) => !isPathOfTestFile(path)),
      };
    })();

    when('[t0] the walk itself is graded, before any claim rests on it', () => {
      /**
       * .why = a ZERO from a broken walk reads exactly like a real absence
       *        (`rule.require.positive-control-before-absence-claims`). these two rows prove the
       *        scanner reaches the tree AND fires on more than one file, so the filtered count
       *        below is a result rather than an artifact
       */
      then('it reached a real corpus of typescript files', async () => {
        expect((await scan).paths.length).toBeGreaterThan(50);
      });

      then(
        'it fires on MORE than one file before the prod filter',
        async () => {
          expect((await scan).callSites.length).toBeGreaterThan(1);
        },
      );
    });

    when('[t1] the test files are excluded', () => {
      then('exactly ONE prod call site remains', async () => {
        expect((await scan).callSitesOfProd).toEqual([PATH_OF_THE_ONE_DOOR]);
      });
    });

    when('[t2] that one call site is read', () => {
      const door = readFile(
        join(PATH_OF_SRC_ROOT, PATH_OF_THE_ONE_DOOR),
        'utf8',
      );

      then("it passes `{ io: 'input' }`", async () => {
        expect(await door).toMatch(PATTERN_OF_FACE);
      });

      /**
       * ⚠️ .why these two rows exist = the door renders an ABSENT position (`z.undefined()` /
       *    `z.void()`) as `{ not: {} }` rather than a throw, and that repair is TWO options
       *    that are each useless alone:
       *
       *      unrepresentable: 'any'  -> disarms zod's refusal for EVERY un-renderable kind
       *      override                -> re-arms it for every kind but the two that render
       *
       *    drop the override and the flag alone silences `date`, `bigint`, `symbol`, `map`
       *    and `custom` to `{}` — a rubber-stamp a caller cannot tell from an open position
       *    (rule.forbid.failhide). drop the flag and the override never runs at all, because
       *    zod throws before it returns. so the PAIR is the guarantee, and each half is
       *    clamped here rather than left to a reader's memory of why the other is there
       *
       * .the bite = delete either option from the door and its own row goes red, while `[t1]`
       *    and the face row stay green — so the failure names WHICH half was lost
       */
      then(
        "it passes `unrepresentable: 'any'` — the half that DISARMS",
        async () => {
          expect(await door).toMatch(PATTERN_OF_FLAG);
        },
      );

      then('it passes an `override` — the half that RE-ARMS', async () => {
        expect(await door).toMatch(PATTERN_OF_OVERRIDE);
      });

      then(
        'it passes that face UNCONDITIONALLY — the door CALLS it exactly once',
        async () => {
          /**
           * .why a COUNT rather than a `not.toContain("io: 'output'")` = the door's own doc
           *      names the discarded face at length, on purpose — that prose is the record of
           *      the trade. so a text search grades the documentation, never the code. a second
           *      CALL is what a per-schema branch would need, and two calls for one guarantee is
           *      `rule.forbid.parallel-codepaths`
           */
          expect(getCountOfCallSites({ text: await door })).toEqual(1);
        },
      );
    });
  });
});
