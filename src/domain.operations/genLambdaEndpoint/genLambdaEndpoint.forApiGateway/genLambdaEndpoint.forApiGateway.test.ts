import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { forApiGateway } from './genLambdaEndpoint.forApiGateway';

describe('genLambdaEndpoint.forApiGateway', () => {
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

  const createV1Event = (body: object): APIGatewayProxyEvent =>
    ({
      httpMethod: 'POST',
      path: '/users',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      queryStringParameters: null,
      pathParameters: null,
      requestContext: {
        requestId: 'req-123',
      },
    }) as unknown as APIGatewayProxyEvent;

  given('[case1] valid request', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ id: z.string(), name: z.string() }),
    };

    when('[t0] handler invoked', () => {
      then('it should return 200 with JSON body', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async ({ event }) => ({
            id: 'user-123',
            name: event.name,
          }),
        });

        const result = await handler(
          createV1Event({ name: 'Alice' }),
          createMockContext(),
        );

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
          id: 'user-123',
          name: 'Alice',
        });
      });

      then('it should include security headers', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async ({ event }) => ({
            id: 'user-123',
            name: event.name,
          }),
        });

        const result = await handler(
          createV1Event({ name: 'Alice' }),
          createMockContext(),
        );

        // note: @middy/http-security-headers applies different headers based on Content-Type
        // - X-Content-Type-Options, Strict-Transport-Security, etc are always applied
        // - X-Frame-Options, X-XSS-Protection are HTML-only (only for text/html responses)
        // since we return JSON, we check headers that are always applied
        expect(result.headers?.['X-Content-Type-Options']).toBe('nosniff');
        expect(result.headers?.['Strict-Transport-Security']).toContain(
          'max-age=',
        );
        expect(result.headers?.['Referrer-Policy']).toBe('no-referrer');
      });
    });
  });

  given('[case2] invalid request body', () => {
    const schema = {
      input: z.object({ email: z.string().email() }),
      output: z.object({ success: z.boolean() }),
    };

    when('[t0] handler invoked', () => {
      then('it should return 400 error response', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({ success: true }),
        });

        const result = await handler(
          createV1Event({ email: 'not-an-email' }),
          createMockContext(),
        );

        expect(result.statusCode).toBe(400);
        const body = JSON.parse(result.body);
        expect(body.errorMessage).toContain('validation failed');
        expect(body.errorType).toBe('BadRequestError');
      });
    });
  });

  given('[case3] CORS configured', () => {
    const schema = {
      input: z.object({ data: z.string() }),
      output: z.object({ result: z.string() }),
    };

    when('[t0] handler invoked', () => {
      then('it should include CORS headers', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({ result: 'ok' }),
          cors: {
            origins: ['https://example.com'],
            headers: 'content-type,authorization',
            credentials: true,
          },
        });

        const event = createV1Event({ data: 'test' });
        // add Origin header to trigger CORS
        (event.headers as Record<string, string>)['Origin'] =
          'https://example.com';

        const result = await handler(event, createMockContext());

        expect(result.headers?.['Access-Control-Allow-Origin']).toBe(
          'https://example.com',
        );
        expect(result.headers?.['Access-Control-Allow-Credentials']).toBe(
          'true',
        );

        // snapshot for contract exhaustiveness (cors headers)
        expect({
          statusCode: result.statusCode,
          corsHeaders: {
            'Access-Control-Allow-Origin':
              result.headers?.['Access-Control-Allow-Origin'],
            'Access-Control-Allow-Credentials':
              result.headers?.['Access-Control-Allow-Credentials'],
          },
          body: JSON.parse(result.body),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case4] handler error', () => {
    const schema = {
      input: z.object({ value: z.number() }),
      output: z.object({ result: z.number() }),
    };

    when('[t0] handler throws', () => {
      then('it should return 500 with generic error body', async () => {
        // note: 500 responses include a generic error message and correlation id
        // but no internal details to avoid info leaks
        const handler = forApiGateway({
          schema,
          invoke: async () => {
            throw new Error('Database connection failed');
          },
        });

        const result = await handler(
          createV1Event({ value: 42 }),
          createMockContext(),
        );

        expect(result.statusCode).toBe(500);
        expect(result.body).toBeDefined();
        const body = JSON.parse(result.body!);
        expect(body.errorMessage).toBe('internal server error');
        expect(body.errorType).toBe('InternalServiceError');
        expect(body.correlationId).toMatch(/^exid:/);
        // verify no internal details leaked
        expect(body.stackTrace).toBeUndefined();
        expect(result.body).not.toContain('Database connection');

        // snapshot for contract exhaustiveness (exclude dynamic correlationId)
        expect({
          statusCode: result.statusCode,
          errorMessage: body.errorMessage,
          errorType: body.errorType,
          hasCorrelationId: Boolean(body.correlationId),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case5] access to raw event', () => {
    const schema = {
      input: z.object({ action: z.string() }),
      output: z.object({ method: z.string(), path: z.string() }),
    };

    when('[t0] handler invoked', () => {
      then('it should have access to rawEvent', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async ({ rawEvent }) => ({
            method: rawEvent.httpMethod,
            path: rawEvent.path,
          }),
        });

        const result = await handler(
          createV1Event({ action: 'test' }),
          createMockContext(),
        );

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.method).toBe('POST');
        expect(body.path).toBe('/users');
      });
    });
  });

  given('[case6] deserialize body disabled', () => {
    const schema = {
      input: z.string(),
      output: z.object({ received: z.string() }),
    };

    when('[t0] handler invoked', () => {
      then('it should receive raw body string', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async ({ event }) => ({
            received: event,
          }),
          deserialize: { body: false },
        });

        const result = await handler(
          createV1Event({ signature: 'webhook-data' }),
          createMockContext(),
        );

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.received).toBe('{"signature":"webhook-data"}');
      });
    });
  });
});
