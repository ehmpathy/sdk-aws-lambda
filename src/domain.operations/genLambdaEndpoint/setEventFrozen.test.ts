import { given, then, when } from 'test-fns';

import { setEventFrozen } from './setEventFrozen';

/**
 * .what = the unit clamps for the deep freeze
 * .why = `genLambdaEndpoint.forApiGateway.test.ts [case16]` already proves a handler's write to
 *        `event` and to `headers` throws, end to end. that is depth one on a live envelope, and
 *        this file deliberately does not restate it
 *
 *        what that case cannot reach is every other claim the transformer makes — the recursion
 *        past depth one, the in-place contract the projection rests on, the shared-subobject
 *        walk, and termination on a cycle (`rule.require.clamp-edge-cases` — a documented claim
 *        owes a clamp that bites)
 *
 * .note = the cycle case is the one worth the most. no cycle is reachable from this event today,
 *         so the `WeakSet` guards a property no shipped path exercises. an author who
 *         "simplifies" the set away breaks naught observable — until a later author adds a
 *         back-reference, and the freeze hangs the lambda
 */
describe('setEventFrozen', () => {
  /**
   * .why = `Object.freeze` is shallow, and that is the whole reason this transformer exists.
   *        depth one is clamped end to end; the claim is about depth n
   */
  given('[case1] a value nested three levels deep', () => {
    when('[t0] the freeze runs', () => {
      then('every level is frozen, not only the outermost', () => {
        const event = { a: { b: { c: { d: 'leaf' } } } };

        setEventFrozen({ event });

        expect(Object.isFrozen(event)).toEqual(true);
        expect(Object.isFrozen(event.a)).toEqual(true);
        expect(Object.isFrozen(event.a.b)).toEqual(true);
        expect(Object.isFrozen(event.a.b.c)).toEqual(true);
      });

      then('a write at the deepest level throws', () => {
        const event = { a: { b: { c: { d: 'leaf' } } } };

        setEventFrozen({ event });

        expect(() => {
          event.a.b.c.d = 'mutated';
        }).toThrow();
      });
    });
  });

  /**
   * .why = the freeze is in place, deliberately: a defensive copy would remove the same hazard
   *        and destroy the projection — `headers === event.headers` would stop to hold. an
   *        author who "fixes" this by a copy breaks the sdk's central invariant, and only this
   *        case goes red
   */
  given(
    '[case2] an envelope whose slot a caller already holds a reference to',
    () => {
      when('[t0] the freeze runs', () => {
        then(
          "the caller's reference IS the frozen object, never a copy",
          () => {
            const headers = { authorization: 'Bearer tok' };
            const event = { headers };

            setEventFrozen({ event });

            expect(event.headers).toBe(headers);
            expect(Object.isFrozen(headers)).toEqual(true);
          },
        );
      });
    },
  );

  /**
   * .why = the `.why a WeakSet` block cites `asApiGatewayRequestEventUnified.ts:68-69` — the unified
   *        shape and `event._.raw` pass `queryStringParameters` and `pathParameters` BY
   *        REFERENCE, so each is reachable by two paths. the clamp: one object, two paths, one
   *        frozen result and no repeat walk
   */
  given('[case3] one sub-object reachable by two paths', () => {
    when('[t0] the freeze runs', () => {
      then('it is frozen, and both paths still name the same object', () => {
        const shared = { q: '1' };
        const event = {
          queryStringParameters: shared,
          _: { raw: { queryStringParameters: shared } },
        };

        setEventFrozen({ event });

        expect(Object.isFrozen(shared)).toEqual(true);
        expect(event.queryStringParameters).toBe(
          event._.raw.queryStringParameters,
        );
      });
    });
  });

  /**
   * .why = no cycle is reachable from the shipped event, and the `seen` set terminates one
   *        anyway. that claim is true, otherwise unexercised, and one refactor from false — and
   *        its regression is an infinite recursion at run time in a lambda
   * .note = `toThrow` is deliberately not used — a stack overflow is not catchable as a
   *         predictable error, so the clamp is that the call returns at all
   */
  given('[case4] a value that holds a back-reference to itself', () => {
    when('[t0] the freeze runs', () => {
      then('it terminates rather than recurse forever', () => {
        const event: Record<string, unknown> = { name: 'self' };
        event.itself = event;

        setEventFrozen({ event });

        expect(Object.isFrozen(event)).toEqual(true);
      });
    });
  });

  /**
   * .why = `setFrozenDeep` opens with `value === null || typeof value !== 'object'`, which is two
   *        guards rather than one. a primitive and a null are different inputs, and `typeof null`
   *        is `'object'` — so the null arm is a real branch, never a redundancy
   */
  given('[case5] a value that is not an object', () => {
    when('[t0] the freeze runs on null', () => {
      then('it returns rather than throw', () => {
        expect(() => setEventFrozen({ event: null })).not.toThrow();
      });
    });

    when('[t1] the freeze runs on a primitive', () => {
      then('it returns rather than throw', () => {
        expect(() => setEventFrozen({ event: 'a string' })).not.toThrow();
        expect(() => setEventFrozen({ event: undefined })).not.toThrow();
      });
    });
  });

  /**
   * .what = the only type-level clamp in the file
   * .why = every case above proves the runtime throw, and none can fail when the type stops to
   *        refuse the write: a `TypeError` at run time is exactly what an absent `readonly`
   *        produces, so the two observations are identical. the type half therefore owes a
   *        clamp that `tsc` decides, never jest
   *        (`rule.require.positive-control-before-absence-claims`)
   *
   * .why an expect-error and not a suppression = an expect-error is itself an assertion: `tsc`
   *        fails the build when the line it marks compiles cleanly. a bare suppression asserts
   *        naught, so it stays green under the defect
   *
   * .why depth two = `Readonly<T>` already refuses depth one, so a depth-one case stays green
   *        under the defect and proves naught. depth two is where the two types disagree
   *
   * .note = do not name the suppression directive in this comment. biome's `noTsIgnore` rule
   *        rewrites a literal one wherever it appears, prose included
   *
   * .to check it bites = revert `FrozenDeep<T>` to `Readonly<T>` and re-run `tsc`. it fails
   *        with exactly one error — `TS2578: Unused '@ts-expect-error' directive` on the
   *        depth-two line, and none on the depth-one line
   *        (rule.require.clamp-edge-cases, both directions)
   */
  given('[case7] the type of a frozen value, one level in', () => {
    when('[t0] a write is attempted at depth two', () => {
      then('the compiler refuses it', () => {
        const frozen = setEventFrozen({
          event: { headers: { authorization: 'Bearer tok' } },
        });

        const attemptDeep = () => {
          // @ts-expect-error — the depth-two refusal. red under a shallow `Readonly`
          frozen.headers.authorization = 'stolen';
        };

        const attemptShallow = () => {
          // @ts-expect-error — the depth-one refusal, kept as the positive control
          frozen.headers = {} as never;
        };

        // both throw at run time too, so the type and the freeze agree
        expect(attemptDeep).toThrow();
        expect(attemptShallow).toThrow();
      });

      then('a read at depth two still type-checks and works', () => {
        const frozen = setEventFrozen({
          event: { headers: { authorization: 'Bearer tok' } },
        });

        /**
         * .why this control = without it, the two `@ts-expect-error`s above would also be
         *        satisfied by a `FrozenDeep` that broke the type outright — `never` refuses a
         *        write AND a read alike. this proves the refusal is narrow
         */
        expect(frozen.headers.authorization).toEqual('Bearer tok');
      });
    });
  });

  /**
   * .why = the walk iterates `Object.values`, which reads own enumerable values only. a
   *        prototype belongs to whoever declared it, and a walk that froze one would reach
   *        across every object in the process that shares it
   */
  given('[case6] an object whose prototype carries a value', () => {
    when('[t0] the freeze runs', () => {
      then('the prototype is left unfrozen', () => {
        const proto = { shared: { mutable: true } };
        const event = Object.create(proto) as { own?: string };
        event.own = 'mine';

        setEventFrozen({ event });

        expect(Object.isFrozen(event)).toEqual(true);
        expect(Object.isFrozen(proto)).toEqual(false);
        expect(Object.isFrozen(proto.shared)).toEqual(false);
      });
    });
  });
});
