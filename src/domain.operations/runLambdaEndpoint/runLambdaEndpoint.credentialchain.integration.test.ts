import { given, then, when } from 'test-fns';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  asCodeWithoutComments,
  getAllReachableSources,
} from '../../__test_assets__/getAllReachableSources';
import { getAllSourcesInTree } from '../../__test_assets__/getAllSourcesInTree';
import { getIsSlugComputer } from '../../__test_assets__/getIsSlugComputer';

/**
 * .what = pins case=9's `[t3]` — the test path and the runtime path share ONE
 *         invoke, so they cannot disagree about credentials or about the slug
 * .why = the incumbent reaches aws through aws-sdk **v2**, which reads no sso
 *        profile, so it falls back to IMDS and hangs — **90s per invoke**,
 *        measured on `ahbode/svc-home-services` PR #30 (radio #20). the fix is
 *        that `at: 'cloud'` delegates wholesale to `askLambdaEndpoint`, so the
 *        test invoke inherits the v3 chain the runtime invoke already uses.
 *
 * ⚠️ **that guarantee is structural, so its absence is INVISIBLE to a behavior
 *    test.** an inlined invoke returns the identical value on every green path
 *    and reintroduces the hang — and no assertion in this repo goes red, because
 *    the hang needs a real sso profile and this host has none.
 *
 * .note = the siblings `[t0]`–`[t2]` each need real credentials, so they land at
 *   `5.3.verification` in cicd. `[t3]` needs none, so it is owed here.
 */
describe('[case9] the cloud invoke path is unforked', () => {
  const ROOT = join(__dirname, '../../..');
  const AT_ON_SERIALIZED = join(
    ROOT,
    'src/domain.operations/runLambdaEndpoint/runLambdaEndpoint.onSerialized.ts',
  );

  given('the serialized boundary reaches aws on the cloud locus', () => {
    when('[t3] the module graph reachable from it is inspected', () => {
      then('onSerialized constructs no aws client of its OWN', () => {
        // comments are dropped first — that file's own docblock names
        // `LambdaClient` to state what it does not build
        const code = asCodeWithoutComments(
          readFileSync(AT_ON_SERIALIZED, 'utf8'),
        );
        expect(/new\s+LambdaClient\s*\(/.test(code)).toEqual(false);
        expect(/new\s+InvokeCommand\s*\(/.test(code)).toEqual(false);
      });

      then('it delegates the cloud locus to askLambdaEndpoint', () => {
        // the positive half — absent it, a branch that simply threw would pass
        // the negative check above
        const code = asCodeWithoutComments(
          readFileSync(AT_ON_SERIALIZED, 'utf8'),
        );
        expect(code).toContain('askLambdaEndpoint');
      });

      then('exactly ONE module in the graph constructs a LambdaClient', () => {
        // 🔴 the broad claim. the two checks above grade `onSerialized.ts`
        //    alone; an inlined invoke could land in any module the family pulls
        //    in and both stay green.
        //
        //    ⇒ ONE constructor means ONE credential chain.
        const builders = getAllReachableSources({
          from: join(__dirname, 'runLambdaEndpoint.ts'),
        }).filter((path) =>
          /new\s+LambdaClient\s*\(/.test(
            asCodeWithoutComments(readFileSync(path, 'utf8')),
          ),
        );

        expect(builders.map((path) => path.replace(`${ROOT}/`, ''))).toEqual([
          'src/access/sdks/lambda/genLambdaSdk.ts',
        ]);
      });

      then(
        'exactly ONE module in the graph constructs an InvokeCommand',
        () => {
          // the client is HOW it authenticates, the command is WHAT it
          // addresses. a fork of either re-opens case=9.
          const invokers = getAllReachableSources({
            from: join(__dirname, 'runLambdaEndpoint.ts'),
          }).filter((path) =>
            /new\s+InvokeCommand\s*\(/.test(
              asCodeWithoutComments(readFileSync(path, 'utf8')),
            ),
          );

          expect(invokers.map((path) => path.replace(`${ROOT}/`, ''))).toEqual([
            'src/access/sdks/lambda/sdkLambdaInvoke.ts',
          ]);
        },
      );

      then('exactly ONE module in the graph computes the slug', () => {
        // 🔴 `{service}-{access}-{function}` is written in exactly one place. a
        //    second writer is a second opinion about what a lambda is CALLED,
        //    and the two agree until an access tier or service prefix changes —
        //    the drift radio #20 names in the incumbent.
        //
        //    `getIsSlugComputer` matches the INTENT across every syntax that
        //    expresses it; its docblock carries the why.
        const computers = getAllReachableSources({
          from: join(__dirname, 'runLambdaEndpoint.ts'),
        }).filter((path) =>
          getIsSlugComputer({
            code: asCodeWithoutComments(readFileSync(path, 'utf8')),
          }),
        );

        expect(computers.map((path) => path.replace(`${ROOT}/`, ''))).toEqual([
          'src/domain.operations/asLambdaEndpoint/asLambdaEndpoint.ts',
        ]);
      });

      then('the walk actually reached the graph — the guard has teeth', () => {
        // a walk that reached zero modules makes every check above pass
        // vacuously (`rule.forbid.failhide`)
        const reached = getAllReachableSources({
          from: join(__dirname, 'runLambdaEndpoint.ts'),
        });
        expect(
          reached.some((path) => path.endsWith('askLambdaEndpoint.ts')),
        ).toEqual(true);
        expect(reached.length).toBeGreaterThan(10);
      });
    });

    when('[t4] the WHOLE tree is inspected, never merely the graph', () => {
      /**
       * .what = the same one-builder claim, over `src/` entire
       * .why = **`[t3]` cannot see a peer module.** it walks imports from
       *        `runLambdaEndpoint.ts`, so a module that forks the boundary and
       *        is reached from OUTSIDE that graph never enters the list — and an
       *        offender check over a list that omits the offender passes.
       *
       * ⚠️ the fork this catches is a real one: a `__test_assets__` fixture that
       *    built its own `LambdaClient`, so a real test invoked a real lambda
       *    through a credential chain the sdk did not own, while `[t3]` stayed
       *    green because no module in its graph imports that file.
       *
       * .note = a `.test.ts` may legitimately construct a client, so the tree
       *   check grades non-test sources. the carve-out is narrow ON PURPOSE — a
       *   `__test_assets__` module is shared fixture code that real tests invoke,
       *   so it is graded, and it is where the fork was found.
       */
      const getAllForkers = (pattern: RegExp): string[] =>
        getAllSourcesInTree({ from: join(ROOT, 'src') })
          .filter((path) => !path.endsWith('.test.ts'))
          .filter((path) =>
            pattern.test(asCodeWithoutComments(readFileSync(path, 'utf8'))),
          )
          .map((path) => path.replace(`${ROOT}/`, ''));

      then('exactly ONE non-test module in src builds a LambdaClient', () => {
        expect(getAllForkers(/new\s+LambdaClient\s*\(/)).toEqual([
          'src/access/sdks/lambda/genLambdaSdk.ts',
        ]);
      });

      then('exactly ONE non-test module in src builds an InvokeCommand', () => {
        expect(getAllForkers(/new\s+InvokeCommand\s*\(/)).toEqual([
          'src/access/sdks/lambda/sdkLambdaInvoke.ts',
        ]);
      });

      then('no NEW module in src speaks the slug convention', () => {
        /**
         * the third fork axis, at the same repo-wide bar. a module that
         * assembles or re-parses `{service}-{access}-{function}` by hand is a
         * second opinion about what a lambda is CALLED, wherever it lives.
         *
         * ⚠️ **an exact list, never a `>= 1` count.** an allowlist that merely
         *    tolerated the owner goes green on a SECOND writer, which is the
         *    failure this bars — and it keeps a REPAIR as legible as a
         *    regression, since either turns it red and names the file.
         */
        const speakers = getAllSourcesInTree({ from: join(ROOT, 'src') })
          .filter((path) => !path.endsWith('.test.ts'))
          .filter((path) =>
            getIsSlugComputer({
              code: asCodeWithoutComments(readFileSync(path, 'utf8')),
            }),
          )
          .map((path) => path.replace(`${ROOT}/`, ''));

        expect(speakers).toEqual([
          // the one canonical owner — the only writer of the slug shape
          'src/domain.operations/asLambdaEndpoint/asLambdaEndpoint.ts',
        ]);
      });

      then('the tree walk actually reached the tree — teeth, again', () => {
        // a walk that returned `[]` makes all three checks above pass over an
        // empty repo
        const sources = getAllSourcesInTree({ from: join(ROOT, 'src') });
        expect(
          sources.some((path) => path.endsWith('genLambdaSdk.ts')),
        ).toEqual(true);
        expect(
          sources.some((path) => path.endsWith('askLambdaEndpointAncient.ts')),
        ).toEqual(true);
        expect(sources.length).toBeGreaterThan(50);
      });
    });
  });
});
