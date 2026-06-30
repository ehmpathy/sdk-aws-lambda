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
 * .what = parses JSON body string to object
 * .why = API Gateway sends body as string, handlers need object
 */
const getParsedApiGatewayBody = (input: {
  body: string | null | undefined;
  isBase64Encoded: boolean;
}): unknown => {
  if (!input.body) return null;

  // decode base64 if needed
  const decoded = input.isBase64Encoded
    ? Buffer.from(input.body, 'base64').toString('utf-8')
    : input.body;

  // parse json or return raw string
  try {
    return JSON.parse(decoded);
  } catch {
    return decoded;
  }
};

/**
 * .what = convert v2 HTTP API event to unified format
 * .why = isolates transformation logic from orchestrator
 */
const asUnifiedEventFromV2 = (input: {
  event: APIGatewayProxyEventV2;
  parseBody: boolean;
}): UnifiedApiGatewayEvent => {
  const body = input.parseBody
    ? getParsedApiGatewayBody({
        body: input.event.body,
        isBase64Encoded: input.event.isBase64Encoded,
      })
    : input.event.body;

  return {
    httpMethod: input.event.requestContext.http.method,
    path: input.event.requestContext.http.path,
    headers: input.event.headers as Record<string, string | undefined>,
    queryStringParameters: input.event.queryStringParameters ?? null,
    pathParameters: input.event.pathParameters ?? null,
    body,
    rawBody: input.event.body ?? null,
    isBase64Encoded: input.event.isBase64Encoded,
    requestContext: {
      requestId: input.event.requestContext.requestId,
      stage: input.event.requestContext.stage,
      domainName: input.event.requestContext.domainName,
      accountId: input.event.requestContext.accountId,
    },
    rawEvent: input.event,
  };
};

/**
 * .what = convert v1 REST API event to unified format
 * .why = isolates transformation logic from orchestrator
 */
const asUnifiedEventFromV1 = (input: {
  event: APIGatewayProxyEvent;
  parseBody: boolean;
}): UnifiedApiGatewayEvent => {
  const body = input.parseBody
    ? getParsedApiGatewayBody({
        body: input.event.body,
        isBase64Encoded: input.event.isBase64Encoded,
      })
    : input.event.body;

  return {
    httpMethod: input.event.httpMethod,
    path: input.event.path,
    headers: input.event.headers as Record<string, string | undefined>,
    queryStringParameters: input.event.queryStringParameters ?? null,
    pathParameters: input.event.pathParameters ?? null,
    body,
    rawBody: input.event.body ?? null,
    isBase64Encoded: input.event.isBase64Encoded,
    requestContext: {
      requestId: input.event.requestContext.requestId,
      stage: input.event.requestContext.stage,
      domainName: input.event.requestContext.domainName,
      accountId: input.event.requestContext.accountId,
    },
    rawEvent: input.event,
  };
};

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

    // convert v2 HTTP API event to unified format
    if (getIsV2ApiGatewayEvent(rawEvent)) {
      request.event = asUnifiedEventFromV2({
        event: rawEvent as APIGatewayProxyEventV2,
        parseBody: input.parseBody,
      }) as unknown as typeof request.event;
      return;
    }

    // convert v1 REST API event to unified format
    if (getIsV1ApiGatewayEvent(rawEvent)) {
      request.event = asUnifiedEventFromV1({
        event: rawEvent as APIGatewayProxyEvent,
        parseBody: input.parseBody,
      }) as unknown as typeof request.event;
      return;
    }

    // fail if neither v1 nor v2
    throw new MalfunctionError('event is neither v1 nor v2 API Gateway event', {
      rawEvent,
    });
  };

  return { before };
};
