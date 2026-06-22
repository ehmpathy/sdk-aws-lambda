import type middy from '@middy/core';
import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from 'aws-lambda';
import { MalfunctionError } from 'helpful-errors';

import { getIsV1ApiGatewayEvent } from '../getIsV1ApiGatewayEvent';
import { getIsV2ApiGatewayEvent } from '../getIsV2ApiGatewayEvent';

/**
 * .what = unified API Gateway event format
 * .why = abstracts v1/v2 differences for handler consumption
 */
export interface UnifiedApiGatewayEvent {
  httpMethod: string;
  path: string;
  headers: Record<string, string | undefined>;
  queryStringParameters: Record<string, string | undefined> | null;
  pathParameters: Record<string, string | undefined> | null;
  body: unknown;
  rawBody: string | null;
  isBase64Encoded: boolean;
  requestContext: {
    requestId: string;
    stage: string;
    domainName?: string;
    accountId?: string;
  };
  rawEvent: APIGatewayProxyEvent | APIGatewayProxyEventV2;
}

/**
 * .what = converts v1/v2 API Gateway events to unified format
 * .why = handlers work with consistent event shape regardless of API type
 */
export const genApiGatewayEventNormalizationMiddleware = (input: {
  parseBody: boolean;
}): {
  before: middy.MiddlewareFn<any, any>;
} => {
  const before: middy.MiddlewareFn<any, any> = async (request) => {
    const rawEvent = request.event;

    // detect event version
    if (getIsV2ApiGatewayEvent(rawEvent)) {
      // v2 (HTTP API) event
      const v2Event = rawEvent as APIGatewayProxyEventV2;
      const body = input.parseBody
        ? parseBody(v2Event.body, v2Event.isBase64Encoded)
        : v2Event.body;

      request.event = {
        httpMethod: v2Event.requestContext.http.method,
        path: v2Event.requestContext.http.path,
        headers: v2Event.headers as Record<string, string | undefined>,
        queryStringParameters: v2Event.queryStringParameters ?? null,
        pathParameters: v2Event.pathParameters ?? null,
        body,
        rawBody: v2Event.body ?? null,
        isBase64Encoded: v2Event.isBase64Encoded,
        requestContext: {
          requestId: v2Event.requestContext.requestId,
          stage: v2Event.requestContext.stage,
          domainName: v2Event.requestContext.domainName,
          accountId: v2Event.requestContext.accountId,
        },
        rawEvent,
      } as unknown as typeof request.event;
      return;
    }

    if (getIsV1ApiGatewayEvent(rawEvent)) {
      // v1 (REST API) event
      const v1Event = rawEvent as APIGatewayProxyEvent;
      const body = input.parseBody
        ? parseBody(v1Event.body, v1Event.isBase64Encoded)
        : v1Event.body;

      request.event = {
        httpMethod: v1Event.httpMethod,
        path: v1Event.path,
        headers: v1Event.headers as Record<string, string | undefined>,
        queryStringParameters: v1Event.queryStringParameters ?? null,
        pathParameters: v1Event.pathParameters ?? null,
        body,
        rawBody: v1Event.body ?? null,
        isBase64Encoded: v1Event.isBase64Encoded,
        requestContext: {
          requestId: v1Event.requestContext.requestId,
          stage: v1Event.requestContext.stage,
          domainName: v1Event.requestContext.domainName,
          accountId: v1Event.requestContext.accountId,
        },
        rawEvent,
      } as unknown as typeof request.event;
      return;
    }

    throw new MalfunctionError('event is neither v1 nor v2 API Gateway event', {
      rawEvent,
    });
  };

  return { before };
};

/**
 * .what = parses JSON body string to object
 * .why = API Gateway sends body as string, handlers need object
 */
const parseBody = (
  body: string | null | undefined,
  isBase64Encoded: boolean,
): unknown => {
  if (!body) return null;

  const decoded = isBase64Encoded
    ? Buffer.from(body, 'base64').toString('utf-8')
    : body;

  try {
    return JSON.parse(decoded);
  } catch {
    // return raw string if not valid JSON
    return decoded;
  }
};
