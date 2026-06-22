import type { APIGatewayProxyEvent } from 'aws-lambda';

/**
 * .what = type guard for API Gateway v1 (REST API) events
 * .why = enables detection of event format for middleware
 */
export const getIsV1ApiGatewayEvent = (
  event: unknown,
): event is APIGatewayProxyEvent => {
  if (!event || typeof event !== 'object') return false;
  const obj = event as Record<string, unknown>;

  // v1 events have httpMethod (v2 uses requestContext.http.method)
  return typeof obj.httpMethod === 'string';
};
