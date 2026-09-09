import type { ApiGatewayRequestPayload } from '../../../domain.objects/ApiGatewayRequestPayload';

/**
 * .what = an api-gateway request with v1/v2 differences reconciled
 * .why = v1 puts the method at `httpMethod` and v2 at `requestContext.http.method`. a
 *        handler that reads either directly is version-locked, so the sdk reconciles them
 *        once and hands over one shape
 *
 * .note = `Unified` carries weight, never decoration: this is NOT the wire shape. the wire
 *         shape is `ApiGatewayRequestPayload`, the raw v1|v2 union. this is a step the
 *         default input translator takes on the way to `inputAfter`
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
  /**
   * .what = the ejection route — the wire payload, before this shape reconciled it
   * .why = `_` marks it as an escape hatch rather than a paved path. every field above is
   *        version-agnostic; reach in here and you are version-locked again, so a reader who
   *        sees `_` knows they have left the supported surface
   */
  _: { raw: ApiGatewayRequestPayload };
}
