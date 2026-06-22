import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { genContextLogTrail } from 'sdk-logs';
import { getError, given, then, when } from 'test-fns';

import { askLambdaEndpoint } from './askLambdaEndpoint';

/**
 * .what = generates test log context
 * .why = provides valid ContextLogTrail for tests without trail propagation needs
 */
const genTestLog = () => genContextLogTrail({ trail: null, env: null });

/**
 * .what = masks dynamic exids in error snapshots
 * .why = exids are generated at runtime, change between test runs
 */
const maskExid = (input: {
  message: string;
  metadata?: Record<string, unknown>;
}) => ({
  message: input.message.replace(/exid:[a-f0-9-]+/g, 'exid:[masked]'),
  metadata: input.metadata
    ? { ...input.metadata, exid: '[masked]' }
    : undefined,
});

// mock the aws sdk
jest.mock('@aws-sdk/client-lambda');

const MockedLambdaClient = LambdaClient as jest.MockedClass<
  typeof LambdaClient
>;
const MockedInvokeCommand = InvokeCommand as jest.MockedClass<
  typeof InvokeCommand
>;

describe('askLambdaEndpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  given('[case1] successful invocation', () => {
    when('[t0] lambda returns valid response', () => {
      then('it should return parsed response', async () => {
        // arrange
        const mockResponse = { id: 'user-123', name: 'Alice' };
        const mockSend = jest.fn().mockResolvedValue({
          StatusCode: 200,
          Payload: Buffer.from(JSON.stringify(mockResponse)),
        });
        MockedLambdaClient.mockImplementation(
          () => ({ send: mockSend }) as unknown as LambdaClient,
        );

        // act
        const result = await askLambdaEndpoint<
          { userId: string },
          { id: string; name: string }
        >(
          {
            which: { service: 'svc-user', function: 'getUser' },
            event: { userId: 'user-123' },
          },
          {
            ...genTestLog(),
            env: { access: 'test' },
          },
        );

        // assert
        expect(result).toEqual(mockResponse);
        expect(result).toMatchSnapshot();
        expect(MockedInvokeCommand).toHaveBeenCalledTimes(1);
      });
    });
  });

  given('[case2] lambda returns function error', () => {
    when('[t0] lambda response has FunctionError', () => {
      then('it should throw with error details', async () => {
        // arrange
        const errorPayload = {
          errorMessage: 'User not found',
          errorType: 'NotFoundError',
        };
        const mockSend = jest.fn().mockResolvedValue({
          StatusCode: 200,
          FunctionError: 'Unhandled',
          Payload: Buffer.from(JSON.stringify(errorPayload)),
        });
        MockedLambdaClient.mockImplementation(
          () => ({ send: mockSend }) as unknown as LambdaClient,
        );

        // act
        const error = await getError(async () =>
          askLambdaEndpoint(
            {
              which: { service: 'svc-user', function: 'getUser' },
              event: { userId: 'unknown' },
            },
            {
              ...genTestLog(),
              env: { access: 'test' },
            },
          ),
        );

        // assert
        expect(error).toBeInstanceOf(Error);
        const errorWithMeta = error as Error & {
          metadata?: Record<string, unknown>;
        };
        expect(
          maskExid({
            message: errorWithMeta.message,
            metadata: errorWithMeta.metadata,
          }),
        ).toMatchSnapshot();
      });
    });
  });

  given('[case3] trail propagation', () => {
    when('[t0] context has trail exid', () => {
      then('it should include exid in payload', async () => {
        // arrange
        const mockSend = jest.fn().mockResolvedValue({
          StatusCode: 200,
          Payload: Buffer.from(JSON.stringify({ success: true })),
        });
        MockedLambdaClient.mockImplementation(
          () => ({ send: mockSend }) as unknown as LambdaClient,
        );

        const logWithTrail = genContextLogTrail({
          trail: { exid: 'test-exid-123', stack: [] },
          env: null,
        });

        // act
        await askLambdaEndpoint(
          {
            which: { service: 'svc-test', function: 'testFn' },
            event: { data: 'test' },
          },
          {
            ...logWithTrail,
            env: { access: 'test' },
          },
        );

        // assert - verify InvokeCommand was called with payload that has trail
        const invokeCall = MockedInvokeCommand.mock.calls[0];
        expect(invokeCall).toBeDefined();
        const invokeInput = invokeCall?.[0];
        expect(invokeInput?.Payload).toBeDefined();
        const payloadStr = Buffer.from(
          invokeInput?.Payload as Uint8Array,
        ).toString();
        const payload = JSON.parse(payloadStr);
        expect(payload.trail.exid).toBe('test-exid-123');
      });
    });
  });

  given('[case4] custom lambda client', () => {
    when('[t0] context provides lambda client', () => {
      then('it should use provided client', async () => {
        // arrange
        const customSend = jest.fn().mockResolvedValue({
          StatusCode: 200,
          Payload: Buffer.from(JSON.stringify({ custom: true })),
        });
        const customClient = { send: customSend } as unknown as LambdaClient;

        // act
        const result = await askLambdaEndpoint(
          {
            which: { service: 'svc-custom', function: 'customFn' },
            event: {},
          },
          {
            ...genTestLog(),
            env: { access: 'test' },
            aws: { lambda: { sdk: customClient } },
          },
        );

        // assert
        expect(result).toEqual({ custom: true });
        expect(result).toMatchSnapshot();
        expect(customSend).toHaveBeenCalledTimes(1);
        // verify default client was not created
        expect(MockedLambdaClient).not.toHaveBeenCalled();
      });
    });
  });

  given('[case5] function name generation', () => {
    when('[t0] service and function provided', () => {
      then('it should generate correct function name', async () => {
        // arrange
        const mockSend = jest.fn().mockResolvedValue({
          StatusCode: 200,
          Payload: Buffer.from(JSON.stringify({})),
        });
        MockedLambdaClient.mockImplementation(
          () => ({ send: mockSend }) as unknown as LambdaClient,
        );

        // act
        await askLambdaEndpoint(
          {
            which: { service: 'svc-invoice', function: 'createInvoice' },
            event: {},
          },
          {
            ...genTestLog(),
            env: { access: 'prod' },
          },
        );

        // assert
        const invokeCall = MockedInvokeCommand.mock.calls[0];
        const invokeInput = invokeCall?.[0];
        expect(invokeInput?.FunctionName).toBe(
          'svc-invoice-prod-createInvoice',
        );
        // snapshot for contract exhaustiveness (function name format)
        expect({
          functionName: invokeInput?.FunctionName,
        }).toMatchSnapshot();
      });
    });
  });

  given('[case6] lambda invocation failure paths', () => {
    when('[t0] lambda returns 404 (function not found)', () => {
      then('it should throw with actionable hint', async () => {
        // arrange
        const mockSend = jest.fn().mockResolvedValue({
          StatusCode: 404,
          Payload: Buffer.from(''),
        });
        MockedLambdaClient.mockImplementation(
          () => ({ send: mockSend }) as unknown as LambdaClient,
        );

        // act
        const error = await getError(async () =>
          askLambdaEndpoint(
            {
              which: { service: 'svc-absent', function: 'absentFn' },
              event: {},
            },
            {
              ...genTestLog(),
              env: { access: 'test' },
            },
          ),
        );

        // assert
        expect(error.message).toContain('function not found');
        expect(error.message).toContain('verify service name');
        // snapshot full error for contract visibility
        const errorWithMeta = error as Error & {
          metadata?: Record<string, unknown>;
        };
        expect(
          maskExid({
            message: errorWithMeta.message,
            metadata: errorWithMeta.metadata,
          }),
        ).toMatchSnapshot();
      });
    });

    when('[t1] lambda returns 403 (access denied)', () => {
      then('it should throw with IAM permission hint', async () => {
        // arrange
        const mockSend = jest.fn().mockResolvedValue({
          StatusCode: 403,
          Payload: Buffer.from(''),
        });
        MockedLambdaClient.mockImplementation(
          () => ({ send: mockSend }) as unknown as LambdaClient,
        );

        // act
        const error = await getError(async () =>
          askLambdaEndpoint(
            {
              which: { service: 'svc-denied', function: 'deniedFn' },
              event: {},
            },
            {
              ...genTestLog(),
              env: { access: 'test' },
            },
          ),
        );

        // assert
        expect(error.message).toContain('access denied');
        expect(error.message).toContain('IAM permissions');
        const errorWithMeta = error as Error & {
          metadata?: Record<string, unknown>;
        };
        expect(
          maskExid({
            message: errorWithMeta.message,
            metadata: errorWithMeta.metadata,
          }),
        ).toMatchSnapshot();
      });
    });

    when('[t2] lambda returns 429 (rate limited)', () => {
      then('it should throw with backoff hint', async () => {
        // arrange
        const mockSend = jest.fn().mockResolvedValue({
          StatusCode: 429,
          Payload: Buffer.from(''),
        });
        MockedLambdaClient.mockImplementation(
          () => ({ send: mockSend }) as unknown as LambdaClient,
        );

        // act
        const error = await getError(async () =>
          askLambdaEndpoint(
            {
              which: { service: 'svc-throttle', function: 'throttleFn' },
              event: {},
            },
            {
              ...genTestLog(),
              env: { access: 'test' },
            },
          ),
        );

        // assert
        expect(error.message).toContain('rate limit');
        expect(error.message).toContain('backoff');
        const errorWithMeta = error as Error & {
          metadata?: Record<string, unknown>;
        };
        expect(
          maskExid({
            message: errorWithMeta.message,
            metadata: errorWithMeta.metadata,
          }),
        ).toMatchSnapshot();
      });
    });

    when('[t3] lambda returns 500 (internal error)', () => {
      then('it should throw with cloudwatch hint', async () => {
        // arrange
        const mockSend = jest.fn().mockResolvedValue({
          StatusCode: 500,
          Payload: Buffer.from(''),
        });
        MockedLambdaClient.mockImplementation(
          () => ({ send: mockSend }) as unknown as LambdaClient,
        );

        // act
        const error = await getError(async () =>
          askLambdaEndpoint(
            {
              which: { service: 'svc-error', function: 'errorFn' },
              event: {},
            },
            {
              ...genTestLog(),
              env: { access: 'test' },
            },
          ),
        );

        // assert
        expect(error.message).toContain('internal error');
        expect(error.message).toContain('cloudwatch');
        const errorWithMeta = error as Error & {
          metadata?: Record<string, unknown>;
        };
        expect(
          maskExid({
            message: errorWithMeta.message,
            metadata: errorWithMeta.metadata,
          }),
        ).toMatchSnapshot();
      });
    });

    when('[t4] lambda returns 504 (gateway timeout)', () => {
      then('it should throw with timeout hint', async () => {
        // arrange
        const mockSend = jest.fn().mockResolvedValue({
          StatusCode: 504,
          Payload: Buffer.from(''),
        });
        MockedLambdaClient.mockImplementation(
          () => ({ send: mockSend }) as unknown as LambdaClient,
        );

        // act
        const error = await getError(async () =>
          askLambdaEndpoint(
            {
              which: { service: 'svc-timeout', function: 'timeoutFn' },
              event: {},
            },
            {
              ...genTestLog(),
              env: { access: 'test' },
            },
          ),
        );

        // assert
        expect(error.message).toContain('gateway timeout');
        expect(error.message).toContain('exceeded timeout');
        const errorWithMeta = error as Error & {
          metadata?: Record<string, unknown>;
        };
        expect(
          maskExid({
            message: errorWithMeta.message,
            metadata: errorWithMeta.metadata,
          }),
        ).toMatchSnapshot();
      });
    });
  });
});
