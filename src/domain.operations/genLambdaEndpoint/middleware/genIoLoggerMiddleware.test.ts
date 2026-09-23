import { DomainEntity } from 'domain-objects';
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
   * ⚠️ .what = this case builds a request state that NEITHER shipped chain produces today
   * .why = `onError` reads `request.response`, and in both `forApiGateway` and
   *        `forAskEndpoint` this middleware is registered at a HIGHER array index than the
   *        error builders — so middy's hook reversal runs it BEFORE they set the response,
   *        and `request.response` is always `undefined` there. the state below is injected by
   *        hand
   *
   * .note = so read this case for what it is: a UNIT test of the branch's own logic, never
   *         evidence that the branch is reachable in a composed chain. to read it as the
   *         latter is the false-confidence pattern this repo already retired once
   *         (rule.require.snapshots-deny-volatile-not-allow-expected)
   *
   * .why kept = the branch goes live the moment the F32 header-order reorder lands, and this
   *             case is the coverage that reorder needs on day one. the honest fix is the
   *             reorder, and its blast radius sits outside this bound — so the case stays and
   *             states its own limit, rather than vanish and take the coverage with it
   */
  given('[case3] onError with an INJECTED response', () => {
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

        expect(mockLog.debug).toHaveBeenCalledWith('handler.output', {
          response: { statusCode: 400 },
        });
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

        expect(mockLog.debug).toHaveBeenCalledWith('handler.output', {
          errorMessage: 'test error',
          stackTrace: error.stack,
        });
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
