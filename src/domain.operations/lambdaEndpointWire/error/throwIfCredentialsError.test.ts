import { ConstraintError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import {
  getIsCredentialsError,
  throwIfCredentialsError,
} from './throwIfCredentialsError';

/**
 * .what = the credential-fault detector and its mapper
 * .why = the operation case=9 `[t1]` rests on — *the credential-free reject that
 *        NAMES THE FIX*. it needs no credentials, because what is under test is
 *        how a credentials FAILURE is read, never the chain itself.
 *
 * 🟡 the chain walk is clamped HERE rather than end-to-end: a bite-probe in
 *    `[case12]` of `runLambdaEndpoint.onSerialized.integration.test.ts` cannot
 *    make it go red, because the invoke wrapper interpolates `${error.message}`
 *    and the word reaches the top level anyway. `[case2]` below is the shape
 *    that CAN bite (`rule.require.clamp-edge-cases`).
 */
describe('throwIfCredentialsError', () => {
  given('[case1] the aws fault, unwrapped', () => {
    const genAwsFault = (input: { name: string; message: string }): Error => {
      const error = new Error(input.message);
      error.name = input.name;
      return error;
    };

    when('[t0] aws names it in the error NAME', () => {
      then('it is detected', () => {
        expect(
          getIsCredentialsError(
            genAwsFault({
              name: 'CredentialsProviderError',
              message: 'Could not load credentials from any providers',
            }),
          ),
        ).toEqual(true);
      });
    });

    when('[t1] aws names it in the MESSAGE only', () => {
      // the expired-sso shape: `ExpiredTokenException` holds no `credential` in
      // its name, so the message check is why the detector reads both.
      then('it is detected', () => {
        expect(
          getIsCredentialsError(
            genAwsFault({
              name: 'ExpiredTokenException',
              message: 'The security token included in the request is expired',
            }),
          ),
        ).toEqual(true);
      });
    });

    when('[t2] the fault is unrelated', () => {
      then('it is NOT detected', () => {
        expect(
          getIsCredentialsError(
            genAwsFault({
              name: 'TooManyRequestsException',
              message: 'Rate exceeded',
            }),
          ),
        ).toEqual(false);
      });
    });

    when('[t3] the thrown value is not an Error at all', () => {
      // a boundary that rethrows a string or an object must not crash the
      // detector
      then('it is NOT detected, and no throw escapes', () => {
        expect(getIsCredentialsError('credentials are absent')).toEqual(false);
        expect(getIsCredentialsError(undefined)).toEqual(false);
        expect(
          getIsCredentialsError({ name: 'CredentialsProviderError' }),
        ).toEqual(false);
      });
    });
  });

  given('[case2] the aws fault, WRAPPED by a message that hides it', () => {
    /**
     * .what = a wrapper that keeps the cause and says naught about it
     * .why = the only shape that makes the chain walk bite.
     *        `executeLambdaInvocation.ts:63` interpolates `${error.message}`, so
     *        a top-level read suffices — but that is a FORMAT CHOICE in a peer
     *        file, and `:76` in the same `catch` ladder already declines to
     *        interpolate. the walk makes that edit harmless.
     */
    const genWrappedFault = (): Error => {
      const cause = new Error('Could not load credentials from any providers');
      cause.name = 'CredentialsProviderError';

      const wrapper = new Error('lambda invocation failed');
      wrapper.name = 'LambdaEndpointError';
      (wrapper as { cause?: unknown }).cause = cause;
      return wrapper;
    };

    when('[t0] the detector reads it', () => {
      // ✅ bite-probed: reduce `getIsCredentialsError` to its top-level read and
      //    this goes red, where `[case12]`'s end-to-end block stays green
      then('the fault is found through the cause', () => {
        expect(getIsCredentialsError(genWrappedFault())).toEqual(true);
      });
    });

    when('[t1] the cause is carried in helpful-errors metadata', () => {
      // this repo's wrappers put the cause under `metadata`, never on the
      // standard `Error.cause` — so a standard-field-only walk misses every
      // error this sdk raises.
      then('the fault is found there too', () => {
        const cause = new Error(
          'Could not load credentials from any providers',
        );
        cause.name = 'CredentialsProviderError';
        const wrapper = new ConstraintError('lambda invocation failed', {
          cause,
        });

        expect(getIsCredentialsError(wrapper)).toEqual(true);
      });
    });

    when('[t2] the cause chain loops back on itself', () => {
      // a self-referential cause recurses forever; the visited set bars it
      then('the walk terminates', () => {
        const looped = new Error('lambda invocation failed');
        (looped as { cause?: unknown }).cause = looped;

        expect(getIsCredentialsError(looped)).toEqual(false);
      });
    });

    when('[t3] the cause chain loops through a SECOND error', () => {
      /**
       * 🔴 a one-step `cause === error` check catches `A.cause = A` and no
       * longer cycle. here `A.cause = B` and `B.cause = A`, so each step
       * compares unequal and the walk recurses to `RangeError: Maximum call
       * stack size exceeded` — which REPLACES the real error with a crash that
       * names neither the fault nor the fix.
       *
       * ⚠️ probed both ways: the visited `Set` ✅ green · `cause === error`
       *    🔴 `RangeError` (`rule.require.clamp-edge-cases`).
       */
      then('the walk terminates, rather than overflows the stack', () => {
        const first = new Error('lambda invocation failed');
        const second = new Error('transport closed');
        (first as { cause?: unknown }).cause = second;
        (second as { cause?: unknown }).cause = first;

        expect(getIsCredentialsError(first)).toEqual(false);
      });

      then('a credential fault INSIDE a cycle is still detected', () => {
        // the set BOUNDS the walk; it must not truncate it — every distinct
        // error is visited once before the repeat halts the descent
        const outer = new Error('lambda invocation failed');
        const inner = new Error(
          'Could not load credentials from any providers',
        );
        (outer as { cause?: unknown }).cause = inner;
        (inner as { cause?: unknown }).cause = outer;

        expect(getIsCredentialsError(outer)).toEqual(true);
      });
    });
  });

  given('[case4] a HANDLER fault whose own vocabulary is credentials', () => {
    /**
     * 🔴 the false positive an unguarded message arm produces — and it is what
     * an auth endpoint answers.
     *
     * `onSerialized({ at: 'cloud' })` wraps `askLambdaEndpoint` in the credential
     * `.catch` (`runLambdaEndpoint.onSerialized.ts:273`), and
     * `getParsedResponse.ts:89,122` hydrates a handler's caller fault into a
     * thrown bare `ConstraintError` carrying the handler's own message. so an
     * endpoint whose domain IS credentials rejects with the word in it.
     *
     * ⚠️ the harm is a REPLACEMENT: the developer is handed
     *    `LambdaCredentialsAbsentError` plus *"run keyrack unlock"*, and the real
     *    validation message survives only under `cause`. a confident wrong hint
     *    costs more than an absent one (`rule.require.errors-name-the-fix`).
     *
     * ✅ probed both ways: guarded by `isAwsRaised` ✅ green · applied to every
     *    error 🔴 `expected false, received true`.
     */
    when('[t0] the handler rejects with the word in its own message', () => {
      then('it is NOT read as an aws credentials fault', () => {
        // exactly what `getParsedResponse` constructs on the caller-fault path
        const hydrated = new ConstraintError(
          'credential is invalid for this surfer',
          { errorType: 'ConstraintError' },
        );

        expect(getIsCredentialsError(hydrated)).toEqual(false);
      });
    });

    when('[t1] the mapper meets it at the boundary', () => {
      then('it rethrows the handler fault, untouched', async () => {
        const hydrated = new ConstraintError(
          'the credentials record is absent for this surfer',
          {},
        );

        const error = await getError(
          (async () =>
            throwIfCredentialsError({
              error: hydrated,
              message: 'aws credentials are absent or expired',
              access: 'prep',
              metadata: {},
            }))(),
        );

        // identity, never merely the class — the developer keeps the handler's
        // own message and stack
        expect(error).toBe(hydrated);
        expect(error.constructor.name).toEqual('ConstraintError');
      });
    });

    when('[t2] the SAME wrapper carries a real aws fault beneath it', () => {
      // 🔴 the anti-vacuous half — a guard that barred every `HelpfulError`
      //    outright passes `[t0]` and `[t1]` and goes blind to the wrapped
      //    fault. the guard narrows the MESSAGE read, never the descent.
      then('the walk still finds it through the cause', () => {
        const cause = new Error(
          'Could not load credentials from any providers',
        );
        cause.name = 'CredentialsProviderError';

        const hydrated = new ConstraintError(
          'credential is invalid for this surfer',
          { cause },
        );

        expect(getIsCredentialsError(hydrated)).toEqual(true);
      });
    });
  });

  given('[case3] the mapper, at a boundary', () => {
    const genAwsCredentialsFault = (): Error => {
      const error = new Error('Could not load credentials from any providers');
      error.name = 'CredentialsProviderError';
      return error;
    };

    when('[t0] the error IS a credentials fault', () => {
      then('it is renamed, hinted, and keeps its cause', async () => {
        const error = await getError(
          (async () =>
            throwIfCredentialsError({
              error: genAwsCredentialsFault(),
              message: 'aws credentials are absent or expired',
              access: 'prep',
              metadata: { service: 'svc-example' },
            }))(),
        );

        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.constructor.name).toEqual('LambdaCredentialsAbsentError');

        const metadata = (error as ConstraintError).metadata as Record<
          string,
          unknown
        >;

        // 🔴 the hint is the assertion with teeth — aws's own message already
        //    holds the word `credentials`, so a message check passes on the RAW
        //    error and proves naught (`rule.require.errors-name-the-fix`).
        expect(String(metadata.hint)).toContain('keyrack unlock');

        // the caller's own metadata rides along
        expect(metadata.service).toEqual('svc-example');
        expect((metadata.cause as Error).name).toEqual(
          'CredentialsProviderError',
        );
      });
    });

    when('[t1] the hint names the env the CALLER addressed', () => {
      // 🔴 `onSerialized({ at: 'cloud' })` reaches `prod` routinely, and a hint
      //    that names the wrong env reads authoritative — it sends the developer
      //    to unlock a credential that was never absent.
      then('a prod caller is told to unlock prod', async () => {
        const error = await getError(
          (async () =>
            throwIfCredentialsError({
              error: genAwsCredentialsFault(),
              message: 'aws credentials are absent or expired',
              access: 'prod',
              metadata: {},
            }))(),
        );

        const metadata = (error as ConstraintError).metadata as Record<
          string,
          unknown
        >;
        expect(String(metadata.hint)).toContain('--env prod');
        expect(String(metadata.hint)).not.toContain('--env prep');
      });
    });

    when('[t2] the error is NOT a credentials fault', () => {
      then('it rethrows the very same object, untouched', async () => {
        const original = new Error('Rate exceeded');
        original.name = 'TooManyRequestsException';

        const error = await getError(
          (async () =>
            throwIfCredentialsError({
              error: original,
              message: 'aws credentials are absent or expired',
              access: 'prep',
              metadata: {},
            }))(),
        );

        // 🔴 the anti-vacuous clamp — a mapper that named every fault a
        //    credentials fault passes `[t0]` and tells a developer to unlock
        //    their keyrack when the endpoint was rate-limited. it asserts
        //    IDENTITY, since a re-wrap loses the stack the caller came for.
        expect(error).toBe(original);
        expect(error).not.toBeInstanceOf(ConstraintError);
      });
    });
  });
});
