import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from 'aws-lambda';
import { getError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import {
  genApiGatewayEventNormalizationMiddleware,
  type UnifiedApiGatewayEvent,
} from './genApiGatewayEventNormalizationMiddleware';

describe('genApiGatewayEventNormalizationMiddleware', () => {
  const invokeMiddleware = async (
    event: unknown,
    parseBody: boolean = true,
  ): Promise<UnifiedApiGatewayEvent> => {
    const middleware = genApiGatewayEventNormalizationMiddleware({ parseBody });
    const request = {
      event,
      context: {} as Record<string, unknown>,
      response: undefined,
      error: undefined as unknown as Error,
      internal: {},
    } as unknown as Parameters<NonNullable<typeof middleware.before>>[0];

    await middleware.before!(request);
    return request.event as unknown as UnifiedApiGatewayEvent;
  };

  given('[case1] v1 API Gateway event', () => {
    const v1Event: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      path: '/users',
      headers: { 'content-type': 'application/json' },
      queryStringParameters: { limit: '10' },
      pathParameters: { id: '123' },
      body: '{"name":"alice"}',
      isBase64Encoded: false,
      requestContext: {
        requestId: 'req-123',
        stage: 'prod',
        domainName: 'api.example.com',
        accountId: '123456789',
      } as APIGatewayProxyEvent['requestContext'],
    };

    when('[t0] middleware invoked with parseBody=true', () => {
      then('it should convert to unified format', async () => {
        const result = await invokeMiddleware(v1Event, true);
        expect(result.httpMethod).toBe('POST');
        expect(result.path).toBe('/users');
        expect(result.body).toEqual({ name: 'alice' });
      });
    });

    when('[t1] middleware invoked with parseBody=false', () => {
      then('it should preserve raw body string', async () => {
        const result = await invokeMiddleware(v1Event, false);
        expect(result.body).toBe('{"name":"alice"}');
      });
    });
  });

  given('[case2] v2 API Gateway event', () => {
    const v2Event: Partial<APIGatewayProxyEventV2> = {
      version: '2.0',
      headers: { 'content-type': 'application/json' },
      queryStringParameters: { limit: '10' },
      pathParameters: { id: '456' },
      body: '{"email":"bob@example.com"}',
      isBase64Encoded: false,
      requestContext: {
        requestId: 'req-456',
        stage: 'prod',
        domainName: 'api.example.com',
        accountId: '123456789',
        http: {
          method: 'PUT',
          path: '/users/456',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'test',
        },
      } as unknown as APIGatewayProxyEventV2['requestContext'],
    };

    when('[t0] middleware invoked', () => {
      then('it should convert to unified format', async () => {
        const result = await invokeMiddleware(v2Event, true);
        expect(result.httpMethod).toBe('PUT');
        expect(result.path).toBe('/users/456');
        expect(result.body).toEqual({ email: 'bob@example.com' });
      });
    });
  });

  given('[case3] base64 encoded body', () => {
    const eventWithBase64: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      path: '/upload',
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      body: Buffer.from('{"data":"encoded"}').toString('base64'),
      isBase64Encoded: true,
      requestContext: {
        requestId: 'req-789',
        stage: 'prod',
      } as APIGatewayProxyEvent['requestContext'],
    };

    when('[t0] middleware invoked', () => {
      then('it should decode base64 and parse JSON', async () => {
        const result = await invokeMiddleware(eventWithBase64, true);
        expect(result.body).toEqual({ data: 'encoded' });
      });
    });
  });

  given('[case4] invalid event format', () => {
    const invalidEvent = { foo: 'bar' };

    when('[t0] middleware invoked', () => {
      then('it should throw MalfunctionError', async () => {
        const error = await getError(invokeMiddleware(invalidEvent));
        expect(error.message).toContain('neither v1 nor v2');
      });
    });
  });

  given('[case5] non-JSON body', () => {
    const eventWithPlainText: Partial<APIGatewayProxyEvent> = {
      httpMethod: 'POST',
      path: '/webhook',
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      body: 'plain text content',
      isBase64Encoded: false,
      requestContext: {
        requestId: 'req-000',
        stage: 'prod',
      } as APIGatewayProxyEvent['requestContext'],
    };

    when('[t0] middleware invoked', () => {
      then('it should return raw string as body', async () => {
        const result = await invokeMiddleware(eventWithPlainText, true);
        expect(result.body).toBe('plain text content');
      });
    });
  });
});
