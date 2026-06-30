import type { APIGatewayProxyEventV2 } from 'aws-lambda';

/**
 * .what = type guard for api gateway v2 (http api) events
 * .why = enables detection of event format for middleware
 */
export const getIsV2ApiGatewayEvent = (
  event: unknown,
): event is APIGatewayProxyEventV2 => {
  if (!event || typeof event !== 'object') return false;
  const obj = event as Record<string, unknown>;

  // v2 events have version field set to '2.0'
  return obj.version === '2.0';
};
