import type { Context } from 'aws-lambda';
import { getError } from 'helpful-errors';
import { given, then, useThen, when } from 'test-fns';
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
      output: z.object({ salute: z.string() }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns salute', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async ({ event }) => {
            return { salute: `Hello, ${event.name}!` };
          },
        });

        return handler({ name: 'Alice' }, createMockContext());
      });

      then('it should return validated output', () => {
        expect(result).toEqual({ salute: 'Hello, Alice!' });
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case2] invalid input', () => {
    const schema = {
      input: z.object({ name: z.string(), age: z.number() }),
      output: z.object({ result: z.boolean() }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns error response', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async () => ({ result: true }),
        });

        // BadRequestError = lambda succeeds, returns error response object
        return handler(
          { name: 'Bob', age: 'not a number' } as unknown as {
            name: string;
            age: number;
          },
          createMockContext(),
        );
      });

      then('it should return BadRequestError type', () => {
        expect(result).toMatchObject({
          errorType: 'BadRequestError',
        });
      });

      then('error message indicates validation failure', () => {
        expect(
          (result as unknown as { errorMessage: string }).errorMessage,
        ).toContain('validation failed');
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
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
      const result = useThen('handler processes request', async () => {
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

        return handler(
          { username: 'alice', password: 'secret123' },
          createMockContext(),
        );
      });

      then('it should return success', () => {
        expect(result).toEqual({ success: true });
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
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
      let capturedEmail: string | undefined;

      const result = useThen('handler applies transform', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async ({ event }) => {
            capturedEmail = event.email;
            return { email: event.email };
          },
        });

        return handler({ email: 'ALICE@EXAMPLE.COM' }, createMockContext());
      });

      then('input is lowercased before handler', () => {
        expect(capturedEmail).toBe('alice@example.com');
      });

      then('output reflects transformed email', () => {
        expect(result.email).toBe('alice@example.com');
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case7] introspection request in prep env', () => {
    const schema = {
      input: z.object({ customerId: z.string() }),
      output: z.object({ name: z.string(), balance: z.number() }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns schema', async () => {
        const handler = genLambdaEndpoint(
          {
            schema,
            invoke: async () => ({ name: 'test', balance: 100 }),
          },
          { env: { access: 'prep' } },
        );

        return handler({ introspect: 'schema' } as any, createMockContext());
      });

      then('response contains input schema', () => {
        const response = result as unknown as {
          input: { type: string; properties: Record<string, unknown> };
        };
        expect(response.input.type).toBe('object');
        expect(response.input.properties.customerId).toBeDefined();
      });

      then('response contains output schema', () => {
        const response = result as unknown as {
          output: { type: string; properties: Record<string, unknown> };
        };
        expect(response.output.type).toBe('object');
        expect(response.output.properties.name).toBeDefined();
        expect(response.output.properties.balance).toBeDefined();
      });

      then('response matches snapshot', () => {
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case8] introspection request in prod env', () => {
    const schema = {
      input: z.object({ id: z.string() }),
      output: z.object({ value: z.number() }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns error response', async () => {
        const handler = genLambdaEndpoint(
          {
            schema,
            invoke: async () => ({ value: 42 }),
          },
          { env: { access: 'prod' } },
        );

        return handler({ introspect: 'schema' } as any, createMockContext());
      });

      then('returns BadRequestError type', () => {
        expect(result).toMatchObject({ errorType: 'BadRequestError' });
      });

      then('error message mentions prep environment', () => {
        expect(
          (result as unknown as { errorMessage: string }).errorMessage,
        ).toContain('prep');
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case9] introspection request without env config', () => {
    const schema = {
      input: z.object({ id: z.string() }),
      output: z.object({ value: z.number() }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns error response', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async () => ({ value: 42 }),
          // no env provided
        });

        return handler({ introspect: 'schema' } as any, createMockContext());
      });

      then('returns BadRequestError type', () => {
        expect(result).toMatchObject({ errorType: 'BadRequestError' });
      });

      then('error message mentions env', () => {
        expect(
          (result as unknown as { errorMessage: string }).errorMessage,
        ).toContain('env');
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case10] normal request with env config', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ salute: z.string() }),
    };

    when('[t0] handler invoked with normal payload', () => {
      const result = useThen('handler processes request', async () => {
        const handler = genLambdaEndpoint(
          {
            schema,
            invoke: async ({ event }) => ({ salute: `Hello, ${event.name}!` }),
          },
          { env: { access: 'prep' } },
        );

        return handler({ name: 'Bob' }, createMockContext());
      });

      then('passes through to handler as normal', () => {
        expect(result).toEqual({ salute: 'Hello, Bob!' });
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });
});
