import { DomainEntity } from 'domain-objects';
import { MalfunctionError } from 'helpful-errors';
import { type IsoTimeStamp, isIsoTimeStamp } from 'iso-time';
import { getError, given, then, when } from 'test-fns';

import { setEventFrozen } from './setEventFrozen';

/**
 * .what = a dobj whose field holds a brand, as a schema's `.contract()` would hand a handler
 * .why = a payload is not only json — a dobj instance reaches `FrozenDeep` too, so `[case8][t3]`
 *        clamps the brand inside one rather than argue it from a plain bag
 */
interface Thread {
  uuid: string;
  lastMessageAt: IsoTimeStamp;
}
class Thread extends DomainEntity<Thread> implements Thread {
  public static unique = ['uuid'] as const;
}

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
 *         so the walk's dedupe guards a property no shipped path exercises. the walk is type-fns'
 *         `asFrozenDeep` now, so these cases pin the dependency: a type-fns release that dropped
 *         the dedupe would break naught observable — until a later author adds a back-reference,
 *         and the freeze hangs the lambda
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
   * .why = `asApiGatewayRequestEventUnified` hands the unified shape and `event._.raw` the same
   *        `queryStringParameters` and `pathParameters` BY REFERENCE, so each is reachable by
   *        two paths. the clamp: one object, two paths, one
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
   * .why = no cycle is reachable from the shipped event, and the walk's dedupe terminates one
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
   * .why = a primitive and a null are different inputs, and `typeof null` is `'object'` — so a
   *        walk that guards only on `typeof` would try to freeze `null`. both must pass through
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
   * .why = the walk reads own props only, never the prototype chain. a
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

  /**
   * .what = the first type-level clamp in the file; `[case8]` and `[case9]` follow its form
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
   * .to check it bites = swap `setEventFrozen`'s return type (and its cast) to `Readonly<TEvent>`
   *        and re-run `tsc`. measured: 21 errors repo-wide, three of them in this case — `TS2578:
   *        Unused '@ts-expect-error' directive` on the depth-two field write in `[t0]` and on both
   *        array writes in `[t1]` (an array one level in is mutable under `Readonly`), and none on
   *        the depth-one line (rule.require.clamp-edge-cases, both directions). the other 18 are
   *        the same bite seen from other clamps: 8 more `TS2578` in this file's later cases, and
   *        10 `TS2322` where a variant hands `FrozenDeep` to `invoke`
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

    when('[t1] a write into an array is attempted', () => {
      then(
        'the compiler refuses an index write and a push, and so does the freeze',
        () => {
          const frozen = setEventFrozen({ event: { tags: ['a', 'b'] } });

          const attemptIndex = () => {
            // @ts-expect-error — `readonly string[]` has a readonly index signature
            frozen.tags[0] = 'z';
          };
          const attemptPush = () => {
            // @ts-expect-error — `push` does not exist on `readonly string[]`
            frozen.tags.push('c');
          };

          expect(attemptIndex).toThrow(TypeError);
          expect(attemptPush).toThrow(TypeError);
          expect(frozen.tags).toEqual(['a', 'b']);
        },
      );

      then('a new array built from the frozen one compiles and works', () => {
        const sinkTags = (input: { tags: string[] }): number =>
          input.tags.length;
        const frozen = setEventFrozen({ event: { tags: ['a', 'b'] } });

        // the frozen array itself cannot go to a mutable sink — the reverse of the superset's
        // widen, held for `tsc` alone
        // @ts-expect-error — a `readonly string[]` is not assignable to `string[]`
        const attemptSink = () => sinkTags(frozen);
        void attemptSink;

        // the fix the refusal points at (vision case=2 `[t5]`)
        const tags = [...frozen.tags, 'c'];

        expect(sinkTags({ tags })).toEqual(3);
        expect(frozen.tags).toEqual(['a', 'b']);
      });
    });
  });

  /**
   * .what = the type-level clamp for a branded primitive (ehmpathy/sdk-aws-lambda#48)
   * .why = a branded primitive (`string & { _brand }`) extends `object`, so a `FrozenDeep` with no
   *        primitive arm maps it to a bag of `String` methods — and a handler can no longer hand
   *        `payload.at` to a sink typed `IsoTimeStamp`. the value is untouched at run time, so
   *        only `tsc` can see the defect, and only a real brand can provoke it
   *
   * .why each position = the object arm and the array arm each recurse, so the defect reaches
   *        every depth alike. a clamp at one position would prove the recursion by argument; one
   *        sink per position proves it by run, and a red names the position that broke
   *
   * .why nullable and optional = `FrozenDeep<T>` checks a naked `T`, so it distributes over
   *        `T | null` and `T | undefined`. the commonest real shape is a "last seen" stamp that
   *        may be absent, so the union is clamped on its own rather than argued from the bare brand
   *
   * .to check it bites = swap `setEventFrozen`'s return type to a `FrozenDeep` with no primitive
   *        arm (the sdk's own, as of 0.7.0) and re-run `tsc`. measured: `TS2345` on each of the
   *        six sink calls below, one per position
   */
  given('[case8] a payload that holds a branded primitive', () => {
    const at = isIsoTimeStamp.assure('2026-10-01T12:00:00.000Z');

    // sinks typed with the original shape, as a handler's downstream operation would be
    const sinkTop = (input: { at: IsoTimeStamp }): IsoTimeStamp => input.at;
    const sinkNested = (input: {
      page: { lastMessageAt: IsoTimeStamp };
    }): IsoTimeStamp => input.page.lastMessageAt;
    const sinkItems = (input: {
      seenAt: readonly IsoTimeStamp[];
    }): readonly IsoTimeStamp[] => input.seenAt;
    const sinkNullable = (input: {
      lastSeenAt: IsoTimeStamp | null;
    }): IsoTimeStamp | null => input.lastSeenAt;
    const sinkOptional = (input: {
      lastSeenAt?: IsoTimeStamp;
    }): IsoTimeStamp | undefined => input.lastSeenAt;

    when(
      '[t0] the frozen value is forwarded to sinks typed with its shape',
      () => {
        then('a top-level field is still assignable to its brand', () => {
          const frozen = setEventFrozen({ event: { at } });
          expect(sinkTop(frozen)).toEqual(at);
        });

        then('a nested field is still assignable to its brand', () => {
          const frozen = setEventFrozen({
            event: { page: { lastMessageAt: at } },
          });
          expect(sinkNested(frozen)).toEqual(at);
        });

        then('an array item is still assignable to its brand', () => {
          const frozen = setEventFrozen({ event: { seenAt: [at, at] } });
          expect(sinkItems(frozen)).toEqual([at, at]);
        });

        then('a nullable brand is still assignable, in both members', () => {
          const eventSome: { lastSeenAt: IsoTimeStamp | null } = {
            lastSeenAt: at,
          };
          const eventNone: { lastSeenAt: IsoTimeStamp | null } = {
            lastSeenAt: null,
          };
          const eventSomeFrozen = setEventFrozen({ event: eventSome });
          const eventNoneFrozen = setEventFrozen({ event: eventNone });
          expect(sinkNullable(eventSomeFrozen)).toEqual(at);
          expect(sinkNullable(eventNoneFrozen)).toEqual(null);
        });

        then('an optional brand is still assignable', () => {
          const event: { lastSeenAt?: IsoTimeStamp } = { lastSeenAt: at };
          const frozen = setEventFrozen({ event });
          expect(sinkOptional(frozen)).toEqual(at);
        });

        then('a plain primitive is still assignable to its type', () => {
          const sinkPlain = (input: {
            label: string;
            count: number;
            done: boolean;
          }): string => `${input.label}:${input.count}:${input.done}`;
          const frozen = setEventFrozen({
            event: { label: 'a', count: 1, done: true },
          });
          expect(sinkPlain(frozen)).toEqual('a:1:true');
        });
      },
    );

    when('[t1] a write into the payload is attempted', () => {
      then('the compiler still refuses it — the new arm opens no write', () => {
        const frozen = setEventFrozen({
          event: { page: { lastMessageAt: at } },
        });

        const attempt = () => {
          // @ts-expect-error — the invariant: no slot handed to `invoke` is writable
          frozen.page.lastMessageAt = at;
        };

        expect(attempt).toThrow();
      });
    });

    /**
     * .why = the refusal in `[t1]` points at one route out: build a new value and forward that.
     *        if the route itself failed to compile, the refusal would be a dead end, not a guard
     */
    when('[t2] a new value is built from the frozen one', () => {
      then('it compiles and forwards — the route the refusal points at', () => {
        const frozen = setEventFrozen({
          event: { page: { lastMessageAt: at } },
        });
        const later = isIsoTimeStamp.assure('2026-10-02T12:00:00.000Z');

        const rebuilt = {
          ...frozen,
          page: { ...frozen.page, lastMessageAt: later },
        };

        expect(sinkNested(rebuilt)).toEqual(later);
        expect(frozen.page.lastMessageAt).toEqual(at);
      });
    });

    /**
     * .why = a schema's `.contract()` hands the handler a dobj instance, and an instance reaches
     *        `FrozenDeep` through the object arm — the same arm as a plain bag. the clamp holds
     *        that a brand inside an instance is refused for write and kept for read alike
     */
    when('[t3] a write into a field of a dobj instance is attempted', () => {
      then('the compiler refuses it, and the brand still reads', () => {
        const frozen = setEventFrozen({
          event: { thread: new Thread({ uuid: 't-1', lastMessageAt: at }) },
        });

        const attempt = () => {
          // @ts-expect-error — an instance field is no more writable than a bag field
          frozen.thread.lastMessageAt = at;
        };

        expect(attempt).toThrow();
        expect(sinkTop({ at: frozen.thread.lastMessageAt })).toEqual(at);
      });
    });

    /**
     * .what = the whole handler journey on a branded page: the write, the rebuild, both forwards
     * .why = the wish's own shape — a handler that forwards `IsoTimeStamp`s to a sink — run end to
     *        end at one site, so each step is held against the same frozen value
     */
    when('[t4] a handler writes, rebuilds, and forwards a branded page', () => {
      then(
        'the write is refused, the rebuild and both forwards compile',
        () => {
          const later = isIsoTimeStamp.assure('2026-10-02T12:00:00.000Z');
          const getThreads = (input: {
            page: { since: IsoTimeStamp; until: IsoTimeStamp };
          }): IsoTimeStamp => input.page.until;
          const payload = setEventFrozen({
            event: { page: { since: at, until: later } },
          });

          const attempt = () => {
            // @ts-expect-error — `page.until` is read-only under `FrozenDeep`
            payload.page.until = payload.page.since;
          };
          const page = { ...payload.page, until: payload.page.since };

          expect(attempt).toThrow();
          expect(getThreads({ page })).toEqual(at);
          expect(getThreads(payload)).toEqual(later);
        },
      );
    });
  });

  /**
   * .what = a `Set` in the payload becomes a `ReadonlySet` (vision case=6, fulcrum F4)
   * .why = type-fns' `FrozenDeep` maps `Set` to `ReadonlySet`, so the type now holds the rule the
   *        sdk states — no value handed to `invoke` is writable — for a shape the old local type
   *        let through. the break is real, so the clamp proves both halves: the refusal, and the
   *        routes out of it (a copy, or a readonly sink)
   *
   * .to check it bites = swap in the 0.7.0 local `FrozenDeep` (it maps a `Set`'s keys and keeps
   *        `.add`) and re-run `tsc`. measured: `TS2578` on all four `@ts-expect-error` lines of
   *        `[t0]` — the `Set` pair and the `Map` pair
   */
  given('[case9] a payload that holds a Set or a Map', () => {
    const sinkSet = (input: { seen: Set<string> }): number => input.seen.size;

    when('[t0] a mutator or a mutable sink is reached for', () => {
      then('the compiler refuses both', () => {
        const frozen = setEventFrozen({ event: { seen: new Set(['a']) } });

        // never invoked — this case holds the type gate; `[case10][t0]` runs the same call
        const attemptAdd = () => {
          // @ts-expect-error — `add` does not exist on `FrozenSet` (type-fns' alias for `ReadonlySet`)
          frozen.seen.add('b');
        };
        const attemptSink = () =>
          // @ts-expect-error — a `FrozenSet` is not assignable to `Set`
          sinkSet(frozen);

        // `void` marks the closures as held for `tsc` alone — no run-time assertion claims them
        void attemptAdd;
        void attemptSink;

        // the positive control: a read still compiles and works, so the refusal is narrow —
        // a `FrozenDeep` that broke the type to `never` would refuse this line too
        expect(frozen.seen.has('a')).toEqual(true);
      });

      then('the compiler refuses the same pair on a Map', () => {
        const sinkMap = (input: { byId: Map<string, number> }): number =>
          input.byId.size;
        const frozen = setEventFrozen({ event: { byId: new Map([['a', 1]]) } });

        // never invoked — this case holds the type gate; `[case10][t0]` runs the same call
        const attemptSet = () => {
          // @ts-expect-error — `set` does not exist on `FrozenMap` (type-fns' alias for `ReadonlyMap`)
          frozen.byId.set('b', 2);
        };
        const attemptSink = () =>
          // @ts-expect-error — a `FrozenMap` is not assignable to `Map`
          sinkMap(frozen);

        // held for `tsc` alone, as above; the read is the positive control
        void attemptSet;
        void attemptSink;
        expect(frozen.byId.get('a')).toEqual(1);
      });
    });

    when('[t1] the handler copies, then mutates the copy', () => {
      then('it compiles, and the frozen original is untouched', () => {
        const frozen = setEventFrozen({ event: { seen: new Set(['a']) } });

        const seen = new Set(frozen.seen);
        seen.add('b');

        expect(sinkSet({ seen })).toEqual(2);
        expect(frozen.seen.size).toEqual(1);
      });
    });

    when('[t2] the sink is typed readonly', () => {
      then('the frozen value forwards with no copy', () => {
        const sinkSetReadonly = (input: {
          seen: ReadonlySet<string>;
        }): number => input.seen.size;
        const sinkMapReadonly = (input: {
          byId: ReadonlyMap<string, number>;
        }): number => input.byId.size;
        const seenFrozen = setEventFrozen({ event: { seen: new Set(['a']) } });
        const byIdFrozen = setEventFrozen({
          event: { byId: new Map([['a', 1]]) },
        });

        expect(sinkSetReadonly(seenFrozen)).toEqual(1);
        expect(sinkMapReadonly(byIdFrozen)).toEqual(1);
      });
    });
  });

  /**
   * .what = a value whose state lives in an internal slot, not a property
   * .why = `Object.freeze` seals properties only, so a `Date` / `Map` / `Set` / `WeakMap` /
   *        `WeakSet` would keep its mutators live under a bare freeze. type-fns' `asFrozenDeep`
   *        replaces each mutator with a thrower, so the runtime refuses what the type refuses.
   *        `JSON.parse` yields none of these values, so one lands in a payload only when the
   *        schema builds it (a `.transform()`, a codec, a `z.coerce.date()`)
   *
   * .to check it bites = swap `setEventFrozen`'s body back to a bare `Object.freeze` walk. each
   *        `[t0]` row goes red: the mutator runs and no error is thrown
   */
  given('[case10] a payload that holds a slot-backed value', () => {
    when('[t0] a mutator method is called on the frozen value', () => {
      then('a Date: it compiles, and the write is refused', () => {
        const frozen = setEventFrozen({
          event: { sentAt: new Date('2026-06-15T12:00:00.000Z') },
        });

        // `FrozenDeep<Date>` keeps the methods, so the runtime is the guard here
        const attempt = () => frozen.sentAt.setFullYear(2000);

        expect(attempt).toThrow('a frozen Date refuses .setFullYear()');
        expect(frozen.sentAt.getFullYear()).toEqual(2026);
      });

      then('a WeakMap: it compiles, and the write is refused', () => {
        const key = {};
        const frozen = setEventFrozen({ event: { cache: new WeakMap() } });

        const attempt = () => frozen.cache.set(key, 1);

        expect(attempt).toThrow('a frozen WeakMap refuses .set()');
        expect(frozen.cache.has(key)).toEqual(false);
      });

      then('a WeakSet: it compiles, and the write is refused', () => {
        const key = {};
        const frozen = setEventFrozen({ event: { seen: new WeakSet() } });

        const attempt = () => frozen.seen.add(key);

        expect(attempt).toThrow('a frozen WeakSet refuses .add()');
        expect(frozen.seen.has(key)).toEqual(false);
      });

      /**
       * .why the casts = the subject of this row IS a cast past the type: `[case9]` proves the
       *        compiler refuses `.add` / `.set`, and this row proves the runtime refuses them too,
       *        so a cast does not get past (`rule.forbid.as-cast` — a documented test-only cast)
       */
      then('a Set or a Map: a cast past the type is refused too', () => {
        const frozen = setEventFrozen({
          event: { seen: new Set(['a']), byId: new Map([['a', 1]]) },
        });

        const attemptAdd = () => (frozen.seen as Set<string>).add('b');
        const attemptSet = () =>
          (frozen.byId as Map<string, number>).set('b', 2);

        expect(attemptAdd).toThrow('a frozen Set refuses .add()');
        expect(attemptSet).toThrow('a frozen Map refuses .set()');
        expect(frozen.seen.size).toEqual(1);
        expect(frozen.byId.size).toEqual(1);
      });
    });

    when('[t1] the only mutable state is a property', () => {
      then(
        'a RegExp: the compiler refuses a lastIndex write, and so does the freeze',
        () => {
          const frozen = setEventFrozen({ event: { pattern: /a/ } });

          const attemptWrite = () => {
            // @ts-expect-error — `lastIndex` is a property, so the object arm makes it readonly
            frozen.pattern.lastIndex = 3;
          };

          expect(attemptWrite).toThrow(TypeError);
          expect(frozen.pattern.test('a')).toEqual(true);
        },
      );
    });

    /**
     * .what = the two shapes the freeze cannot seal: a typed array that holds bytes (its index
     *         slots cannot be frozen) and a global or sticky `RegExp` (its reads write `lastIndex`)
     * .why = `asFrozenDeep` refuses the whole value before it freezes any of it. only the
     *        handler's own schema can build either shape, so `setEventFrozen` raises it as a
     *        `MalfunctionError` — a server fault — with the type-fns refusal as `cause`, so its
     *        `path` and `hint` still name the fix
     */
    when('[t2] a payload holds a value the freeze cannot seal', () => {
      then(
        'a typed array with bytes: a MalfunctionError, cause named',
        async () => {
          const error = await getError(() =>
            setEventFrozen({ event: { bytes: new Uint8Array([1, 2]) } }),
          );

          expect(error).toBeInstanceOf(MalfunctionError);
          expect((error.cause as Error).message).toContain(
            'can not freeze a typed array with elements',
          );
        },
      );

      then('a global RegExp: a MalfunctionError, cause named', async () => {
        const error = await getError(() =>
          setEventFrozen({ event: { pattern: /a/g } }),
        );

        expect(error).toBeInstanceOf(MalfunctionError);
        expect((error.cause as Error).message).toContain(
          'can not freeze a global or sticky RegExp',
        );
      });

      then('all or none: the refused value is left unfrozen', async () => {
        const event = { page: { limit: 1 }, bytes: new Uint8Array([1, 2]) };

        await getError(() => setEventFrozen({ event }));

        expect(Object.isFrozen(event.page)).toEqual(false);
      });

      then(
        'the positive control: an empty one freezes, so the bytes are the cause',
        () => {
          const frozen = setEventFrozen({
            event: { bytes: new Uint8Array(0) },
          });

          expect(Object.isFrozen(frozen.bytes)).toEqual(true);
        },
      );

      then(
        'the route out: the same bytes as a plain `number[]` freeze like any array',
        () => {
          const frozen = setEventFrozen({
            event: { bytes: Array.from(new Uint8Array([1, 2])) },
          });

          expect(Object.isFrozen(frozen.bytes)).toEqual(true);
          expect(frozen.bytes).toEqual([1, 2]);
        },
      );
    });

    when('[t3] the handler rebuilds the Date before it changes it', () => {
      then('the copy changes, and the frozen original is untouched', () => {
        const frozen = setEventFrozen({
          event: { sentAt: new Date('2026-06-15T12:00:00.000Z') },
        });

        const sentAt = new Date(frozen.sentAt);
        sentAt.setFullYear(2000);

        expect(sentAt.getFullYear()).toEqual(2000);
        expect(frozen.sentAt.getFullYear()).toEqual(2026);
      });
    });

    /**
     * .what = a frozen `Date` or `RegExp` forwards to a sink typed on the builtin itself
     * .why = these builtins take the object arm, which keeps their methods, so the frozen value
     *        stays assignable to `Date` / `RegExp` (type-fns names them, `FrozenDeep.ts:27-30`
     *        @ v1.21.5). this pins inventory row 12 at `tsc`, not only in prose
     */
    when('[t4] the handler forwards the builtin to a sink typed on it', () => {
      then(
        'a Date and a RegExp each reach their sink, read members intact',
        () => {
          const frozen = setEventFrozen({
            event: {
              sentAt: new Date('2026-06-15T12:00:00.000Z'),
              pattern: /a/,
            },
          });
          const sinkDate = (input: { at: Date }): number => input.at.getTime();
          const sinkRegExp = (input: { pattern: RegExp }): boolean =>
            input.pattern.test('a');

          expect(sinkDate({ at: frozen.sentAt })).toEqual(
            Date.parse('2026-06-15T12:00:00.000Z'),
          );
          expect(sinkRegExp({ pattern: frozen.pattern })).toEqual(true);
        },
      );
    });
  });
});
