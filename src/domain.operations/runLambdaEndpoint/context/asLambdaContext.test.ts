import { ConstraintError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { asLambdaContext } from './asLambdaContext';

/**
 * .what = the unit clamp on the shipped lambda context
 * .why = a transformer owes a unit test (`rule.require.test-coverage-by-grain`),
 *        and without this file the failhide `[case3]` clamps is reachable only
 *        by a rule walk, never by a test.
 */
describe('asLambdaContext', () => {
  given('[case1] no overrides', () => {
    when('[t0] a context is cast', () => {
      then('every field the aws Context declares is present', () => {
        const context = asLambdaContext();

        // the aws runtime supplies all of these; a handler may read any
        expect(context.functionName).toEqual('run-lambda-endpoint');
        expect(context.awsRequestId).toEqual(
          '00000000-0000-4000-8000-000000000000',
        );
        expect(context.memoryLimitInMB).toEqual('128');
        expect(context.callbackWaitsForEmptyEventLoop).toEqual(true);

        // 🔴 the WHOLE shipped shape, pinned. the four reads above name the
        //    fields this case argues about; the snapshot is what a reviewer
        //    reads to see the rest — the arn, the log group, the stream — with
        //    no trip into the source. every value is a fixed literal or a
        //    synthetic constant, so it cannot drift on a re-run.
        expect(context).toMatchSnapshot();
      });

      then('the time left is a positive budget', () => {
        // a handler that reads its own deadline must not see zero or a negative
        expect(asLambdaContext().getRemainingTimeInMillis()).toBeGreaterThan(0);
      });
    });
  });

  given('[case2] an override', () => {
    when('[t0] one field is overridden', () => {
      then('the override wins and the rest keep their defaults', () => {
        const context = asLambdaContext({ functionName: 'svc-surf-getWave' });

        expect(context.functionName).toEqual('svc-surf-getWave');
        expect(context.memoryLimitInMB).toEqual('128');

        // the MERGE is the contract here — two field reads cannot show that the
        // other ten defaults survived the spread, and the snapshot can
        expect(context).toMatchSnapshot();
      });
    });

    when('[t1] a legacy callback is overridden back to a no-op', () => {
      then('the override wins, so the escape hatch is real', () => {
        // ⚠️ the doc promises this. a consumer who genuinely wants the old
        //    silent shape must be able to ask for it, and `overrides` spreads
        //    last precisely so they can.
        const context = asLambdaContext({ fail: () => {} });

        expect(() => context.fail(new Error('quiet'))).not.toThrow();
      });
    });
  });

  /**
   * 🔴 [case3] — the failhide clamp.
   *
   * a `() => {}` stub on the three legacy signals is a failhide: a
   * callback-style handler reports a fault through `context.fail(error)`, so a
   * no-op swallows it and the run answers `undefined` as though the handler had
   * succeeded.
   *
   * ⚠️ **this clamp bites** — probed by a revert of the refusal:
   *   - with `fail: () => {}` restored, all three `[t*]` below go RED
   *   - with the refusal in place, all three pass
   */
  given(
    '[case3] a handler that signals through the legacy callback api',
    () => {
      when('[t0] it calls context.fail', () => {
        then('the fault is thrown, never swallowed', () => {
          const error = getError(() =>
            asLambdaContext().fail(new Error('the surfer never paddled out')),
          );

          expect(error).toBeInstanceOf(ConstraintError);
          expect(error.message).toContain('legacy callback api');

          expect({
            class: error.constructor.name,
            messageNamesLegacyCallbackApi: error.message.includes(
              'legacy callback api',
            ),
            hintNamesReturnAPromise: JSON.stringify(error).includes(
              'return a promise from the handler instead',
            ),
          }).toMatchSnapshot();
        });

        then('the error names the fix', () => {
          const error = getError(() => asLambdaContext().fail('a bare string'));

          // rule.require.errors-name-the-fix — a symptom alone teaches naught
          expect(error.message).toContain('return a promise');
        });
      });

      when('[t1] it calls context.done with an error', () => {
        then('the fault is thrown', () => {
          const error = getError(() =>
            asLambdaContext().done(new Error('the board snapped')),
          );

          expect(error).toBeInstanceOf(ConstraintError);

          // all three legacy signals route through one refusal, so all three
          // snapshots must read IDENTICALLY — that identity IS the claim, and
          // a `toBeInstanceOf` on each cannot report a divergence between them
          expect({
            class: error.constructor.name,
            messageNamesLegacyCallbackApi: error.message.includes(
              'legacy callback api',
            ),
            hintNamesReturnAPromise: JSON.stringify(error).includes(
              'return a promise from the handler instead',
            ),
          }).toMatchSnapshot();
        });
      });

      when('[t2] it calls context.succeed with a result', () => {
        then('the dropped output is surfaced as a throw', () => {
          // a silent stub here loses the handler's entire output, which reads to
          // the author as "the handler returned undefined" — a wrong diagnosis
          const error = getError(() =>
            asLambdaContext().succeed({ wave: 'big' }),
          );

          expect(error).toBeInstanceOf(ConstraintError);

          expect({
            class: error.constructor.name,
            messageNamesLegacyCallbackApi: error.message.includes(
              'legacy callback api',
            ),
            hintNamesReturnAPromise: JSON.stringify(error).includes(
              'return a promise from the handler instead',
            ),
          }).toMatchSnapshot();
        });
      });
    },
  );
});
