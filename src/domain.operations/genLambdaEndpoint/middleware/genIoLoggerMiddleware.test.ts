import { DomainEntity } from 'domain-objects';
import {
  BadRequestError,
  ConstraintError,
  MalfunctionError,
} from 'helpful-errors';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { genIoLoggerMiddleware } from './genIoLoggerMiddleware';

/**
 * .what = a dobj used ONLY by `[case8]`, to put a live instance at both io borders
 */
interface LoggedRider {
  uuid: string;
  handle: string;
}
class LoggedRider extends DomainEntity<LoggedRider> implements LoggedRider {
  public static primary = ['uuid'] as const;
  public static unique = ['handle'] as const;
  public static schema = z.object({ uuid: z.string(), handle: z.string() });
}

describe('genIoLoggerMiddleware', () => {
  const createMockLog = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  given('[case1] before hook logs input', () => {
    when('[t0] middleware invoked', () => {
      then('it should log handler.input', async () => {
        const mockLog = createMockLog();
        const middleware = genIoLoggerMiddleware();
        const request = {
          event: { name: 'test' },
          context: { log: mockLog },
          response: undefined,
          error: undefined as unknown as Error,
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.before>>[0];

        await middleware.before!(request);

        expect(mockLog.debug).toHaveBeenCalledWith('handler.input', {
          event: { name: 'test' },
        });
      });
    });
  });

  given('[case2] after hook logs output', () => {
    when('[t0] middleware invoked', () => {
      then('it should log handler.output', async () => {
        const mockLog = createMockLog();
        const middleware = genIoLoggerMiddleware();
        const request = {
          event: {},
          response: { success: true },
          context: { log: mockLog },
          error: undefined as unknown as Error,
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.after>>[0];

        await middleware.after!(request);

        expect(mockLog.debug).toHaveBeenCalledWith('handler.output', {
          response: { success: true },
        });
      });
    });
  });

  /**
   * .what = this case builds a request state that neither shipped chain produces today
   * .why = `onError` reads `request.response`, and in both `forApiGateway` and
   *        `forAsk` this middleware is registered at a higher array index than the
   *        error builders — so middy's hook reversal runs it before they set the response, and
   *        `request.response` is always `undefined` there. the state below is injected by hand
   *
   * .note = read this case for what it is: a unit test of the branch's own logic, never
   *         evidence that the branch is reachable in a composed chain
   *
   * .why kept = the branch goes live the moment the chain-order repair lands, and this case is
   *         the coverage that repair needs on day one. its blast radius sits outside this
   *         bound, so the case stays and states its own limit rather than vanish and take the
   *         coverage with it
   *         (`.dream/v2026_09_22.fix.no-cors-or-owasp-headers-on-error-responses.md`)
   */
  given('[case3] onError with an injected response', () => {
    when('[t0] middleware invoked', () => {
      then('it should log the response', async () => {
        const mockLog = createMockLog();
        const middleware = genIoLoggerMiddleware();
        const request = {
          event: {},
          response: { statusCode: 400 },
          error: new Error('test error'),
          context: { log: mockLog },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        // a failure logs at its class's level, never at debug (sdk-aws-lambda#77)
        expect(mockLog.error).toHaveBeenCalledWith('handler.output', {
          response: { statusCode: 400 },
        });
        expect(mockLog.debug).not.toHaveBeenCalled();
      });
    });
  });

  given('[case4] onError hook without response', () => {
    when('[t0] middleware invoked', () => {
      then('it should log error message and stack', async () => {
        const mockLog = createMockLog();
        const middleware = genIoLoggerMiddleware();
        const error = new Error('test error');
        const request = {
          event: {},
          response: undefined,
          error,
          context: { log: mockLog },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        expect(mockLog.error).toHaveBeenCalledWith('handler.output', {
          errorMessage: 'test error',
          stackTrace: error.stack,
        });
        expect(mockLog.debug).not.toHaveBeenCalled();
      });
    });
  });

  /**
   * .what = the failure line's level, per error class
   * .why = a handled failure reads a success to aws, so a debug line beside each success hid 24
   *        prod failures from on-call (sdk-aws-lambda#77). this clamps the level by class
   */
  given('[case9] onError, per error class', () => {
    const asErrorRequest = (input: {
      error: Error;
      log: ReturnType<typeof createMockLog>;
    }) =>
      ({
        event: {},
        response: undefined,
        error: input.error,
        context: { log: input.log },
        internal: {},
      }) as unknown as Parameters<
        NonNullable<ReturnType<typeof genIoLoggerMiddleware>['onError']>
      >[0];

    when('[t0] the handler threw a ConstraintError', () => {
      then('handler.output logs at warn, not debug', async () => {
        const mockLog = createMockLog();
        const error = new ConstraintError('the surf spot is closed');
        await genIoLoggerMiddleware().onError(
          asErrorRequest({ error, log: mockLog }),
        );
        expect(mockLog.warn).toHaveBeenCalledWith('handler.output', {
          errorMessage: error.message,
          stackTrace: error.stack,
        });
        expect(mockLog.debug).not.toHaveBeenCalled();
        expect(mockLog.error).not.toHaveBeenCalled();
      });
    });

    when('[t1] the handler threw a BadRequestError', () => {
      then('handler.output logs at warn', async () => {
        const mockLog = createMockLog();
        const error = new BadRequestError('a board size is required');
        await genIoLoggerMiddleware().onError(
          asErrorRequest({ error, log: mockLog }),
        );
        expect(mockLog.warn).toHaveBeenCalledWith(
          'handler.output',
          expect.objectContaining({ errorMessage: error.message }),
        );
        expect(mockLog.debug).not.toHaveBeenCalled();
      });
    });

    when('[t3] the handler threw a non-Error value', () => {
      then(
        'handler.output logs at error, and names the thrown value',
        async () => {
          const values: unknown[] = [
            'upstream said no',
            '',
            0,
            null,
            false,
            undefined,
          ];
          await Promise.all(
            values.map(async (value) => {
              const mockLog = createMockLog();
              await genIoLoggerMiddleware().onError(
                asErrorRequest({ error: value as Error, log: mockLog }),
              );
              expect(mockLog.error).toHaveBeenCalledWith('handler.output', {
                errorMessage: String(value),
                stackTrace: null,
              });
              expect(mockLog.debug).not.toHaveBeenCalled();
            }),
          );
        },
      );
    });

    when('[t2] the handler threw a MalfunctionError', () => {
      then('handler.output logs at error', async () => {
        const mockLog = createMockLog();
        const error = new MalfunctionError('the wave report feed is down');
        await genIoLoggerMiddleware().onError(
          asErrorRequest({ error, log: mockLog }),
        );
        expect(mockLog.error).toHaveBeenCalledWith(
          'handler.output',
          expect.objectContaining({ errorMessage: error.message }),
        );
        expect(mockLog.debug).not.toHaveBeenCalled();
        expect(mockLog.warn).not.toHaveBeenCalled();
      });
    });
  });

  /**
   * .what = a failure thrown before trail put `log` on the context
   * .why = `forApiGateway`'s normalization runs ahead of trail and throws a ConstraintError for an
   *        event that is neither v1 nor v2. with no `log`, the failure line used to vanish
   *
   * .note = console is spied, never mocked away: the real console still runs
   */
  given('[case10] onError with no log in context', () => {
    when('[t0] a ConstraintError was thrown before trail', () => {
      then('the failure line goes to console.warn', async () => {
        const spyWarn = jest.spyOn(console, 'warn');
        try {
          const error = new ConstraintError('neither a v1 nor a v2 event');
          const request = {
            event: {},
            response: undefined,
            error,
            context: {},
            internal: {},
          } as unknown as Parameters<
            NonNullable<ReturnType<typeof genIoLoggerMiddleware>['onError']>
          >[0];
          await genIoLoggerMiddleware().onError(request);
          expect(spyWarn).toHaveBeenCalledWith('handler.output', {
            errorMessage: error.message,
            stackTrace: error.stack,
          });
        } finally {
          spyWarn.mockRestore();
        }
      });
    });

    when('[t1] a MalfunctionError was thrown before trail', () => {
      then('the failure line goes to console.error', async () => {
        const spyError = jest.spyOn(console, 'error');
        try {
          const error = new MalfunctionError('the normalizer broke');
          const request = {
            event: {},
            response: undefined,
            error,
            context: {},
            internal: {},
          } as unknown as Parameters<
            NonNullable<ReturnType<typeof genIoLoggerMiddleware>['onError']>
          >[0];
          await genIoLoggerMiddleware().onError(request);
          expect(spyError).toHaveBeenCalledWith(
            'handler.output',
            expect.objectContaining({ errorMessage: error.message }),
          );
        } finally {
          spyError.mockRestore();
        }
      });
    });
  });

  given('[case5] logTranslate redacts input', () => {
    when('[t0] middleware invoked', () => {
      then('it should apply input translation', async () => {
        const mockLog = createMockLog();
        const middleware = genIoLoggerMiddleware({
          logTranslate: {
            input: (event) => ({
              ...(event as object),
              password: '[REDACTED]',
            }),
          },
        });
        const request = {
          event: { username: 'alice', password: 'secret123' },
          context: { log: mockLog },
          response: undefined,
          error: undefined as unknown as Error,
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.before>>[0];

        await middleware.before!(request);

        expect(mockLog.debug).toHaveBeenCalledWith('handler.input', {
          event: { username: 'alice', password: '[REDACTED]' },
        });
      });
    });
  });

  given('[case6] logTranslate redacts output', () => {
    when('[t0] middleware invoked', () => {
      then('it should apply output translation', async () => {
        const mockLog = createMockLog();
        const middleware = genIoLoggerMiddleware({
          logTranslate: {
            output: (response) => ({
              ...(response as object),
              token: '[REDACTED]',
            }),
          },
        });
        const request = {
          event: {},
          response: { success: true, token: 'jwt-token' },
          context: { log: mockLog },
          error: undefined as unknown as Error,
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.after>>[0];

        await middleware.after!(request);

        expect(mockLog.debug).toHaveBeenCalledWith('handler.output', {
          response: { success: true, token: '[REDACTED]' },
        });
      });
    });

    /**
     * .what = pins the scope of `logTranslate.output`: the response, never a thrown error
     * .why = a consumer that redacts must be able to read, from a test, what its translate covers.
     *        the failure line carries the error's own message raw, as `handler.error` already does
     *        for a server fault; a translate for the error branch is a caught dream
     *        (`.dream/2026_11_06.v2026-11-06-feat-log-translate-for-error-branch.dream.md`)
     */
    when('[t1] the handler threw, with an output translate configured', () => {
      then(
        'the translate is not called, and the failure line holds the raw message',
        async () => {
          const mockLog = createMockLog();
          const translate = jest.fn((response: unknown) => ({
            ...(response as object),
            token: '[REDACTED]',
          }));
          const middleware = genIoLoggerMiddleware({
            logTranslate: { output: translate },
          });
          const error = new ConstraintError('token jwt-token is expired');
          const request = {
            event: {},
            response: undefined,
            error,
            context: { log: mockLog },
            internal: {},
          } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

          await middleware.onError!(request);

          expect(translate).not.toHaveBeenCalled();
          expect(mockLog.warn).toHaveBeenCalledWith('handler.output', {
            errorMessage: error.message,
            stackTrace: error.stack,
          });
        },
      );
    });
  });

  given('[case7] no log in context', () => {
    when('[t0] middleware invoked without log', () => {
      then('it should not throw', async () => {
        const middleware = genIoLoggerMiddleware();
        const request = {
          event: {},
          context: {},
          response: undefined,
          error: undefined as unknown as Error,
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.before>>[0];

        await expect(middleware.before!(request)).resolves.not.toThrow();
      });
    });
  });

  /**
   * .what = a LIVE dobj instance at both io borders, measured through this middleware
   *
   * ⚠️ .why it is owed = every other case in this file hands the logger a plain object
   *    literal. this pr is the first that lets `request.event` and `request.response` hold a
   *    CLASS instance — `X.contract()` parses the wire into one — and a log transport
   *    serializes what it is handed
   *
   * ⇒ so the hazard is not a throw. it is a log line that reads `{}` while the handler
   *   behaved correctly: an observability failhide, invisible to every functional assertion
   *   in the suite (`rule.forbid.failhide`)
   *
   * .the row that carries the claim = `[t1]`. `[t0]` proves the value ARRIVES; only a
   *      serialize proves it SURVIVES, which is what an on-call engineer actually reads
   *      (rule.require.measure-the-value-you-emit — a claim about an emitted value owes a
   *      run, and this branch has been wrong four times by a read instead)
   *
   * ⚠️ .PROVEN BY PROBE, never by revert (rule.require.clamp-edge-cases). the guarded
   *    behavior is `domain-objects`', so there is no line of OURS to revert. instead the
   *    failhide shape was built by hand and fed to `[t1]`'s assertion:
   *
   *      probe                                          | result
   *      -----------------------------------------------|---------------------------
   *      a prop defined `enumerable: false`, serialized  | 🔴 1 red, and it is `[t1]`
   *
   *    ⇒ so the assertion discriminates. `[t0]` stayed green under the probe — correctly,
   *      since a stripped object still ARRIVES; that split is what makes the two rows two
   *
   * ⚠️ .this clamp guards an UPSTREAM property, so it is a canary rather than a contract. a
   *    `domain-objects` bump that re-defines its props non-enumerably turns this red here,
   *    rather than silent in a production log
   */
  given('[case8] a hydrated domain object at both borders', () => {
    // .as = the wire shape a caller sends, and the instance `X.contract()` parses it into
    const riderWire = { uuid: 'u1', handle: 'crush' };
    const rider = LoggedRider.contract().parse(riderWire);

    when('[t0] the instance flows through both hooks', () => {
      // .why ONE middleware + ONE log, shared = the rows grade one pass
      //      (rule.forbid.redundant-expensive-operations)
      const mockLog = createMockLog();
      const middleware = genIoLoggerMiddleware();
      const request = {
        event: rider,
        response: rider,
        context: { log: mockLog },
        error: undefined as unknown as Error,
        internal: {},
      } as unknown as Parameters<NonNullable<typeof middleware.after>>[0];

      then('the instance reaches the log, not a stripped copy', async () => {
        await middleware.before!(request);
        await middleware.after!(request);

        const [, inputPayload] = mockLog.debug.mock.calls[0] ?? [];
        const [, outputPayload] = mockLog.debug.mock.calls[1] ?? [];
        expect((inputPayload as { event: unknown }).event).toBeInstanceOf(
          LoggedRider,
        );
        expect((outputPayload as { response: unknown }).response).toBe(rider);
      });

      then(
        'its fields survive a serialize, so the log line is readable',
        () => {
          // ⚠️ this is the row a failhide would break. `withImmute` re-defines each prop, and a
          //    NON-enumerable definition would drop every field from `JSON.stringify` — the
          //    handler still correct, the log still emitted, and the payload empty
          expect(JSON.parse(JSON.stringify(rider))).toEqual(riderWire);
        },
      );
    });
  });
});
