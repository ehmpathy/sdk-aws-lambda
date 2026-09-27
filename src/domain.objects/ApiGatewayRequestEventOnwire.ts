import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from 'aws-lambda';

/**
 * .what = the wire form an api-gateway trigger delivers, either version
 * .why = api gateway ships two incompatible request shapes (rest/v1, http/v2), and a
 *        handler must be able to name the shape as it LANDS, before any translate runs
 *
 * .note = this is the `inputBefore` point: the untouched bytes-as-parsed, before the
 *         input translator. its peer at the other end of the pipeline is
 *         `ApiGatewayResponseOnwire` — request/response, each qualified by `Onwire` to mark
 *         it as the form on the wire
 *
 * .note = `Onwire` replaced a `Payload` suffix here. `payload` is http's word for a message
 *         BODY (rfc 9110, "payload body"), and this value is the whole message — so the
 *         old suffix claimed the wrong level inside an http family. `Onwire` qualifies a
 *         POSITION, exactly as `Unified` does, so no later step can falsify it
 *         (`domain.terms/payload.md`)
 */
export type ApiGatewayRequestEventOnwire =
  | APIGatewayProxyEvent
  | APIGatewayProxyEventV2;
