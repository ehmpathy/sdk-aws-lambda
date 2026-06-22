import { BadRequestError, ConstraintError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import { genConstraintErrorMiddleware } from './genConstraintErrorMiddleware';

describe('genConstraintErrorMiddleware', () => {
  const createMockLog = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  given('[case1] BadRequestError thrown (standard handler)', () => {
    when('[t0] middleware handles error', () => {
      then('it should return error response object', async () => {
        const mockLog = createMockLog();
        const middleware = genConstraintErrorMiddleware();
        const error = new BadRequestError('Invalid input');
        const request = {
          event: {},
          error,
          response: undefined as unknown,
          context: { log: mockLog },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        // standard handler returns error object (lambda succeeds)
        expect(request.response).toEqual({
          errorMessage: error.message,
          errorType: 'BadRequestError',
        });
        // snapshot for contract visibility
        expect(request.response).toMatchSnapshot();
      });

      then('it should NOT log at error level', async () => {
        // BadRequestErrors should NOT be logged at error level
        // They are logged via ioLogMiddleware at debug level (handler.output)
        // This matches simple-lambda-handlers behavior
        const mockLog = createMockLog();
        const middleware = genConstraintErrorMiddleware();
        const error = new BadRequestError('Invalid input');
        const request = {
          event: {},
          error,
          response: undefined as unknown,
          context: { log: mockLog },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        expect(mockLog.error).not.toHaveBeenCalled();
      });
    });
  });

  given('[case2] BadRequestError thrown (apiGateway mode)', () => {
    when('[t0] middleware handles error', () => {
      then('it should return 400 with JSON body', async () => {
        const mockLog = createMockLog();
        const middleware = genConstraintErrorMiddleware({ apiGateway: true });
        const error = new BadRequestError('Invalid input');
        const request = {
          event: {},
          error,
          response: undefined as unknown,
          context: { log: mockLog },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        // apiGateway mode returns HTTP response
        expect(request.response).toEqual({
          statusCode: 400,
          body: JSON.stringify({
            errorMessage: error.message,
            errorType: 'BadRequestError',
          }),
          headers: { 'Content-Type': 'application/json' },
        });
        // snapshot for contract visibility
        expect(request.response).toMatchSnapshot();
      });
    });
  });

  given('[case3] generic Error thrown', () => {
    when('[t0] middleware handles error', () => {
      then(
        'it should NOT set response (pass through to InternalServiceError handler)',
        async () => {
          const mockLog = createMockLog();
          const middleware = genConstraintErrorMiddleware();
          const error = new Error('Database connection failed');
          const request = {
            event: {},
            error,
            response: undefined as unknown,
            context: { log: mockLog },
            internal: {},
          } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

          await middleware.onError!(request);

          // genConstraintErrorMiddleware only handles BadRequestError
          // generic errors pass through to genInternalServiceErrorMiddleware
          expect(request.response).toBeUndefined();
        },
      );

      then(
        'it should NOT log (logs are in InternalServiceError handler)',
        async () => {
          const mockLog = createMockLog();
          const middleware = genConstraintErrorMiddleware();
          const error = new Error('Database connection failed');
          const request = {
            event: {},
            error,
            response: undefined as unknown,
            context: { log: mockLog },
            internal: {},
          } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

          await middleware.onError!(request);

          expect(mockLog.error).not.toHaveBeenCalled();
        },
      );
    });
  });

  given('[case4] error with cause', () => {
    when('[t0] middleware handles error', () => {
      then('it should include causeMessage in response', async () => {
        const mockLog = createMockLog();
        const middleware = genConstraintErrorMiddleware();
        const cause = new Error('Connection refused');
        const error = new BadRequestError('Failed to validate user', { cause });
        const request = {
          event: {},
          error,
          response: undefined as unknown,
          context: { log: mockLog },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        expect(
          (request.response as { causeMessage?: string }).causeMessage,
        ).toBe('Connection refused');
      });
    });
  });

  given('[case5] no error in request', () => {
    when('[t0] middleware invoked', () => {
      then('it should not modify response', async () => {
        const mockLog = createMockLog();
        const middleware = genConstraintErrorMiddleware();
        const request = {
          event: {},
          error: undefined,
          response: undefined as unknown,
          context: { log: mockLog },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        expect(request.response).toBeUndefined();
      });
    });
  });

  given('[case6] error with name BadRequestError but not instanceof', () => {
    when('[t0] middleware handles error', () => {
      then('it should treat as BadRequestError', async () => {
        const mockLog = createMockLog();
        const middleware = genConstraintErrorMiddleware();
        const error = new Error('Custom bad request');
        error.name = 'BadRequestError';
        const request = {
          event: {},
          error,
          response: undefined as unknown,
          context: { log: mockLog },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        // getIsConstraintError checks name property
        expect(request.response).toEqual({
          errorMessage: 'Custom bad request',
          errorType: 'BadRequestError',
        });
      });
    });
  });

  given('[case7] error with metadata property', () => {
    when('[t0] middleware handles error', () => {
      then('it should include details in response', async () => {
        const mockLog = createMockLog();
        const middleware = genConstraintErrorMiddleware();
        // simulate an error with metadata property (as BadRequestError would have)
        const error = Object.assign(new Error('Invalid input'), {
          name: 'BadRequestError',
          metadata: { field: 'email', reason: 'invalid format' },
        });
        const request = {
          event: {},
          error,
          response: undefined as unknown,
          context: { log: mockLog },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        expect((request.response as { details?: unknown }).details).toEqual({
          field: 'email',
          reason: 'invalid format',
        });
      });
    });
  });

  given('[case8] ConstraintError thrown (standard handler)', () => {
    when('[t0] middleware handles error', () => {
      then('it should return error response object', async () => {
        const mockLog = createMockLog();
        const middleware = genConstraintErrorMiddleware();
        const error = new ConstraintError('Invalid input');
        const request = {
          event: {},
          error,
          response: undefined as unknown,
          context: { log: mockLog },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        // ConstraintError handled same as BadRequestError
        expect(request.response).toEqual({
          errorMessage: error.message,
          errorType: 'BadRequestError',
        });
        // snapshot for contract visibility
        expect(request.response).toMatchSnapshot();
      });

      then('it should NOT log at error level', async () => {
        const mockLog = createMockLog();
        const middleware = genConstraintErrorMiddleware();
        const error = new ConstraintError('Invalid input');
        const request = {
          event: {},
          error,
          response: undefined as unknown,
          context: { log: mockLog },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        expect(mockLog.error).not.toHaveBeenCalled();
      });
    });
  });

  given('[case9] ConstraintError thrown (apiGateway mode)', () => {
    when('[t0] middleware handles error', () => {
      then('it should return 400 with JSON body', async () => {
        const mockLog = createMockLog();
        const middleware = genConstraintErrorMiddleware({ apiGateway: true });
        const error = new ConstraintError('Invalid input');
        const request = {
          event: {},
          error,
          response: undefined as unknown,
          context: { log: mockLog },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        // apiGateway mode returns HTTP response
        expect(request.response).toEqual({
          statusCode: 400,
          body: JSON.stringify({
            errorMessage: error.message,
            errorType: 'BadRequestError',
          }),
          headers: { 'Content-Type': 'application/json' },
        });
        // snapshot for contract visibility
        expect(request.response).toMatchSnapshot();
      });
    });
  });

  given('[case10] error has name ConstraintError but is not instanceof', () => {
    when('[t0] middleware handles error', () => {
      then('it should treat as ConstraintError', async () => {
        const mockLog = createMockLog();
        const middleware = genConstraintErrorMiddleware();
        const error = new Error('Custom constraint');
        error.name = 'ConstraintError';
        const request = {
          event: {},
          error,
          response: undefined as unknown,
          context: { log: mockLog },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        // getIsConstraintError checks name property for ConstraintError too
        expect(request.response).toEqual({
          errorMessage: 'Custom constraint',
          errorType: 'BadRequestError',
        });
      });
    });
  });

  given('[case11] contemp caller (isContempCaller: true)', () => {
    when('[t0] ConstraintError thrown', () => {
      then(
        'it should return errorType: ConstraintError (modern semantics)',
        async () => {
          const mockLog = createMockLog();
          const middleware = genConstraintErrorMiddleware();
          const error = new ConstraintError('Invalid input');
          const request = {
            event: {},
            error,
            response: undefined as unknown,
            context: { log: mockLog, isContempCaller: true },
            internal: {},
          } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

          await middleware.onError!(request);

          // contemp callers receive contemp format with ConstraintError class
          expect(request.response).toEqual({
            error: {
              _serde: 'LambdaEndpointError::contemp',
              class: 'ConstraintError',
              message: error.message,
            },
          });
          // snapshot for contract visibility
          expect(request.response).toMatchSnapshot();
        },
      );
    });

    when('[t1] BadRequestError thrown (legacy error)', () => {
      then(
        'it should still return errorType: ConstraintError (modern semantics)',
        async () => {
          const mockLog = createMockLog();
          const middleware = genConstraintErrorMiddleware();
          const error = new BadRequestError('Invalid input');
          const request = {
            event: {},
            error,
            response: undefined as unknown,
            context: { log: mockLog, isContempCaller: true },
            internal: {},
          } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

          await middleware.onError!(request);

          // contemp callers receive contemp format with ConstraintError even for legacy BadRequestError
          expect(request.response).toEqual({
            error: {
              _serde: 'LambdaEndpointError::contemp',
              class: 'ConstraintError',
              message: error.message,
            },
          });
          // snapshot for contract visibility
          expect(request.response).toMatchSnapshot();
        },
      );
    });

    when('[t2] apiGateway mode', () => {
      then('it should return 400 with errorType: ConstraintError', async () => {
        const mockLog = createMockLog();
        const middleware = genConstraintErrorMiddleware({ apiGateway: true });
        const error = new ConstraintError('Invalid input');
        const request = {
          event: {},
          error,
          response: undefined as unknown,
          context: { log: mockLog, isContempCaller: true },
          internal: {},
        } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

        await middleware.onError!(request);

        // apiGateway mode returns HTTP response with contemp format for contemp callers
        expect(request.response).toEqual({
          statusCode: 400,
          body: JSON.stringify({
            error: {
              _serde: 'LambdaEndpointError::contemp',
              class: 'ConstraintError',
              message: error.message,
            },
          }),
          headers: { 'Content-Type': 'application/json' },
        });
        // snapshot for contract visibility
        expect(request.response).toMatchSnapshot();
      });
    });
  });

  given('[case12] ancient caller (no isContempCaller flag)', () => {
    when('[t0] ConstraintError thrown', () => {
      then(
        'it should return errorType: BadRequestError (backwards compat)',
        async () => {
          const mockLog = createMockLog();
          const middleware = genConstraintErrorMiddleware();
          const error = new ConstraintError('Invalid input');
          const request = {
            event: {},
            error,
            response: undefined as unknown,
            context: { log: mockLog }, // no isContempCaller flag
            internal: {},
          } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

          await middleware.onError!(request);

          // ancient callers receive BadRequestError for backwards compat
          expect(request.response).toEqual({
            errorMessage: error.message,
            errorType: 'BadRequestError',
          });
        },
      );
    });

    when('[t1] isContempCaller explicitly false', () => {
      then(
        'it should return errorType: BadRequestError (backwards compat)',
        async () => {
          const mockLog = createMockLog();
          const middleware = genConstraintErrorMiddleware();
          const error = new ConstraintError('Invalid input');
          const request = {
            event: {},
            error,
            response: undefined as unknown,
            context: { log: mockLog, isContempCaller: false },
            internal: {},
          } as unknown as Parameters<NonNullable<typeof middleware.onError>>[0];

          await middleware.onError!(request);

          // explicitly ancient callers receive BadRequestError
          expect(request.response).toEqual({
            errorMessage: error.message,
            errorType: 'BadRequestError',
          });
        },
      );
    });
  });
});
