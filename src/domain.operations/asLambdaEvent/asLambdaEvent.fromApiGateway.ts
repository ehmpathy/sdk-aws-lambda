import type {
  APIGatewayEventIdentity,
  APIGatewayEventRequestContext,
  APIGatewayProxyEvent,
} from 'aws-lambda';

import { AWS_ACCOUNT_SYNTHETIC } from '../../domain.objects/AwsIdentitySynthetic';
import {
  AWS_EVENT_AT_CLF,
  AWS_EVENT_AT_EPOCH_MS,
} from './asLambdaEvent.constants';

/**
 * .what = the requestContext api gateway sends on EVERY real request
 * .why = `forApiGateway` normalizes a v1 event and reads `requestContext.requestId`
 *        while it does so. an event without one throws a `TypeError` before any
 *        schema runs.
 *
 * 🔴 BOTH time stamps are owed — aws sends `requestTimeEpoch` (a number) and
 *    `requestTime` (common log format) on every request. send the first alone and
 *    a handler that reads the human one sees `undefined` in a test and a value in
 *    production. `requestTime` is DERIVED from the same epoch, so the two cannot
 *    name two instants.
 *
 * .note = `connectionId` is ABSENT — a websocket-api field, and this builder makes
 *   a REST/HTTP v1 event.
 */
const asRequestContext = (input: {
  httpMethod: string;
  path: string;
}): APIGatewayEventRequestContext => ({
  accountId: AWS_ACCOUNT_SYNTHETIC,
  apiId: 'example-api',
  authorizer: null,
  protocol: 'HTTP/1.1',
  httpMethod: input.httpMethod,
  identity: {
    accessKey: null,
    accountId: null,
    apiKey: null,
    apiKeyId: null,
    caller: null,
    clientCert: null,
    cognitoAuthenticationProvider: null,
    cognitoAuthenticationType: null,
    cognitoIdentityId: null,
    cognitoIdentityPoolId: null,
    principalOrgId: null,
    sourceIp: '127.0.0.1',
    user: null,
    userAgent: 'example-agent',
    userArn: null,
  },
  path: input.path,
  stage: 'test',
  requestId: '00000000-0000-4000-8000-000000000000',
  // aws sends BOTH — the epoch and its human twin. one literal, two views.
  requestTimeEpoch: AWS_EVENT_AT_EPOCH_MS,
  requestTime: AWS_EVENT_AT_CLF,
  // aws stamps this on every request; absent it a handler that logs it reads undefined
  extendedRequestId: 'example-extended-request-id',
  resourceId: 'example-resource',
  resourcePath: input.path,
});

/**
 * .what = casts a single-value map into the multi-value twin api gateway sends beside it
 * .why = api gateway delivers `headers` AND `multiValueHeaders`, and the same pair
 *   for query strings. a handler that reads the multi-value map (a `Set-Cookie`, a
 *   repeated `Accept`) would see `{}` where the wire delivers every header.
 */
const asMultiValue = (
  input: Record<string, string>,
): Record<string, string[]> =>
  Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, [value]]),
  );

/**
 * .what = casts a body to what api gateway puts on the wire — a string, or
 *         `null` where the request carried none
 * .why = a caller sends a STRING body; one who hands an object meant its json.
 *
 * 🔴 `null` and `undefined` must land on the SAME wire shape. an explicit
 *    `body: null` that falls through to `JSON.stringify(null)` yields the
 *    four-character string `'null'` — so a handler reads `'null'` in the test and
 *    `null` in production, the exact divergence this factory exists to remove. a
 *    GET or a preflight with an explicit `null` is the shape that meets it.
 *
 * .note = `?? null`, never a second `=== null` branch, so a third nullish sentinel
 *   cannot reintroduce the split.
 */
const asWireBody = (input: { body?: unknown }): string | null => {
  const bodyGiven = input.body ?? null;
  if (bodyGiven === null) return null;
  if (typeof bodyGiven === 'string') return bodyGiven;
  return JSON.stringify(bodyGiven);
};

/**
 * .what = casts a body into the api-gateway envelope aws delivers
 * .why = an api-gateway handler receives `{ body, headers, httpMethod, path,
 *        requestContext, ... }`, and the payload lives at `body` as a JSON STRING
 *
 * 🔴 .the fixture must not manufacture the defect it is meant to expose
 *
 * the incumbent omits two fields aws always sends, and each breaks the handler:
 *
 * | omitted | the result |
 * |---|---|
 * | `requestContext` | `forApiGateway` derefs `requestContext.requestId` ⇒ `TypeError` ⇒ handler answers 500 ⇒ every assertion past the status check is unreachable |
 * | `Accept` header | middy matches no response serializer ⇒ `body` comes back an OBJECT where api gateway needs a string ⇒ every `JSON.parse(result.body)` fails |
 *
 * ⚠️ three consumers have already forked a local repair (`ahbode/svc-gateway`,
 *    `svc-funnel-comms`, `svc-quotes`), and the svc-gateway fork names the
 *    upstream half: `ehmpathy/sdk-aws-lambda#18`. a fixture three consumers fork
 *    is a fixture whose CONTRACT is wrong, so this fixes it.
 *
 * @example
 * ```ts
 * const event = asLambdaEvent.fromApiGateway({ body: { slug }, httpMethod: 'POST' });
 *
 * // a test whose SUBJECT is the metadata sets it — the override wins
 * const event = asLambdaEvent.fromApiGateway({
 *   body,
 *   requestContext: { identity: { sourceIp: '10.0.0.1' } },
 * });
 * ```
 */
export const fromApiGateway = (input: {
  /**
   * the request body. an object is json-stringified, as a caller's request would send it.
   */
  body?: unknown;

  /**
   * the http method. GET by default.
   */
  httpMethod?: string;

  /**
   * the request path
   */
  path?: string;

  /**
   * headers to merge over the wire-faithful defaults
   */
  headers?: Record<string, string>;

  /**
   * query string parameters
   */
  queryStringParameters?: Record<string, string> | null;

  /**
   * path parameters
   */
  pathParameters?: Record<string, string> | null;

  /**
   * whether aws judged the body a base64-encoded binary. false by default.
   *
   * aws decides this from the request headers, so a test whose SUBJECT is a
   * binary body must be able to say so (ref: aws binary-media-types).
   */
  isBase64Encoded?: boolean;

  /**
   * requestContext fields to merge over the defaults
   *
   * 🔴 `identity` is partial TOO. a plain `Partial<…RequestContext>` leaves it
   *    whole, so `{ identity: { sourceIp } }` would demand all ~15 fields — and
   *    the merge below already supports that override. narrow it and the type
   *    forbids what the implementation supports.
   */
  requestContext?: Partial<Omit<APIGatewayEventRequestContext, 'identity'>> & {
    identity?: Partial<APIGatewayEventIdentity>;
  };
}): APIGatewayProxyEvent => {
  const httpMethod = input.httpMethod ?? 'GET';
  const path = input.path ?? '/';

  const body = asWireBody({ body: input.body });

  const headers = {
    // 🔴 without this, middy matches no response serializer and hands back an
    //    object where api gateway requires a string
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Host: 'example-api.execute-api.us-east-1.amazonaws.com',
    'User-Agent': 'example-agent',
    ...input.headers,
  };
  const queryStringParameters = input.queryStringParameters ?? null;

  return {
    body,
    headers,
    // 🔴 DERIVED, never hardcoded — aws sends the multi-value twin of every header
    //    on every real request, so a `{}` here is an omission the wire never makes
    multiValueHeaders: asMultiValue(headers),
    httpMethod,
    isBase64Encoded: input.isBase64Encoded ?? false,
    path,
    pathParameters: input.pathParameters ?? null,
    queryStringParameters,
    multiValueQueryStringParameters: queryStringParameters
      ? asMultiValue(queryStringParameters)
      : null,
    stageVariables: null,
    // 🔴 without this, forApiGateway derefs undefined and the handler answers 500
    requestContext: (() => {
      const base = asRequestContext({ httpMethod, path });
      return {
        ...base,
        ...input.requestContext,
        // 🔴 merged one level DEEPER than its peers — a shallow spread would
        //    REPLACE the whole object, so to name one field (a sourceIp, a
        //    userAgent) would silently drop the other fifteen and hand back an
        //    event LESS wire-faithful than the default
        identity: {
          ...base.identity,
          ...input.requestContext?.identity,
        },
      };
    })(),
    resource: path,
  };
};
