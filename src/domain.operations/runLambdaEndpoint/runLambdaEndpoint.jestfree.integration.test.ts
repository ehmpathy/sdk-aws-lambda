import { given, then, when } from 'test-fns';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  asCodeWithoutComments,
  getAllReachableSources,
} from '../../__test_assets__/getAllReachableSources';
import { getIsJestReach } from '../../__test_assets__/getIsJestReach';

describe('[case6] the shipped module graph is jest-free', () => {
  const ROOT = join(__dirname, '../../..');

  given('the util is reached from the package barrel', () => {
    // 🔴 the barrel ITSELF is the entrypoint, never a hand-listed subset.
    //
    //    this list named `runLambdaEndpoint.ts` + `asLambdaEvent.ts` until
    //    self-review r5. both are real shipped modules, so the guard passed —
    //    and its own `given` said "reached from the package barrel", which the
    //    code did not do.
    //
    //    the drift is not hypothetical: `dialect/isLambdaEndpointErrorEnvelope`
    //    was added to the barrel that same round and sat OUTSIDE the walk,
    //    because no listed entrypoint imports it. a hand-maintained list of
    //    entrypoints goes stale on the exact change it exists to police.
    //
    //    ⇒ walk `src/index.ts` and the guard cannot drift: an export that is
    //      not reachable from the barrel is not shipped, by definition.
    const entrypoints = [join(ROOT, 'src/index.ts')];

    when('[t0] every reachable source is inspected', () => {
      then('not one imports jest', () => {
        // 🔴 the forbidden cell. jest is a devDependency (package.json), so a
        //    shipped module that reached it would break a CONSUMER'S install
        //    while this repo's own suite stayed green — the defect is invisible
        //    from here, which is exactly why it needs a structural guard rather
        //    than a review habit.
        const offenders: string[] = [];

        for (const entrypoint of entrypoints)
          for (const path of getAllReachableSources({ from: entrypoint })) {
            const code = asCodeWithoutComments(readFileSync(path, 'utf8'));
            if (getIsJestReach({ code }))
              offenders.push(path.replace(`${ROOT}/`, ''));
          }

        expect(offenders).toEqual([]);
      });

      then('the walk actually reached the graph — the guard has teeth', () => {
        // a guard that walked zero files would pass vacuously, which is the
        // failhide shape this asserts against (rule.forbid.failhide)
        const reached = getAllReachableSources({ from: entrypoints[0]! });
        expect(reached.length).toBeGreaterThan(3);
      });

      then(
        'every runLambdaEndpoint + asLambdaEvent module is in the walk',
        () => {
          // 🔴 the anti-drift clamp. the entrypoint list this replaced was a
          //    hand-maintained subset, and it went stale the round a new public
          //    module landed. these paths assert the barrel walk still reaches
          //    each family, so a barrel edit that orphans one goes red here.
          const reached = getAllReachableSources({ from: entrypoints[0]! });
          const owed = [
            'runLambdaEndpoint/runLambdaEndpoint.ts',
            'runLambdaEndpoint/runLambdaEndpoint.onReferenced.ts',
            'runLambdaEndpoint/runLambdaEndpoint.onSerialized.ts',
            'runLambdaEndpoint/dialect/isLambdaEndpointErrorEnvelope.ts',
            'runLambdaEndpoint/serde/asWireStripped.ts',
            'asLambdaEvent/asLambdaEvent.ts',
            'asLambdaEvent/asLambdaEvent.fromApiGateway.ts',
          ];
          const absent = owed.filter(
            (path) => !reached.some((at) => at.endsWith(path)),
          );
          expect(absent).toEqual([]);
        },
      );
    });

    when('[t1] the extant private test asset is inspected', () => {
      then(
        'createTestContext DOES import jest — so it must stay private',
        () => {
          // the counter-example that proves the guard discriminates. this file is
          // excluded from the build (tsconfig.build.json) and is not reachable
          // from the barrel, which is why it may use jest.
          const text = readFileSync(
            join(ROOT, 'src/__test_assets__/createTestContext.ts'),
            'utf8',
          );
          expect(/\bjest\s*\./.test(text)).toEqual(true);

          // and it is NOT in the shipped graph
          const shipped = getAllReachableSources({ from: entrypoints[0]! });
          expect(
            shipped.some((path) => path.includes('__test_assets__')),
          ).toEqual(false);
        },
      );
    });
  });
});
