import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from 'aws-lambda';

/**
 * .what = the wire payload an api-gateway trigger delivers, either version
 * .why = api gateway ships two incompatible request shapes (rest/v1, http/v2), and a
 *        handler must be able to name the shape as it LANDS, before any translate runs
 *
 * .note = this is the `inputBefore` point: the untouched bytes-as-parsed, before the
 *         input translator. its peer at the other end of the pipeline is
 *         `ApiGatewayResponsePayload` — request/response, each qualified by `Payload`
 *         to mark it as the wire form
 */
export type ApiGatewayRequestPayload =
  | APIGatewayProxyEvent
  | APIGatewayProxyEventV2;
