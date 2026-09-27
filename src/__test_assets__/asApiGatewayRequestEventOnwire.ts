import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from 'aws-lambda';

import type { ApiGatewayRequestEventOnwire } from '../domain.objects/ApiGatewayRequestEventOnwire';

/**
 * .what = which api-gateway payload format a trigger delivers
 * .why = a rest-api (v1) and an http-api (v2) hand a lambda two different event shapes for the
 *        identical http request, and twilio and cloudfront are as plausibly wired behind one as
 *        the other. `v1` is the harness default
 *
 * .why the word `payload` appears in the prose = *"payload format version"* is aws's own name
 *        for this config (`PayloadFormatVersion`, `1.0` | `2.0`), so an author who searches the
 *        aws docs finds it under that word and no other. it is quoted vendor vocabulary, never
 *        this repo's `payload` — which names the request body and naught else
 *        (`domain.terms/payload.md`). aws's sense here is the whole event
 *
 * .note = the name of this type says `Onwire`, not `Payload`, for that reason: the axis it
 *         selects is which wire shape arrives, and the repo's word for a wire shape is `Onwire`
 *         (`ApiGatewayRequestEventOnwire`, `ApiGatewayResponseOnwire`)
 */
export type ApiGatewayOnwireVersion = 'v1' | 'v2';

/**
 * .what = builds the v1 proxy event api gateway delivers for one real http request
 * .why = the assertion under test is about wire bytes, so the request must arrive as bytes and
 *        be mapped here — a hand-written event object would skip the very boundary the test
 *        exists to cross
 */
const asApiGatewayProxyEvent = (input: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}): APIGatewayProxyEvent => {
  const url = new URL(input.url, 'http://localhost');

  return {
    httpMethod: input.method,
    path: url.pathname,
    body: input.body === '' ? null : input.body,
    headers: input.headers,
    queryStringParameters: Object.fromEntries(url.searchParams),
    pathParameters: null,
    isBase64Encoded: false,
    requestContext: { requestId: `req-${Date.now()}` },
    /**
     * .as = `requestContext` declares ~15 required fields (identity, apiId, authorizer, …) that
     *       aws populates and this harness does not. the normalizer reads four, so to supply
     *       the rest would be fifteen lines of fiction a reader must then distrust
     * .removal = drops once this family owns a declared inbound contract narrower than aws's
     *            whole event, which would make this a plain object literal
     */
  } as unknown as APIGatewayProxyEvent;
};

/**
 * .what = builds the v2 (http-api, payload format 2.0) event, for one real http request
 * .why = v2 moves the method and path under `requestContext.http` and drops `httpMethod`/`path`
 *        from the top level, so a v1-only harness cannot prove the wire for an http-api trigger
 *
 * .note = the sdk reads three fields that differ across the versions, not two. beside the
 *         relocated method and path sits `version` — the discriminant
 *         (`getIsV2ApiGatewayRequestEvent` reads `obj.version === '2.0'`, and v1 carries no
 *         such key). so `version: '2.0'` below carries the load rather than decorates: omit it
 *         and `asApiGatewayRequestEventUnified` takes the v1 arm, finds no top-level
 *         `httpMethod`, and throws. the `ApiGatewayRequestEventUnified` forbidden-key block
 *         rests on this same field
 *
 * .note = every other field the sdk reads sits at the same path on both, and two differ in
 *         value rather than position: v1 sends `null` for an absent body and path params where
 *         v2 sends `undefined`. `asEventUnified` absorbs that with `??`, so the split never
 *         reaches a handler — which is why it is a note here and no branch there
 */
const asApiGatewayProxyEventV2 = (input: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}): APIGatewayProxyEventV2 => {
  const url = new URL(input.url, 'http://localhost');

  return {
    version: '2.0',
    rawPath: url.pathname,
    rawQueryString: url.searchParams.toString(),
    body: input.body === '' ? undefined : input.body,
    headers: input.headers,
    queryStringParameters: Object.fromEntries(url.searchParams),
    pathParameters: undefined,
    isBase64Encoded: false,
    requestContext: {
      requestId: `req-${Date.now()}`,

      // the v2 difference the sdk reads — method and path live here, not on top
      http: { method: input.method, path: url.pathname },
    },
    // .as = the same fiction budget as the v1 builder; drops with that cast, on the same terms
  } as unknown as APIGatewayProxyEventV2;
};

/**
 * .what = builds whichever api-gateway payload version was asked for
 * .why = one dispatch, so a version cannot be honored on one path and forgotten on another
 *        (rule.forbid.parallel-codepaths). its own file because it is the one piece a unit test
 *        can exercise — it crosses no boundary (rule.require.single-responsibility)
 */
export const asApiGatewayRequestEventOnwire = (input: {
  version: ApiGatewayOnwireVersion;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}): ApiGatewayRequestEventOnwire =>
  input.version === 'v2'
    ? asApiGatewayProxyEventV2(input)
    : asApiGatewayProxyEvent(input);
