import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from 'aws-lambda';
import { MalfunctionError } from 'helpful-errors';

import type { ApiGatewayRequestEventOnwire } from '../../../domain.objects/ApiGatewayRequestEventOnwire';
import type { ApiGatewayRequestEventUnified } from './ApiGatewayRequestEventUnified';
import { asHeaderKeysLowercased } from './asHeaderKeysLowercased';
import { getIsV1ApiGatewayRequestEvent } from './getIsV1ApiGatewayRequestEvent';
import { getIsV2ApiGatewayRequestEvent } from './getIsV2ApiGatewayRequestEvent';

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
 * .what = reconciles either wire version into the unified shape, given the one value the
 *         versions disagree about at this point
 * .why = of the fields this shape carries, only the method sits at a different path — top level
 *        on v1, under `requestContext.http` on v2. every other field sits at the same path on
 *        both, so one function serves both and the unified shape gains a new field in one place
 *
 * .note = "at this point" is the whole qualifier. a second field differs — `version`, the
 *         discriminant — and it is already spent by the caller below
 *         (`getIsV2ApiGatewayRequestEvent`) to pick which arm calls this. so "one" is true of
 *         this function and false of the wire contract
 * .note = two more differ in value rather than position — v1 sends `null` for an absent body
 *         and path params where v2 sends `undefined` — and the `??` arms below absorb both,
 *         which is why neither earns a branch
 * .note = the url path is a v1/v2 divergence this shape does not reconcile, since it carries no
 *         url path string at all
 *
 * .note = the disputed value is handed in as a plain string rather than read through a
 *         per-version extractor, which would restore the duplication in a less legible form
 */
const asEventUnified = (input: {
  wire: APIGatewayProxyEvent | APIGatewayProxyEventV2;
  method: string;
  deserialize: { payload: boolean };
}): ApiGatewayRequestEventUnified & { httpMethod: string } => ({
  method: input.method,

  /**
   * .what = the compat key `@middy/http-cors` reads by name (`index.js:38,65,106`) — absent
   *        from `ApiGatewayRequestEventUnified`, present on the object
   * .why = this object is written into middy's own `request.event` slot, so the slot is not ours
   *        alone. drop the key and cors throws `'[http-cors] Unknown http event format'` from its
   *        `after` hook, on every cors-configured handler
   * .why not fork the two objects = `request.event` IS the handler's envelope, by reference, and
   *        that identity is what makes `headers === event.headers` true. a second object would
   *        buy one clean key and cost the projection
   *        (`rule.require.read-the-slot-a-dependency-reads`)
   */
  httpMethod: input.method,

  /**
   * .what = the case-fold, on both arms — rfc 9110 §5.1
   * .note = it also absorbs the absent bag v2 declares optional, so this line owes no `as`-cast
   */
  headers: asHeaderKeysLowercased({ headers: input.wire.headers }),

  /**
   * .what = the body, parsed. validated later, in place — `genZodInputValidationMiddleware`
   *         replaces this slot with the schema's output before `logic` runs
   * .why = so `event.payload` is the validated value at the only moment a handler can read
   *        it, which is what lets its type state the caller's shape rather than `unknown`
   */
  payload: input.deserialize.payload
    ? asParsedApiGatewayBody({
        body: input.wire.body,
        isBase64Encoded: input.wire.isBase64Encoded,
      })
    : input.wire.body,

  codec: { base64: input.wire.isBase64Encoded },
  params: {
    path: input.wire.pathParameters ?? null,
    query: input.wire.queryStringParameters ?? null,
  },
  _: { raw: input.wire },
});

/**
 * .what = what `deserialize` means when a caller declares none — one declaration, read by both
 *         this transformer and `forApiGateway`'s config (rule.forbid.parallel-codepaths)
 * .why payload = json is the common case, and a caller who wants the raw string opts out by
 *         value: `deserialize: { payload: false }`
 */
export const DESERIALIZE_DEFAULT: { payload: boolean } = { payload: true };

/**
 * .what = reconciles either api-gateway wire version into one shape
 * .why = the chain must read one shape whichever version the trigger delivered, so this runs
 *        first and every step after it reads `ApiGatewayRequestEventUnified`
 *
 * .why the input is `wire` and not `payload` = it holds the whole message, and `payload` names
 *        the request body and naught else (`domain.terms/payload.md`). named `payload`, this
 *        reads `asApiGatewayRequestEventUnified({ payload }).payload` — one word, two senses,
 *        one expression
 *
 * .note = a named transformer rather than middleware-local logic, so one implementation serves
 *         both entry points — `genApiGatewayRequestEventNormalizationMiddleware` delegates here
 *         (rule.forbid.parallel-codepaths)
 */
export const asApiGatewayRequestEventUnified = (
  input: { wire: ApiGatewayRequestEventOnwire },
  options?: { deserialize: { payload: boolean } },
): ApiGatewayRequestEventUnified & { httpMethod: string } => {
  const deserialize = options?.deserialize ?? DESERIALIZE_DEFAULT;

  // v2 http-api: the method lives under `requestContext.http`
  if (getIsV2ApiGatewayRequestEvent(input.wire)) {
    const wire = input.wire;

    return asEventUnified({
      wire,
      method: wire.requestContext.http.method,
      deserialize,
    });
  }

  // v1 rest-api: the method lives at the top level
  if (getIsV1ApiGatewayRequestEvent(input.wire)) {
    const wire = input.wire;

    return asEventUnified({
      wire,
      method: wire.httpMethod,
      deserialize,
    });
  }

  // fail loud rather than hand a handler a shape neither branch produced
  return MalfunctionError.throw(
    'wire is neither v1 nor v2 api gateway event shaped',
    { wire: input.wire },
  );
};
