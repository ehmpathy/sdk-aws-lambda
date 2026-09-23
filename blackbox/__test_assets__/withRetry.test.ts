import { getError, given, then, useThen, when } from 'test-fns';

import { withRetry } from './withRetry';

/**
 * .what = the retry primitive's own contract — when it re-drives, when it refuses, and how
 *         long it waits
 * .why = it has four real branches (a success, a predicate refusal, an exhaustion, a backoff
 *        that grows) and, while it sat inside `setLambdaLive.ts`, every one of them was
 *        reachable only through a live aws deploy. so its most consequential branch — the
 *        one that decides whether a TERMINAL fault is re-driven four times — had never once
 *        been run in isolation
 *
 * ⚠️ .why the BACKOFF SHAPE is worth a case rather than a comment = the deploy budget in
 *    `setLambdaLive.ts` derives its iam term as `backoffMs × (1 + 2 + … + retryCount)`, and
 *    that arithmetic is true only while this function sleeps `backoffMs * n` on retry n. the
 *    two live in different files and are checked by no compiler, so `[case4]` is what keeps
 *    the budget's premise honest
 *
 * .note = every case uses a 1ms backoff. the SHAPE is what is under test, never the
 *         duration, and a real backoff would trade seconds of suite time for no assertion
 *         (rule.require.hermetic-tests)
 */
describe('withRetry', () => {
  /** .what = the options every case shares but overrides piecemeal */
  const asOptions = (input: {
    maxAttempts?: number;
    shouldRetry?: (error: Error) => boolean;
    onRetry?: (i: { attempt: number; waitMs: number; error: Error }) => void;
  }) => ({
    maxAttempts: input.maxAttempts ?? 3,
    backoffMs: 1,
    shouldRetry: input.shouldRetry ?? (() => true),
    onRetry: input.onRetry ?? (() => undefined),
  });

  given('[case1] an operation that succeeds on the first attempt', () => {
    when('[t0] it is driven', () => {
      const seen = useThen('it answers', async () => {
        let calls = 0;
        const result = await withRetry(async () => {
          calls += 1;
          return 'the wave';
        }, asOptions({}));
        return { calls, result };
      });

      then('the value comes back', () => {
        expect(seen.result).toEqual('the wave');
      });

      then('and it is driven exactly once — no speculative retry', () => {
        expect(seen.calls).toEqual(1);
      });
    });
  });

  given('[case2] an operation that fails, then succeeds', () => {
    when('[t0] the predicate says the failure is retryable', () => {
      const seen = useThen('it answers', async () => {
        let calls = 0;
        const result = await withRetry(async () => {
          calls += 1;
          if (calls < 3) throw new Error('not yet assumable');
          return 'the wave';
        }, asOptions({}));
        return { calls, result };
      });

      then('the retry clears it and the value comes back', () => {
        expect(seen.result).toEqual('the wave');
      });

      then('and it took exactly as many attempts as it needed', () => {
        expect(seen.calls).toEqual(3);
      });
    });
  });

  given('[case3] a failure the predicate REFUSES', () => {
    /**
     * ⚠️ .why this is the case that matters most = its absence was a measured defect on this
     *    branch. a prior predicate matched any message with the word `role` in it, so a
     *    TERMINAL fault — an `AccessDenied`, a malformed policy — was re-driven four times
     *    and cost 30s of backoff before its real cause surfaced. the retry never HID the
     *    cause; it made it slow, and dressed it up as eventual consistency
     *
     * ⇒ so `[t0]` grades the one branch that separates a retry from a stall
     */
    when('[t0] it is driven', () => {
      const seen = useThen('it refuses', async () => {
        let calls = 0;
        const error = await getError(
          withRetry(
            async () => {
              calls += 1;
              throw new Error('AccessDenied — terminal, never a race');
            },
            asOptions({ shouldRetry: () => false }),
          ),
        );
        return { calls, message: error.message };
      });

      then('it is driven ONCE and no more', () => {
        expect(seen.calls).toEqual(1);
      });

      then('and the original error is rethrown untouched', () => {
        expect(seen.message).toContain('AccessDenied');
      });
    });
  });

  given('[case4] a failure that never clears', () => {
    when('[t0] it is driven to exhaustion', () => {
      const seen = useThen('it gives up', async () => {
        let calls = 0;
        const waits: number[] = [];
        const error = await getError(
          withRetry(
            async () => {
              calls += 1;
              throw new Error('still not assumable');
            },
            asOptions({
              maxAttempts: 4,
              onRetry: ({ waitMs }) => waits.push(waitMs),
            }),
          ),
        );
        return { calls, waits, message: error.message };
      });

      then('it stops at maxAttempts — the budget is a real bound', () => {
        expect(seen.calls).toEqual(4);
      });

      then('the last error is rethrown rather than swallowed', () => {
        expect(seen.message).toContain('still not assumable');
      });

      /**
       * ⚠️ .this row is the one `setLambdaLive.ts`'s budget arithmetic depends on. it derives
       *    its iam term as `backoffMs × (1 + 2 + … + retryCount)`, which holds only while the
       *    waits grow LINEARLY by attempt number. a switch to an exponential backoff would
       *    leave that budget silently short, and no type would object
       */
      then('and each backoff is `backoffMs * n` — linear, by attempt', () => {
        expect(seen.waits).toEqual([1, 2, 3]);
      });
    });
  });

  given('[case5] a caller that supplies NO `onRetry` at all', () => {
    /**
     * ⚠️ .why this case exists = `onRetry` was a REQUIRED option until two reviewers named it
     *    the same round (`r006.nitpick.2`, `r009.nitpick.1`), each on the same ground: it is
     *    purely observational, so a caller with no progress need was made to invent a
     *    `() => undefined`. it is now `onRetry?`, invoked `options.onRetry?.({ … })`
     *
     * ⇒ and the absent branch owes a clamp of its own, because `asOptions` above DEFAULTS
     *   `onRetry` — so every one of [case1]–[case4] supplies it, and not one of them would
     *   go red if the `?.` were reverted to a bare call
     *   (rule.require.clamp-edge-cases). this case therefore builds its options INLINE,
     *   with the key omitted rather than defaulted
     *
     * .the clamp bites, verified BOTH ways:
     *   - revert the type to `onRetry:` (required)  -> this case fails to COMPILE
     *   - revert the call to `options.onRetry(…)`   -> this case throws
     *     `TypeError: options.onRetry is not a function` on the first retry
     */
    when('[t0] it is driven through a real retry', () => {
      const seen = useThen('it answers rather than throws', async () => {
        let calls = 0;
        const result = await withRetry(
          async () => {
            calls += 1;
            if (calls < 3) throw new Error('not yet assumable');
            return 'the wave';
          },
          {
            maxAttempts: 3,
            backoffMs: 1,
            shouldRetry: () => true,
            // onRetry omitted on purpose — this is the branch under test
          },
        );
        return { calls, result };
      });

      then('the absent hook is skipped rather than invoked', () => {
        expect(seen.result).toEqual('the wave');
      });

      then('and the retry still ran — the backoff path was truly reached', () => {
        expect(seen.calls).toEqual(3);
      });
    });
  });
});
