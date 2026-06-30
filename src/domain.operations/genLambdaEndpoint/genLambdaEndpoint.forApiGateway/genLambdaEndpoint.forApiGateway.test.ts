import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { given, then, useThen, when } from 'test-fns';
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
      const result = useThen('handler returns response', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async ({ event }) => ({
            id: 'user-123',
            name: event.name,
          }),
        });

        return handler(createV1Event({ name: 'Alice' }), createMockContext());
      });

      then('it should return 200 with JSON body', () => {
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({
          id: 'user-123',
          name: 'Alice',
        });
      });

      then('it should include security headers', () => {
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

      then('result matches snapshot', () => {
        expect({
          statusCode: result.statusCode,
          body: JSON.parse(result.body),
          hasSecurityHeaders: Boolean(
            result.headers?.['X-Content-Type-Options'],
          ),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case2] invalid request body', () => {
    const schema = {
      input: z.object({ email: z.string().email() }),
      output: z.object({ success: z.boolean() }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns error', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({ success: true }),
        });

        return handler(
          createV1Event({ email: 'not-an-email' }),
          createMockContext(),
        );
      });

      then('it should return 400 status', () => {
        expect(result.statusCode).toBe(400);
      });

      then('body contains validation error', () => {
        const body = JSON.parse(result.body);
        expect(body.errorMessage).toContain('validation failed');
        expect(body.errorType).toBe('BadRequestError');
      });

      then('result matches snapshot', () => {
        expect({
          statusCode: result.statusCode,
          body: JSON.parse(result.body),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case3] cors configured', () => {
    const schema = {
      input: z.object({ data: z.string() }),
      output: z.object({ result: z.string() }),
    };

    when('[t0] handler invoked', () => {
      then('it should include cors headers', async () => {
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
        // add Origin header to trigger cors
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
      const result = useThen('handler returns response', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async ({ rawEvent }) => ({
            method: rawEvent.httpMethod,
            path: rawEvent.path,
          }),
        });

        return handler(createV1Event({ action: 'test' }), createMockContext());
      });

      then('it should have access to rawEvent', () => {
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.method).toBe('POST');
        expect(body.path).toBe('/users');
      });

      then('result matches snapshot', () => {
        expect({
          statusCode: result.statusCode,
          body: JSON.parse(result.body),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case6] deserialize body disabled', () => {
    const schema = {
      input: z.string(),
      output: z.object({ received: z.string() }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns response', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async ({ event }) => ({
            received: event,
          }),
          deserialize: { body: false },
        });

        return handler(
          createV1Event({ signature: 'webhook-data' }),
          createMockContext(),
        );
      });

      then('it should receive raw body string', () => {
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.received).toBe('{"signature":"webhook-data"}');
      });

      then('result matches snapshot', () => {
        expect({
          statusCode: result.statusCode,
          body: JSON.parse(result.body),
        }).toMatchSnapshot();
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
        const handler = forApiGateway(
          {
            schema,
            invoke: async () => ({ name: 'test', balance: 100 }),
          },
          { env: { access: 'prep' } },
        );

        return handler(
          createV1Event({ introspect: 'schema' }),
          createMockContext(),
        );
      });

      then('response status is 200', () => {
        expect(result.statusCode).toBe(200);
      });

      then('response contains input schema', () => {
        const body = JSON.parse(result.body);
        expect(body.input.type).toBe('object');
        expect(body.input.properties.customerId).toBeDefined();
      });

      then('response contains output schema', () => {
        const body = JSON.parse(result.body);
        expect(body.output.type).toBe('object');
        expect(body.output.properties.name).toBeDefined();
        expect(body.output.properties.balance).toBeDefined();
      });

      then('response matches snapshot', () => {
        expect({
          statusCode: result.statusCode,
          body: JSON.parse(result.body),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case8] introspection request in prod env', () => {
    const schema = {
      input: z.object({ id: z.string() }),
      output: z.object({ value: z.number() }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns error', async () => {
        const handler = forApiGateway(
          {
            schema,
            invoke: async () => ({ value: 42 }),
          },
          { env: { access: 'prod' } },
        );

        return handler(
          createV1Event({ introspect: 'schema' }),
          createMockContext(),
        );
      });

      then('returns 400 status', () => {
        expect(result.statusCode).toBe(400);
      });

      then('body indicates prep environment required', () => {
        const body = JSON.parse(result.body);
        expect(body.errorMessage).toContain('prep');
        expect(body.errorType).toBe('BadRequestError');
      });

      then('result matches snapshot', () => {
        expect({
          statusCode: result.statusCode,
          body: JSON.parse(result.body),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case9] introspection request without env config', () => {
    const schema = {
      input: z.object({ id: z.string() }),
      output: z.object({ value: z.number() }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns error', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({ value: 42 }),
          // no env provided
        });

        return handler(
          createV1Event({ introspect: 'schema' }),
          createMockContext(),
        );
      });

      then('returns 400 status', () => {
        expect(result.statusCode).toBe(400);
      });

      then('body indicates env is required', () => {
        const body = JSON.parse(result.body);
        expect(body.errorMessage).toContain('env');
        expect(body.errorType).toBe('BadRequestError');
      });

      then('result matches snapshot', () => {
        expect({
          statusCode: result.statusCode,
          body: JSON.parse(result.body),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case10] normal request with env config', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ message: z.string() }),
    };

    when('[t0] handler invoked with normal payload', () => {
      const result = useThen('handler returns response', async () => {
        const handler = forApiGateway(
          {
            schema,
            invoke: async ({ event }) => ({ message: `Hello, ${event.name}!` }),
          },
          { env: { access: 'prep' } },
        );

        return handler(createV1Event({ name: 'Bob' }), createMockContext());
      });

      then('passes through to handler as normal', () => {
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body).toEqual({ message: 'Hello, Bob!' });
      });

      then('result matches snapshot', () => {
        expect({
          statusCode: result.statusCode,
          body: JSON.parse(result.body),
        }).toMatchSnapshot();
      });
    });
  });
});
