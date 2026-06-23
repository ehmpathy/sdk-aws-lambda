import { given, then, when } from 'test-fns';

import { genIoLoggerMiddleware } from './genIoLoggerMiddleware';

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

  given('[case3] onError hook with response', () => {
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
});
