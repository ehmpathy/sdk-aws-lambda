/**
 * .what = end-to-end user journey tests for sdk-aws-lambda
 * .why = verify the complete user experience from handler creation to client invocation
 */
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { genContextLogTrail } from 'sdk-logs';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { askLambdaEndpoint, forApiGateway, genLambdaEndpoint } from '../src/index';

/**
 * .what = generates test log context
 * .why = provides valid ContextLogTrail for tests
 */
const genTestLog = () => genContextLogTrail({ trail: null, env: null });

const createMockContext = (overrides: Partial<Context> = {}): Context => ({
  functionName: 'test-function',
  awsRequestId: `req-${Date.now()}`,
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',
  memoryLimitInMB: '128',
  logGroupName: '/aws/lambda/test',
  logStreamName: 'test-stream',
  getRemainingTimeInMillis: (): number => 30000,
  done: (): void => {},
  fail: (): void => {},
  succeed: (): void => {},
  callbackWaitsForEmptyEventLoop: true,
  ...overrides,
});

describe('user journey: basic lambda endpoint', () => {
  given('[case1] developer creates a simple handler', () => {
    const schema = {
      input: z.object({
        userId: z.string().uuid(),
        action: z.enum(['read', 'write', 'delete']),
      }),
      output: z.object({
        success: z.boolean(),
        userId: z.string(),
        action: z.string(),
        timestamp: z.string(),
      }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({
        event,
      }: {
        event: { userId: string; action: string };
      }) => ({
        success: true,
        userId: event.userId,
        action: event.action,
        timestamp: new Date().toISOString(),
      }),
    });

    when('[t0] handler receives valid request', () => {
      then('it returns success response', async () => {
        const result = await handler(
          {
            userId: '550e8400-e29b-41d4-a716-446655440000',
            action: 'read',
          },
          createMockContext(),
        );

        expect(result.success).toBe(true);
        expect(result.action).toBe('read');
        expect(result.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(typeof result.timestamp).toBe('string');
        expect({ ...result, timestamp: '[masked]' }).toMatchSnapshot();
      });
    });

    when('[t1] handler receives invalid request', () => {
      // genLambdaEndpoint catches BadRequestError and returns error response object
      // (lambda succeeds, error surfaced via response payload - not thrown)
      const result = useThen('handler returns error response', async () =>
        handler(
          { userId: 'not-a-uuid', action: 'invalid' } as unknown as {
            userId: string;
            action: 'read' | 'write' | 'delete';
          },
          createMockContext(),
        ),
      );

      then('response has BadRequestError type', () => {
        expect(
          (result as unknown as { errorType: string }).errorType,
        ).toBe('BadRequestError');
      });

      then('error message contains validation details', () => {
        expect(
          (result as unknown as { errorMessage: string }).errorMessage,
        ).toContain('validation failed');
      });

      then('response matches snapshot', () => {
        expect(result).toMatchSnapshot();
      });
    });
  });
});

describe('user journey: api gateway handler', () => {
  given('[case1] developer creates api gateway handler', () => {
    const schema = {
      input: z.object({
        productId: z.string(),
        quantity: z.number().positive(),
      }),
      output: z.object({
        orderId: z.string(),
        total: z.number(),
      }),
    };

    const handler = forApiGateway({
      schema,
      invoke: async ({
        event,
      }: {
        event: { productId: string; quantity: number };
      }) => ({
        orderId: `order-${Date.now()}`,
        total: event.quantity * 9.99,
      }),
    });

    const createMockApiEvent = (body: object): APIGatewayProxyEvent =>
      ({
        httpMethod: 'POST',
        path: '/orders',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
        queryStringParameters: null,
        pathParameters: null,
        requestContext: { requestId: 'req-api-123' },
      }) as unknown as APIGatewayProxyEvent;

    when('[t0] receives valid POST request', () => {
      then('it returns 200 with json body', async () => {
        const event = createMockApiEvent({
          productId: 'prod-123',
          quantity: 3,
        });
        const result = await handler(event, createMockContext());

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toMatchObject({
          orderId: expect.stringMatching(/^order-/),
          total: 29.97,
        });

        // snapshot with dynamic orderId masked
        expect({
          ...result,
          body: JSON.stringify({
            ...JSON.parse(result.body),
            orderId: '[dynamic]',
          }),
        }).toMatchSnapshot();
      });

      then('it includes security headers', async () => {
        const event = createMockApiEvent({
          productId: 'prod-123',
          quantity: 1,
        });
        const result = await handler(event, createMockContext());

        // note: X-Content-Type-Options applies to all responses
        // note: X-Frame-Options only applies to HTML (iframe protection) - not relevant for JSON APIs
        expect(result.headers?.['X-Content-Type-Options']).toBe('nosniff');
      });
    });

    when('[t1] receives invalid request', () => {
      then('it returns 400 with error response', async () => {
        const event = createMockApiEvent({
          productId: 'prod-123',
          quantity: -5,
        });
        const result = await handler(event, createMockContext());

        expect(result.statusCode).toBe(400);
        expect(result).toMatchSnapshot();
      });
    });
  });
});

describe('user journey: lambda client contract verification', () => {
  /**
   * .what = compile-time type contract tests for askLambdaEndpoint
   * .why = verifies public API contract without AWS infrastructure
   *
   * .mock = AWS Lambda Client (InvokeCommand)
   * .why = real integration tests require deployed lambda infrastructure
   *        - sdk is for lambda creation, no deployed lambdas exist in this repo
   *        - aws accounts for test infrastructure not provisioned
   * .real = runtime behavior verified via:
   *         - askLambdaEndpoint.test.ts (unit tests with mocked SDK)
   *         - production validation when sdk used in deployed services
   *         - handler-side verified via in-process acceptance tests above
   *
   * .scope = these tests verify:
   *         - function is exported and callable
   *         - input/context type shapes compile correctly
   *         - not runtime invocation behavior (see unit tests)
   */
  given('[case1] askLambdaEndpoint public contract', () => {
    when('[t0] function is exported', () => {
      then('it is callable', () => {
        expect(typeof askLambdaEndpoint).toBe('function');
      });
    });

    when('[t1] input type is verified', () => {
      then('valid input compiles (type-level verification)', () => {
        // type-level verification: this test passes if code compiles
        // invalid shapes would cause typescript errors, not runtime failures
        const validInput: Parameters<typeof askLambdaEndpoint>[0] = {
          which: {
            service: 'user-service',
            function: 'getUser',
          },
          event: { userId: '123' },
        };

        // sanity check the shape at runtime
        expect(validInput.which.service).toBe('user-service');
        expect(validInput.which.function).toBe('getUser');
      });
    });

    when('[t2] context type is verified', () => {
      then('valid context compiles (type-level verification)', () => {
        // type-level verification: this test passes if code compiles
        const validContext: Parameters<typeof askLambdaEndpoint>[1] = {
          ...genTestLog(),
          env: { access: 'test', region: 'us-east-1' },
        };

        // sanity check the shape at runtime
        expect(validContext.env.access).toBe('test');
        expect(typeof validContext.log.debug).toBe('function');
      });
    });
  });
});

describe('user journey: trail context propagation', () => {
  given('[case1] handler chain with trail context', () => {
    const firstHandler = genLambdaEndpoint({
      schema: {
        input: z.object({
          data: z.string(),
        }),
        output: z.object({
          stage: z.literal('first'),
          receivedExid: z.string().nullable(),
        }),
      },
      invoke: async (_input, { log }) => {
        const exid =
          log.trail?.exid ?? null;
        return { stage: 'first' as const, receivedExid: exid };
      },
    });

    const secondHandler = genLambdaEndpoint({
      schema: {
        input: z.object({
          data: z.string(),
        }),
        output: z.object({
          stage: z.literal('second'),
          receivedExid: z.string().nullable(),
        }),
      },
      invoke: async (_input, { log }) => {
        const exid =
          log.trail?.exid ?? null;
        return { stage: 'second' as const, receivedExid: exid };
      },
    });

    when('[t0] handlers are chained', () => {
      then('they execute in sequence with trail context', async () => {
        // use wrapped format { event, trail } for trail propagation
        const firstResult = await firstHandler(
          { event: { data: 'test' }, trail: { exid: 'exid:journey' } },
          createMockContext(),
        );
        const secondResult = await secondHandler(
          { event: { data: 'test' }, trail: { exid: 'exid:journey' } },
          createMockContext(),
        );

        expect(firstResult.stage).toBe('first');
        expect(secondResult.stage).toBe('second');
        expect(firstResult.receivedExid).toBe('exid:journey');
        expect(secondResult.receivedExid).toBe('exid:journey');
        expect({ firstResult, secondResult }).toMatchSnapshot();
      });
    });
  });
});
