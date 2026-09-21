import { given, then, when } from 'test-fns';

import { assertHandlerIsRunnable } from './assertHandlerIsRunnable';

/**
 * .what = clamps the arity guard's KNOWN LIMIT — a wrapper defeats it
 * .why = 🔴 **the guard's mechanism is a net rather than a proof, and a claim of
 *        completeness is worse than a stated bound** — it tells a reader they
 *        need not check.
 *
 *        `Function.prototype.length` counts declared parameters BEFORE the first
 *        default or rest. so a spread-relay wrapper — `(...args) => fn(...args)`,
 *        the shape `rule.require.hook-wrapper-pattern` composes with — reports
 *        `length === 0` whatever it wraps.
 *
 *        ⇒ a callback-style handler behind such a wrapper passes the guard, and
 *          lands in exactly the failhide the guard exists to prevent.
 *
 * ## 🟡 why this is CLAMPED rather than fixed
 *
 * the obvious fix — refuse a handler whose return is not thenable — cannot tell
 * the broken shape from a legitimate one. `[case2]` below measures it:
 *
 * | the handler | its return | thenable? |
 * |---|---|---|
 * | promise, valued | a `Promise` | ✅ |
 * | promise, void | a `Promise` | ✅ |
 * | **sync, valued** | the value | ❌ — and it is legitimate |
 * | **callback** | `undefined` | ❌ — and it is broken |
 *
 * ⇒ so a thenable check would refuse a sync handler to catch a callback one.
 *   whether that trade is worth it is a fork, raised as **F21** rather than taken
 *   here (`rule.always.defer-fulcrums-to-last`).
 *
 * .note = this is a KNOWN-LIMIT clamp, never a guarantee. it asserts the limit is
 *   where we think it is, so a future change to the guard cannot move it in
 *   silence — the same shape F19/F20's limits are clamped with.
 */
describe('assertHandlerIsRunnable — the known limit', () => {
  // a real callback handler: answers undefined now, calls back later
  const callbackHandler = (_event: any, _context: any, _callback: any) => {
    setTimeout(() => _callback(null, { ok: true }), 0);
  };

  given('[case1] a callback handler, bare and wrapped', () => {
    when('[t0] it is bare', () => {
      then('the guard SEES it — `.length` is 3', () => {
        expect(callbackHandler.length).toEqual(3);
        expect(() =>
          assertHandlerIsRunnable({ handler: callbackHandler }),
        ).toThrow('callback-style');
      });
    });

    when('[t1] it sits behind a spread-relay wrapper', () => {
      const wrapped = (...args: any[]) => (callbackHandler as any)(...args);

      then('🔴 the guard is DEFEATED — `.length` resets to 0', () => {
        expect(wrapped.length).toEqual(0);
        expect(() =>
          assertHandlerIsRunnable({ handler: wrapped }),
        ).not.toThrow();
      });

      then('🔴 and the defeat is the FAILHIDE, not merely a miss', async () => {
        // it answers a success-shaped `undefined` for work that never ran
        expect(await wrapped({}, {})).toEqual(undefined);
      });
    });
  });

  given('[case2] the shapes a thenable check would have to tell apart', () => {
    when('[t2] each is called', () => {
      then('a valued promise handler answers a thenable', () => {
        const promised = async (_e: any, _c: any) => ({ ok: true });
        expect(typeof (promised({}, {}) as any).then).toEqual('function');
      });

      then('a VOID promise handler answers a thenable too', () => {
        const voided = async (_e: any, _c: any) => {};
        expect(typeof (voided({}, {}) as any).then).toEqual('function');
      });

      then(
        '🔴 a SYNC handler answers a non-thenable, and is legitimate',
        () => {
          const sync = (_e: any, _c: any) => ({ ok: true });
          expect((sync({}, {}) as any).then).toEqual(undefined);
        },
      );

      then(
        '🔴 a CALLBACK handler answers a non-thenable, and is broken',
        () => {
          expect(callbackHandler({}, {}, () => {})).toEqual(undefined);
        },
      );
    });
  });
});
