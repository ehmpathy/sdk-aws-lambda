import middy from '@middy/core';
import httpCors from '@middy/http-cors';
import httpResponseSerializer from '@middy/http-response-serializer';
import httpSecurityHeaders from '@middy/http-security-headers';
import type { Context } from 'aws-lambda';
import { MalfunctionError } from 'helpful-errors';
import type { ContextLogTrail } from 'sdk-logs';
import type { ZodSchema } from 'zod';

import type { ApiGatewayRequestPayload } from '../../../domain.objects/ApiGatewayRequestPayload';
import type { ApiGatewayResponse } from '../../../domain.objects/ApiGatewayResponse';
import type { ApiGatewayResponsePayload } from '../../../domain.objects/ApiGatewayResponsePayload';
import type { ContextAwsLambdaServer } from '../../../domain.objects/ContextAwsLambdaServer';
import { asContextLogTrail } from '../asContextLogTrail';
import { genConstraintErrorMiddleware } from '../middleware/genConstraintErrorMiddleware';
import { genInternalServiceErrorMiddleware } from '../middleware/genInternalServiceErrorMiddleware';
import { genIntrospectionMiddleware } from '../middleware/genIntrospectionMiddleware';
import { genIoLoggerMiddleware } from '../middleware/genIoLoggerMiddleware';
import { genTrailMiddleware } from '../middleware/genTrailMiddleware';
import { getValidatedOutput } from '../middleware/getValidatedOutput';
import type { TranslateLog } from '../TranslateLog';
import { asApiGatewayResponsePayload } from './asApiGatewayResponsePayload';
import { asApiGatewayResponsePayloadJson } from './asApiGatewayResponsePayloadJson';
import { DESERIALIZE_DEFAULT } from './asUnifiedApiGatewayEvent';
import { getAllWirePayloadKeysFound } from './getAllWirePayloadKeysFound';
import { isApiGatewayResponse } from './isApiGatewayResponse';
import { genApiGatewayEventNormalizationMiddleware } from './middleware/genApiGatewayEventNormalizationMiddleware';
import { genContentTypeCoherenceMiddleware } from './middleware/genContentTypeCoherenceMiddleware';
import { genZodBodyValidationMiddleware } from './middleware/genZodBodyValidationMiddleware';
import type { UnifiedApiGatewayEvent } from './UnifiedApiGatewayEvent';

/**
 * .what = the cors contract for an api-gateway handler
 *
 * ⚠️ .limits = TWO, both LIVE and both INHERITED — `main` and `simple-lambda-handlers` carry
 *      the identical pair. `[case11]` and `[case8]` of `local.wireResponse.acceptance.test.ts`
 *      assert the limited bytes and are GREEN, so each goes RED when repaired. writeup:
 *      `.behavior/…/seeds/issue.cors-and-headers-on-every-non-success-path.md`
 *
 *   1. **a preflight is answered by YOUR HANDLER.** `@middy/http-cors` defaults
 *      `disableBeforePreflightResponse: true` (`index.js:16`), so an `OPTIONS` falls through
 *      the chain — and succeeds only where `schema.input` accepts a body-less request
 *
 *   2. **no error response carries cors or owasp headers.** both vendors' `onError` hooks open
 *      `if (request.response === undefined) return` and sit ABOVE the error builders that set
 *      it, so both no-op. every 400 and 500 ships bare
 *
 * ⚠️ .unverified = whether either is reachable in a DEPLOYED api gateway, which commonly answers
 *      `OPTIONS` at the gateway with a MOCK integration. both were measured against the LOCAL
 *      harness, where every request reaches the handler
 */
export interface CorsConfig {
  /**
   * .what = origins to accept for cors
   * .why = sets Access-Control-Allow-Origin header
   *
   * special:
   * - '*' = accept all origins (browser will be told server expects requests from all origins)
   * - string[] = accept only listed origins (dynamic match against request origin)
   */
  origins: '*' | string[];

  /**
   * .what = whether to allow credentials (cookies) in cross-origin requests
   * .why = sets Access-Control-Allow-Credentials header
   *
   * note: if origins is '*' and credentials is true, the actual request origin
   * will be echoed (browsers don't allow '*' with credentials)
   */
  credentials: boolean;

  /**
   * .what = headers allowed in cors requests
   * .why = sets Access-Control-Allow-Headers header
   *
   * defaults to 'content-type,authorization'
   */
  headers?: string;
}

/**
 * .what = input type for forApiGateway
 * .why = sdk contract type, exported for consumer type inference
 */
export type ForApiGatewayInput<TInput, TBody> = {
  schema: {
    /**
     * .what = describes `inputAfter` — what `invoke` receives
     * .why = guards the point of consequence on the way in: a caller who sent the wrong
     *        shape is refused before the handler runs
     */
    input: ZodSchema<TInput>;

    /**
     * .what = describes `outputBefore` — the whole response `invoke` returns
     * .why = guards the point of consequence on the way out: a handler that built the
     *        wrong response is refused before the encode turns it into bytes
     *
     * .note = this describes the ENVELOPE, never the body inside it. use
     *         `asApiGatewayResponseSchema({ body })` to lift a body schema into one, and
     *         `z.any()` to opt out of validation entirely
     */
    output: ZodSchema<ApiGatewayResponse<TBody>>;
  };
  invoke: (
    input: {
      /**
       * .what = `inputAfter` — the validated body
       */
      event: TInput;

      /**
       * .what = the v1/v2-reconciled request; the wire payload itself is at `._.raw`
       *
       * ⚠️ .misnomer — this is NOT raw, it is normalized. the rename (`rawEvent` -> `payload`)
       *         is designed and unapplied, gated behind 🚧 F31
       */
      rawEvent: UnifiedApiGatewayEvent;
    },
    context: ContextLogTrail,
  ) => Promise<ApiGatewayResponse<TBody>>;
  /**
   * .what = projections applied to the io before it reaches cloudwatch
   *
   * ⚠️ .defect = LIVE, NOT FIXED — `logTranslate.input` NEVER RUNS for this family; only
   *              `.output` fires. so a projection written here to redact request bodies is dead
   *              code, and the log it would have shaped is never emitted at all. ⚠️ **redact
   *              inside `invoke` instead**
   *
   * .the cause = `genIoLoggerMiddleware`'s `before` reads `context.log`, which
   *              `genTrailMiddleware`'s `before` writes — and trail sits at a HIGHER index, so it
   *              has not run yet. `before` hooks run in FORWARD array order
   *
   * .proof it is live = `[case16][t1]` asserts the log branch does NOT run, and is GREEN. `[t0]`
   *              is its positive control — same middleware, same option, trail at a lower index
   *
   * .repair, UNAPPLIED = move `genTrailMiddleware()` from index 8 to index 3. blast radius,
   *              probed: ONE assertion. left because `main` carries the identical order and the
   *              move also puts trail ahead of event normalization
   */
  logTranslate?: TranslateLog;
  cors?: CorsConfig;
  deserialize?: {
    /**
     * .what = whether to deserialize json body
     * .why = converts json string body to object when content-type is application/json
     *
     * defaults to true; set to false for raw string input
     */
    body: boolean;
  };
};

/** .what = sdk contract type for forApiGateway context, exported for consumer inference */
export type ForApiGatewayContext = ContextAwsLambdaServer;

/** .what = converts this sdk's cors config into `@middy/http-cors` options */
const corsInputToCorsConfig = (cors: CorsConfig) => {
  return {
    /**
     * ⚠️ .what = supplies EITHER `origin` or `origins`, and OMITS the key it does not supply.
     *        NEVER pass a key you do not mean to set — not `maxAge`, not any later addition
     * .why = `@middy/http-cors` merges as `{ ...defaults, ...opts }` (`index.cjs:44-47`), so an
     *        explicit `undefined` CLOBBERS the default. its `origins` default is `[]` and
     *        `getOrigin` opens with `options.origins.length` (`index.cjs:12-13`), so
     *        `origins: undefined` throws from `after` and turns every success into a 500
     */
    ...(cors.origins === '*' ? { origin: '*' } : { origins: cors.origins }),
    credentials: cors.credentials,
    headers: cors.headers ?? 'content-type,authorization',

    /**
     * ⚠️ .absent by choice = `disableBeforePreflightResponse: false` would turn on the vendor's
     *      `OPTIONS` short-circuit — limit 1 on `CorsConfig`. blast radius, probed: ONE case
     *      (`[case11]` moves to a 204). left because it changes `OPTIONS` for every
     *      cors-configured handler, and one that answers `OPTIONS` itself would lose the request
     */
  };
};

const serializers = [
  {
    regex: /^application\/json$/,
    serializer: ({ body }: { body: unknown }) => JSON.stringify(body),
  },
];

/**
 * .what = generates an api-gateway lambda handler with http features
 * .why = adds cors, security headers, error conversion, body serialization, and validation
 */
export const forApiGateway = <TInput, TBody>(
  config: ForApiGatewayInput<TInput, TBody>,
  context?: ContextAwsLambdaServer,
): middy.MiddyfiedHandler<
  ApiGatewayRequestPayload,
  ApiGatewayResponsePayload,
  Error,
  Context
> => {
  const deserialize = config.deserialize ?? DESERIALIZE_DEFAULT;

  /**
   * .what = the handler's own step: invoke, assure, validate, encode
   * .why = by here the chain has reconciled the request and refused a wrong body shape, so
   *        this reads as narrative
   */
  const logic = async (
    event: UnifiedApiGatewayEvent,
    lambdaContext: Context,
  ): Promise<ApiGatewayResponsePayload<TBody>> => {
    // read the trail log `genTrailMiddleware` wrote; the cast lives in the shared reader
    const { log } = asContextLogTrail({ context: lambdaContext });

    /**
     * .as = `event.body` is `TInput` by the time this runs, because
     *       `genZodBodyValidationMiddleware` has already parsed it against `schema.input`
     *       and replaced it with the parsed value
     * .removal = drops when the input translate owns this seam, which needs `inputAfter` to
     *            have one home across both chains — see the 🚧 note in the execution yield
     */
    const response = await config.invoke(
      { event: event.body as TInput, rawEvent: event },
      { log },
    );

    /**
     * .what = refuses the aws WIRE shape, and names the rename that fixes it
     * .why = `isApiGatewayResponse` rejects it too, but `withAssure` takes a name and no message,
     *        so its throw can only say "does not satisfy type.check". the likeliest upgrade
     *        mistake earns the fix by name (rule.require.errors-name-the-fix)
     * .why MalfunctionError = the handler author is at fault, not the http caller. a
     *        ConstraintError would answer 400 and tell the caller THEY erred, which is false
     *        (invariant.badrequesterror-not-lambda-error)
     */
    const keysOfWirePayload =
      typeof response === 'object' && response !== null
        ? getAllWirePayloadKeysFound({ response })
        : [];
    if (keysOfWirePayload.length)
      MalfunctionError.throw(
        'handler returned the aws wire payload shape rather than an ApiGatewayResponse',
        {
          keysOfWirePayload,
          fix: 'rename `statusCode` to `status`, and return the body as a value rather than a JSON string',
          response,
        },
      );

    // the throw above took every wire-payload response, so this closes the REST — a string, an
    // array, a null. one names a fix for the likely mistake; this one covers the others
    isApiGatewayResponse.assure(response);

    // validate the whole response envelope against the declared output schema
    const validatedResponse = getValidatedOutput({
      response,
      schema: config.schema.output,
    });

    // the wire encode — status defaults here, before any middleware observes the response
    return asApiGatewayResponsePayload({ response: validatedResponse });
  };

  // 0. content-type coherence  (after + onError) - drops Content-Type when the body is absent
  // 1. constraint error        (onError)  - a caller fault becomes a 400
  // 2. internal service error  (onError)  - any other throw becomes a 500
  // 3. io logger               (before/after/onError) - debug observability
  // 4. response serializer     (after)    - encodes the body; skips a preset Content-Type
  // 5. cors                    (after)    - adds cors headers
  // 6. security headers        (after)    - adds owasp headers
  // 7. event normalization     (before)   - reconciles a v1/v2 request
  // 8. trail                   (before)   - injects trail context
  // 9. introspection           (before)   - short-circuits an introspect request
  // 10. body validation        (before)   - validates event.body against schema.input
  //
  // ⚠️ ORDER IS LOAD-BEARING, ON TWO AXES — middy holds the hook phases in OPPOSITE orders, and
  //    a break on either axis no-ops silently: no throw, no log, no type error. state your
  //    entry's needs against BOTH before you place it.
  //
  //    ── `before` — FORWARD order ──  an entry that READS what another `before` PRODUCES sits
  //       at a HIGHER index. producers: 7 -> unified `request.event`; 8 -> `request.context.log`
  //       + `isContempCaller`; 10 -> the validated `event.body`
  //
  //    ── `after` / `onError` — REVERSE order (middy `unshift`s them) ──  an entry whose
  //       `onError` READS `request.response` sits at a LOWER index than the builders (1,2) that
  //       SET it. entry 0 is last on both hooks, which is the only slot that can correct a
  //       header the serializer already stamped
  //
  //    the `onError` family that reads `request.response` — membership by CAUSE, never by guard
  //    syntax (the vendors test `=== undefined`, the io logger tests truthiness):
  //      ✅ 0  genContentTypeCoherenceMiddleware  -> runs LAST, sees the response
  //      ⛔ 3  genIoLoggerMiddleware              -> runs EARLY, response undefined
  //      ⛔ 5  @middy/http-cors                   -> so NO cors on a 4xx/5xx
  //      ⛔ 6  @middy/http-security-headers       -> so NO owasp on a 4xx/5xx
  //
  //    the three ⛔ are ONE deferred fix (F32) — the reorder also moves the SUCCESS-path `after`
  //    order for every handler. the `before` axis is violated too; see the note on entry 3.
  const middlewares = [
    genContentTypeCoherenceMiddleware(),
    /**
     * .note = both keep the invocation a SUCCESS — a caller fault must not emit a cloudwatch
     *         error (invariant.badrequesterror-not-lambda-error) — and the 500 body carries a
     *         generic message plus the correlation id, never the error's own message
     *
     * .note = this family is ALWAYS-ANCIENT by construction, so the shared middleware's
     *         `isContempCaller` branch resolves one way and needs no guard: an http payload is
     *         an api-gateway envelope, which `getIsWrappedPayload` cannot match, and where trail
     *         never ran `asContextTrailed` defaults the flag to `false`
     */
    genConstraintErrorMiddleware({
      asOutputAfter: (body) =>
        asApiGatewayResponsePayloadJson({ status: 400, body }),
    }),
    genInternalServiceErrorMiddleware({
      asOutputAfter: ({ exid }) =>
        asApiGatewayResponsePayloadJson({
          status: 500,
          body: {
            errorMessage: 'internal server error',
            errorType: 'InternalServiceError',
            ...(exid ? { correlationId: exid } : {}),
          },
        }),
    }),
    /**
     * ⚠️ .breaks the `before` axis, deliberately — this reads `request.context.log`, which
     *      `genTrailMiddleware` (8) produces, so `handler.input` never logs. the record is on
     *      `logTranslate`; the repair moves TRAIL to index 3, never this entry — trail declares
     *      only a `before`, so its move cannot disturb the `after`/`onError` order
     */
    genIoLoggerMiddleware({ logTranslate: config.logTranslate }),
    httpResponseSerializer({
      serializers,
      defaultContentType: 'application/json',
    }),
    /**
     * ⚠️ .breaks the `onError` axis, deliberately — these two sit BELOW the error builders, so
     *      their `onError` hooks run first, see no response, and no-op. that is limit 2 on
     *      `CorsConfig`. the repair also moves their `after` hooks relative to the serializer,
     *      so it changes every SUCCESS response's headers too
     */
    ...(config.cors ? [httpCors(corsInputToCorsConfig(config.cors))] : []),
    httpSecurityHeaders({
      frameOptions: { action: 'DENY' },
    }),
    genApiGatewayEventNormalizationMiddleware({ parseBody: deserialize.body }),
    genTrailMiddleware(),
    genIntrospectionMiddleware({
      schema: config.schema,
      env: context?.env,
      /**
       * .what = this family keeps `inputAfter` at `event.body`, and owes a WIRE payload back
       * .why = `request.event` must stay http-shaped for `@middy/http-cors`, so the caller's
       *        value rides at `event.body` rather than in the event's place. and the
       *        short-circuit bypasses the serializer, so the body is stringified here
       */
      asInputAfter: (request) => request.event?.body,
      asOutputAfter: (schema) =>
        asApiGatewayResponsePayloadJson({ status: 200, body: schema }),
    }),
    genZodBodyValidationMiddleware({ schema: config.schema.input }),
  ];

  /**
   * .as = the chain translates both ends, and typescript cannot track a transform across a
   *       middleware chain:
   *       - input:  ApiGatewayRequestPayload         -> TInput  (before logic)
   *       - output: ApiGatewayResponsePayload<TBody> -> ApiGatewayResponsePayload (after)
   *       the second is the serializer's step — it encodes the body to bytes
   * .removal = drops if middy gains typed inference across `.use`; every shape it spans is
   *            already named, so only the cast is owed
   */
  return middy(
    logic as unknown as (
      event: ApiGatewayRequestPayload,
      context: Context,
    ) => Promise<ApiGatewayResponsePayload>,
  ).use(middlewares);
};
