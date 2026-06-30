import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { getError, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import {
  askLambdaEndpoint,
  asLambdaEndpoint,
  BadRequestError,
  forApiGateway,
  genApiGatewayEventNormalizationMiddleware,
  genConstraintErrorMiddleware,
  genIoLoggerMiddleware,
  genLambdaEndpoint,
  genTrailMiddleware,
  genZodEventValidationMiddleware,
  genZodOutputValidationMiddleware,
  LambdaEndpointError,
} from '../src/index';
import { invokeHandlerForTest } from '../src/__test_assets__/invokeHandlerForTest';

describe('sdk-aws-lambda', () => {
  given('[case1] public exports', () => {
    when('[t0] imports evaluated', () => {
      then('genLambdaEndpoint should be callable', () => {
        expect(typeof genLambdaEndpoint).toBe('function');
      });

      then('forApiGateway should be callable', () => {
        expect(typeof forApiGateway).toBe('function');
      });

      then('askLambdaEndpoint should be callable', () => {
        expect(typeof askLambdaEndpoint).toBe('function');
      });

      then('LambdaEndpointError should be constructable', () => {
        const error = new LambdaEndpointError('test', {
          endpoint: asLambdaEndpoint({
            service: 'svc',
            access: 'prep',
            function: 'fn',
          }),
          exid: null,
        });
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('BadRequestError should be constructable', () => {
        const error = new BadRequestError('test');
        expect(error).toBeInstanceOf(Error);
      });
    });
  });

  given('[case2] middleware exports', () => {
    when('[t0] imports evaluated', () => {
      then('genTrailMiddleware should be callable', () => {
        expect(typeof genTrailMiddleware).toBe('function');
      });

      then('genZodEventValidationMiddleware should be callable', () => {
        expect(typeof genZodEventValidationMiddleware).toBe('function');
      });

      then('genZodOutputValidationMiddleware should be callable', () => {
        expect(typeof genZodOutputValidationMiddleware).toBe('function');
      });

      then('genIoLoggerMiddleware should be callable', () => {
        expect(typeof genIoLoggerMiddleware).toBe('function');
      });

      then('genConstraintErrorMiddleware should be callable', () => {
        expect(typeof genConstraintErrorMiddleware).toBe('function');
      });

      then(
        'genApiGatewayEventNormalizationMiddleware should be callable',
        () => {
          expect(typeof genApiGatewayEventNormalizationMiddleware).toBe(
            'function',
          );
        },
      );
    });
  });

  given('[case3] genLambdaEndpoint handler', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ message: z.string() }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }) => ({
        message: `Hello, ${event.name}!`,
      }),
    });

    const mockContext = {
      functionName: 'test',
      awsRequestId: 'req-123',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123:function:test',
      memoryLimitInMB: '128',
      logGroupName: '/aws/lambda/test',
      logStreamName: 'stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
      callbackWaitsForEmptyEventLoop: true,
    } as Context;

    when('[t0] invoked with valid input', () => {
      then('it should return result', async () => {
        const result = await handler({ name: 'World' }, mockContext);
        expect(result.message).toBe('Hello, World!');
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] invoked with invalid input', () => {
      then('it returns error response (not throw)', async () => {
        // BadRequestError = lambda succeeds, returns error response object
        const result = await handler(
          { name: 123 } as unknown as { name: string },
          mockContext,
        );
        expect(result).toMatchObject({ errorType: 'BadRequestError' });
        expect(
          (result as unknown as { errorMessage: string }).errorMessage,
        ).toContain('validation failed');
        expect(result).toMatchSnapshot();
      });
    });

    when('[t2] invoked with null input', () => {
      then('it returns error response for null', async () => {
        // BadRequestError = lambda succeeds, returns error response object
        const result = await handler(
          null as unknown as { name: string },
          mockContext,
        );
        expect(result).toMatchObject({ errorType: 'BadRequestError' });
        expect(result).toMatchSnapshot();
      });
    });

    when('[t3] output validation fails', () => {
      const badOutputHandler = genLambdaEndpoint({
        schema: {
          input: z.object({ name: z.string() }),
          output: z.object({ message: z.string(), count: z.number() }),
        },
        invoke: async ({ event }) => ({
          message: `Hello, ${event.name}!`,
          // count field absent - triggers output validation error
        }),
      });

      then('it throws UnexpectedCodePathError with validation details', async () => {
        const error = await getError(
          async () => badOutputHandler({ name: 'test' }, mockContext),
        );
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('output validation failed');
        expect(error.message).toMatchSnapshot();
      });
    });
  });

  given('[case4] forApiGateway handler', () => {
    const schema = {
      input: z.object({ data: z.string() }),
      output: z.object({ success: z.boolean() }),
    };

    const handler = forApiGateway({
      schema,
      invoke: async () => ({ success: true }),
    });

    const mockContext = {
      functionName: 'test',
      awsRequestId: 'req-123',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123:function:test',
      memoryLimitInMB: '128',
      logGroupName: '/aws/lambda/test',
      logStreamName: 'stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
      callbackWaitsForEmptyEventLoop: true,
    } as Context;

    const mockEvent = {
      httpMethod: 'POST',
      path: '/test',
      body: JSON.stringify({ data: 'test' }),
      headers: { 'Content-Type': 'application/json' },
      queryStringParameters: null,
      pathParameters: null,
      requestContext: { requestId: 'req-123' },
    } as unknown as APIGatewayProxyEvent;

    when('[t0] invoked with valid request', () => {
      then('it should return 200 with correct body and headers', async () => {
        const result = await handler(mockEvent, mockContext);
        expect(result.statusCode).toBe(200);
        // note: X-Content-Type-Options applies to all responses
        // note: X-Frame-Options only applies to HTML (iframe protection) - not relevant for JSON APIs
        expect(result.headers?.['X-Content-Type-Options']).toBe('nosniff');
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] invoked with invalid request body', () => {
      const invalidEvent = {
        ...mockEvent,
        body: JSON.stringify({ data: 123 }), // invalid type
      } as APIGatewayProxyEvent;

      then('it should return 400 with error details', async () => {
        const result = await handler(invalidEvent, mockContext);
        expect(result.statusCode).toBe(400);
        expect(result).toMatchSnapshot();
      });
    });

    when('[t2] invoked with malformed JSON body', () => {
      const malformedEvent = {
        ...mockEvent,
        body: '{ invalid json }',
      } as APIGatewayProxyEvent;

      then('it should return 400 with parse error', async () => {
        const result = await handler(malformedEvent, mockContext);
        expect(result.statusCode).toBe(400);
        expect(result).toMatchSnapshot();
      });
    });

    when('[t3] invoked with null body', () => {
      const nullBodyEvent = {
        ...mockEvent,
        body: null,
      } as APIGatewayProxyEvent;

      then('it should return 400 for null body', async () => {
        const result = await handler(nullBodyEvent, mockContext);
        expect(result.statusCode).toBe(400);
        expect(result).toMatchSnapshot();
      });
    });

    when('[t4] invoked with empty object body', () => {
      const emptyBodyEvent = {
        ...mockEvent,
        body: JSON.stringify({}),
      } as APIGatewayProxyEvent;

      then('it should return 400 for empty body', async () => {
        const result = await handler(emptyBodyEvent, mockContext);
        expect(result.statusCode).toBe(400);
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case5] payload format compatibility - wrapped format', () => {
    const schema = {
      input: z.object({ message: z.string() }),
      output: z.object({ echo: z.string(), exid: z.string() }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }, { log }) => ({
        echo: event.message,
        exid:
          log.trail?.exid ??
          'no-exid',
      }),
    });

    when('[t0] invoked with wrapped format { event, trail }', () => {
      // note: the raw payload sent to lambda is { event, trail }
      // invokeHandlerForTest wraps it again, so we use event: wrappedPayload
      const wrappedPayload = {
        event: { message: 'hello from wrapped' },
        trail: { exid: 'exid:test-wrapped-123' },
      };

      const result = useThen('handler completes', async () =>
        invokeHandlerForTest(handler, { event: wrappedPayload }),
      );

      then('handler receives unwrapped event', () => {
        expect(result.echo).toBe('hello from wrapped');
      });

      then('exid is extracted from trail', () => {
        expect(result.exid).toBe('exid:test-wrapped-123');
      });

      then('result matches snapshot', () => {
        expect(typeof result.echo).toBe('string');
        expect(typeof result.exid).toBe('string');
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] invoked with wrapped format without exid', () => {
      const wrappedPayload = {
        event: { message: 'hello no exid' },
        trail: {},
      };

      const result = useThen('handler completes', async () =>
        invokeHandlerForTest(handler, { event: wrappedPayload }),
      );

      then('handler receives unwrapped event', () => {
        expect(result.echo).toBe('hello no exid');
      });

      then('exid is generated', () => {
        expect(result.exid).toMatch(/^exid:/);
      });

      then('result structure matches snapshot', () => {
        expect(typeof result.echo).toBe('string');
        expect(result.exid.startsWith('exid:')).toBe(true);
        expect(result).toMatchSnapshot({
          exid: expect.stringMatching(/^exid:/),
        });
      });
    });
  });

  given('[case6] payload format compatibility - raw format (legacy)', () => {
    const schema = {
      input: z.object({ message: z.string() }),
      output: z.object({ echo: z.string(), exid: z.string() }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }, { log }) => ({
        echo: event.message,
        exid:
          log.trail?.exid ??
          'no-exid',
      }),
    });

    when('[t0] invoked with raw payload (ancient caller)', () => {
      const rawPayload = { message: 'hello from legacy' };

      const result = useThen('handler completes', async () =>
        invokeHandlerForTest(handler, { event: rawPayload }),
      );

      then('handler receives the raw payload', () => {
        expect(result.echo).toBe('hello from legacy');
      });

      then('exid is generated', () => {
        expect(result.exid).toMatch(/^exid:/);
      });

      then('result structure matches snapshot', () => {
        expect(typeof result.echo).toBe('string');
        expect(result.exid.startsWith('exid:')).toBe(true);
        expect(result).toMatchSnapshot({
          exid: expect.stringMatching(/^exid:/),
        });
      });
    });
  });

  given('[case7] payload format compatibility - user data collision', () => {
    const schema = {
      input: z.object({ trail: z.string(), destination: z.string() }),
      output: z.object({
        receivedTrail: z.string(),
        receivedDestination: z.string(),
        exidGenerated: z.boolean(),
      }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }, { log }) => ({
        receivedTrail: event.trail,
        receivedDestination: event.destination,
        exidGenerated:
          log.trail?.exid?.startsWith('exid:') ?? false,
      }),
    });

    when('[t0] user event has trail as string (not our trail object)', () => {
      const userPayload = {
        trail: 'mountain path',
        destination: 'summit',
      };

      const result = useThen('handler completes', async () =>
        invokeHandlerForTest(handler, { event: userPayload }),
      );

      then('user trail data is preserved', () => {
        expect(result.receivedTrail).toBe('mountain path');
      });

      then('user destination data is preserved', () => {
        expect(result.receivedDestination).toBe('summit');
      });

      then('exid is generated (not extracted from user trail)', () => {
        expect(result.exidGenerated).toBe(true);
      });

      then('result matches snapshot', () => {
        expect(result.receivedTrail).toBe('mountain path');
        expect(result.receivedDestination).toBe('summit');
        expect(result.exidGenerated).toBe(true);
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case8] payload format compatibility - SQS-style events', () => {
    const schema = {
      input: z.object({
        Records: z.array(
          z.object({
            messageId: z.string(),
            body: z.string(),
          }),
        ),
      }),
      output: z.object({
        processedCount: z.number(),
        exidGenerated: z.boolean(),
      }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }, { log }) => ({
        processedCount: event.Records.length,
        exidGenerated:
          log.trail?.exid?.startsWith('exid:') ?? false,
      }),
    });

    when('[t0] invoked with SQS event structure', () => {
      const sqsPayload = {
        Records: [
          { messageId: 'msg-1', body: '{"data": 1}' },
          { messageId: 'msg-2', body: '{"data": 2}' },
        ],
      };

      const result = useThen('handler completes', async () =>
        invokeHandlerForTest(handler, { event: sqsPayload }),
      );

      then('all records are processed', () => {
        expect(result.processedCount).toBe(2);
      });

      then('exid is generated', () => {
        expect(result.exidGenerated).toBe(true);
      });

      then('result matches snapshot', () => {
        expect(result.processedCount).toBe(2);
        expect(result.exidGenerated).toBe(true);
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case9] payload format - extra keys beyond event and trail', () => {
    const schema = {
      input: z.object({
        event: z.object({ message: z.string() }),
        trail: z.object({ exid: z.string() }),
        extra: z.string(),
      }),
      output: z.object({
        receivedKeys: z.array(z.string()),
        exidGenerated: z.boolean(),
      }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }, { log }) => ({
        receivedKeys: Object.keys(event),
        exidGenerated:
          log.trail?.exid?.startsWith('exid:') ?? false,
      }),
    });

    when('[t0] payload has event, trail, and extra keys', () => {
      const payloadWithExtra = {
        event: { message: 'hello' },
        trail: { exid: 'exid:should-not-extract' },
        extra: 'field',
      };

      const result = useThen('handler completes', async () =>
        invokeHandlerForTest(handler, { event: payloadWithExtra }),
      );

      then('handler receives full payload (not unwrapped)', () => {
        expect(result.receivedKeys).toContain('event');
        expect(result.receivedKeys).toContain('trail');
        expect(result.receivedKeys).toContain('extra');
      });

      then('exid is generated (not extracted)', () => {
        expect(result.exidGenerated).toBe(true);
      });

      then('result matches snapshot', () => {
        expect(result.receivedKeys).toContain('event');
        expect(result.receivedKeys).toContain('trail');
        expect(result.receivedKeys).toContain('extra');
        expect(result.exidGenerated).toBe(true);
        expect(result).toMatchSnapshot();
      });
    });
  });
});
