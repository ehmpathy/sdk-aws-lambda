import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from 'aws-lambda';
import { MalfunctionError } from 'helpful-errors';

import type { ApiGatewayRequestPayload } from '../../../domain.objects/ApiGatewayRequestPayload';
import { getIsV1ApiGatewayEvent } from './getIsV1ApiGatewayEvent';
import { getIsV2ApiGatewayEvent } from './getIsV2ApiGatewayEvent';
import type { UnifiedApiGatewayEvent } from './UnifiedApiGatewayEvent';

/**
 * .what = parses a json body string into an object, base64-decoded first when flagged
 * .why = api gateway hands the body over as a string; most handlers want the object
 *
 * .note = a body that is not json is returned as the decoded string rather than refused —
 *         a form-encoded twilio webhook is a legitimate caller, and its own schema (or
 *         `z.any()`) is where that shape gets judged
 */
const asParsedApiGatewayBody = (input: {
  body: string | null | undefined;
  isBase64Encoded: boolean;
}): unknown => {
  if (!input.body) return null;

  const decoded = input.isBase64Encoded
    ? Buffer.from(input.body, 'base64').toString('utf-8')
    : input.body;

  try {
    return JSON.parse(decoded);
  } catch (error) {
    /**
     * .what = allowlists the ONE error a non-json body can raise, and rethrows every other
     * .why = a bare `catch` would swallow a TypeError from a real defect, and the swallowed
     *        value would reach the handler as plain text (rule.forbid.failhide). `SyntaxError`
     *        is the only class `JSON.parse` throws for malformed input, per ecma-262 §25.5.1,
     *        so the allowlist is exhaustive rather than a guess
     */
    if (!(error instanceof SyntaxError)) throw error;

    return decoded;
  }
};

/**
 * .what = reconciles either payload version into the unified shape, given the TWO values the
 *         versions disagree about
 * .why = v1 and v2 differ in exactly two places — the method and path, top-level on v1 and
 *        under `requestContext.http` on v2. every OTHER field sits at the same path on both, so
 *        one function serves both and the unified shape gains a new field in ONE place
 *
 * .note = the two disputed values are handed in as plain strings rather than read through a
 *         per-version extractor, which would restore the duplication in a less legible form
 */
const asUnifiedEvent = (input: {
  payload: APIGatewayProxyEvent | APIGatewayProxyEventV2;
  httpMethod: string;
  path: string;
  deserialize: { body: boolean };
}): UnifiedApiGatewayEvent => ({
  httpMethod: input.httpMethod,
  path: input.path,
  /**
   * .as = v1 declares `headers` REQUIRED and v2 declares it optional, so the union's member is
   *       `… | undefined`, which the unified shape does not carry
   * .removal = drops once `UnifiedApiGatewayEvent.headers` is itself optional. left because
   *       every consumer reads `event.headers[x]`, and `@middy/http-cors` reads this slot too
   *       (rule.require.read-the-slot-a-dependency-reads) — so the change is not local
   */
  headers: input.payload.headers as Record<string, string | undefined>,
  queryStringParameters: input.payload.queryStringParameters ?? null,
  pathParameters: input.payload.pathParameters ?? null,
  body: input.deserialize.body
    ? asParsedApiGatewayBody({
        body: input.payload.body,
        isBase64Encoded: input.payload.isBase64Encoded,
      })
    : input.payload.body,
  rawBody: input.payload.body ?? null,
  isBase64Encoded: input.payload.isBase64Encoded,
  requestContext: {
    requestId: input.payload.requestContext.requestId,
    stage: input.payload.requestContext.stage,
    domainName: input.payload.requestContext.domainName,
    accountId: input.payload.requestContext.accountId,
  },
  _: { raw: input.payload },
});

/**
 * .what = what `deserialize` means when a caller declares none — ONE declaration, read by both
 *         this transformer and `forApiGateway`'s config (rule.forbid.parallel-codepaths)
 * .why body = json is the common case, and a caller who wants the raw string opts out by value:
 *         `deserialize: { body: false }`
 */
export const DESERIALIZE_DEFAULT: { body: boolean } = { body: true };

/**
 * .what = reconciles either api-gateway payload version into one shape
 * .why = the chain must read one shape whichever version the trigger delivered, so this runs
 *        first and every step after it reads `UnifiedApiGatewayEvent`
 *
 * .note = a named transformer rather than middleware-local logic, so ONE implementation serves
 *         both entry points — `genApiGatewayEventNormalizationMiddleware` delegates here
 *         (rule.forbid.parallel-codepaths)
 */
export const asUnifiedApiGatewayEvent = (
  input: { payload: ApiGatewayRequestPayload },
  options?: { deserialize: { body: boolean } },
): UnifiedApiGatewayEvent => {
  const deserialize = options?.deserialize ?? DESERIALIZE_DEFAULT;

  // v2 http-api: the method and path live under `requestContext.http`
  if (getIsV2ApiGatewayEvent(input.payload)) {
    const payload = input.payload;

    return asUnifiedEvent({
      payload,
      httpMethod: payload.requestContext.http.method,
      path: payload.requestContext.http.path,
      deserialize,
    });
  }

  // v1 rest-api: the method and path live at the top level
  if (getIsV1ApiGatewayEvent(input.payload)) {
    const payload = input.payload;

    return asUnifiedEvent({
      payload,
      httpMethod: payload.httpMethod,
      path: payload.path,
      deserialize,
    });
  }

  // fail loud rather than hand a handler a shape neither branch produced
  return MalfunctionError.throw(
    'payload is neither v1 nor v2 api gateway event shaped',
    { payload: input.payload },
  );
};
