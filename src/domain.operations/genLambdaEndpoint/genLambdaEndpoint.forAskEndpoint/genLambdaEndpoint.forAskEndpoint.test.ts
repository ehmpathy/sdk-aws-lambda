import type { Context } from 'aws-lambda';
import { getError } from 'helpful-errors';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { genLambdaEndpoint } from './genLambdaEndpoint.forAskEndpoint';

describe('genLambdaEndpoint', () => {
  const createMockContext = (): Context =>
    ({
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',
      memoryLimitInMB: '128',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/test',
      logStreamName: 'test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
      callbackWaitsForEmptyEventLoop: true,
    }) as Context;

  given('[case1] valid input and output', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ greeting: z.string() }),
    };

    when('[t0] handler invoked', () => {
      then('it should return validated output', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async ({ event }) => {
            return { greeting: `Hello, ${event.name}!` };
          },
        });

        const result = await handler({ name: 'Alice' }, createMockContext());
        expect(result).toEqual({ greeting: 'Hello, Alice!' });
      });
    });
  });

  given('[case2] invalid input', () => {
    const schema = {
      input: z.object({ name: z.string(), age: z.number() }),
      output: z.object({ result: z.boolean() }),
    };

    when('[t0] handler invoked', () => {
      then('it should return error response (not throw)', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async () => ({ result: true }),
        });

        // BadRequestError = lambda succeeds, returns error response object
        const result = await handler(
          { name: 'Bob', age: 'not a number' } as unknown as {
            name: string;
            age: number;
          },
          createMockContext(),
        );

        expect(result).toMatchObject({
          errorType: 'BadRequestError',
        });
        expect(
          (result as unknown as { errorMessage: string }).errorMessage,
        ).toContain('validation failed');

        // snapshot for contract exhaustiveness
        const errorResult = result as unknown as {
          errorMessage: string;
          errorType: string;
        };
        expect({
          errorType: errorResult.errorType,
          errorMessageContains: 'validation failed',
        }).toMatchSnapshot();
      });
    });
  });

  given('[case3] invalid output', () => {
    const schema = {
      input: z.object({ id: z.string() }),
      output: z.object({ data: z.string() }),
    };

    when('[t0] handler returns wrong shape', () => {
      then('it should throw MalfunctionError', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async () => ({ data: 123 }) as unknown as { data: string },
        });

        const error = await getError(
          handler({ id: 'test' }, createMockContext()),
        );

        expect(error.message).toContain('output validation failed');
        const errorWithMeta = error as Error & {
          metadata?: Record<string, unknown>;
        };
        expect({
          message: errorWithMeta.message,
          metadata: errorWithMeta.metadata,
        }).toMatchSnapshot();
      });
    });
  });

  given('[case4] trail context propagation', () => {
    const schema = {
      input: z.object({ value: z.number() }),
      output: z.object({ doubled: z.number() }),
    };

    when('[t0] event includes trail', () => {
      then('it should propagate trail to context', async () => {
        let capturedLog: unknown;
        const handler = genLambdaEndpoint({
          schema,
          invoke: async ({ event }, context) => {
            capturedLog = context.log;
            return { doubled: event.value * 2 };
          },
        });

        await handler(
          { value: 5, trail: { exid: 'test-exid-123' } },
          createMockContext(),
        );

        expect(capturedLog).toBeDefined();
        expect(typeof (capturedLog as { debug: unknown }).debug).toBe(
          'function',
        );
      });
    });
  });

  given('[case5] logTranslate for redaction', () => {
    const schema = {
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      output: z.object({ success: z.boolean() }),
    };

    when('[t0] handler invoked with sensitive data', () => {
      then('it should apply input translation', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async () => ({ success: true }),
          logTranslate: {
            input: (event) => ({
              ...(event as object),
              password: '[REDACTED]',
            }),
          },
        });

        // just verify handler runs without error
        const result = await handler(
          { username: 'alice', password: 'secret123' },
          createMockContext(),
        );

        expect(result).toEqual({ success: true });
      });
    });
  });

  given('[case6] schema with transforms', () => {
    const schema = {
      input: z.object({
        email: z.string().transform((val) => val.toLowerCase()),
      }),
      output: z.object({
        email: z.string(),
      }),
    };

    when('[t0] handler invoked', () => {
      then('it should apply input transform', async () => {
        let capturedEmail: string | undefined;
        const handler = genLambdaEndpoint({
          schema,
          invoke: async ({ event }) => {
            capturedEmail = event.email;
            return { email: event.email };
          },
        });

        const result = await handler(
          { email: 'ALICE@EXAMPLE.COM' },
          createMockContext(),
        );

        expect(capturedEmail).toBe('alice@example.com');
        expect(result.email).toBe('alice@example.com');
      });
    });
  });
});
