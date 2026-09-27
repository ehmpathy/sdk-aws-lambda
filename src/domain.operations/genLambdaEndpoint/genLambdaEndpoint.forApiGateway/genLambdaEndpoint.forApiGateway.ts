import middy from '@middy/core';
import httpCors from '@middy/http-cors';
import httpResponseSerializer from '@middy/http-response-serializer';
import httpSecurityHeaders from '@middy/http-security-headers';
import type { Context } from 'aws-lambda';
import { MalfunctionError } from 'helpful-errors';
import type { ContextLogTrail } from 'sdk-logs';
import type { ZodSchema } from 'zod';

import type { ApiGatewayRequestEventOnwire } from '../../../domain.objects/ApiGatewayRequestEventOnwire';
import type { ApiGatewayResponse } from '../../../domain.objects/ApiGatewayResponse';
import type { ApiGatewayResponseOnwire } from '../../../domain.objects/ApiGatewayResponseOnwire';
import type { ContextAwsLambdaServer } from '../../../domain.objects/ContextAwsLambdaServer';
import { asContextLogTrail } from '../asContextLogTrail';
import { genConstraintErrorMiddleware } from '../middleware/genConstraintErrorMiddleware';
import { genInternalServiceErrorMiddleware } from '../middleware/genInternalServiceErrorMiddleware';
import { genIntrospectionMiddleware } from '../middleware/genIntrospectionMiddleware';
import { genIoLoggerMiddleware } from '../middleware/genIoLoggerMiddleware';
import { genTrailMiddleware } from '../middleware/genTrailMiddleware';
import { getValidatedOutput } from '../middleware/getValidatedOutput';
import { type FrozenDeep, setEventFrozen } from '../setEventFrozen';
import type { TranslateLog } from '../TranslateLog';
import type {
  ApiGatewayHeadersDeclared,
  ApiGatewayHeadersMerged,
  ApiGatewayRequestEventUnified,
} from './ApiGatewayRequestEventUnified';
import { DESERIALIZE_DEFAULT } from './asApiGatewayRequestEventUnified';
import { asApiGatewayResponseOnwire } from './asApiGatewayResponseOnwire';
import { asApiGatewayResponseOnwireJson } from './asApiGatewayResponseOnwireJson';
import { getAllResponseOnwireKeysFound } from './getAllResponseOnwireKeysFound';
import { isApiGatewayResponse } from './isApiGatewayResponse';
import { genApiGatewayRequestEventNormalizationMiddleware } from './middleware/genApiGatewayRequestEventNormalizationMiddleware';
import { genContentTypeCoherenceMiddleware } from './middleware/genContentTypeCoherenceMiddleware';
import { genZodInputValidationMiddleware } from './middleware/genZodInputValidationMiddleware';

/**
 * .what = the cors contract for an api-gateway handler
 *
 * .limits = two, both live. `[case11]` and `[case8]` of `local.httpResponse.acceptance.test.ts`
 *      assert the limited bytes, and the writeup is
 *      `.behavior/v2026_08_03.feat-apigateway-wire-response/seeds/issue.cors-and-headers-on-every-non-success-path.md`
 *
 *   1. a preflight is answered by YOUR HANDLER. `@middy/http-cors` defaults
 *      `disableBeforePreflightResponse: true` (`index.js:16`), so an `OPTIONS` falls through
 *      the chain — and succeeds only where `schema.input` accepts a body-less request
 *
 *   2. no error response carries cors or owasp headers. both vendors' `onError` hooks open
 *      `if (request.response === undefined) return` and sit above the error builders that set
 *      it, so both no-op. every 400 and 500 ships bare
 *
 * .unverified = whether either is reachable in a DEPLOYED api gateway, which commonly answers
 *      `OPTIONS` at the gateway with a mock integration. both are measured against the local
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
 *
 * .why `THeaders` is bound = the validator spreads the validated headers back over the wire bag
 *        (`genZodInputValidationMiddleware.ts:111`), so a `THeaders` that is not a record spreads
 *        as one: `{ ...'abc' }` yields `{ 0: 'a', 1: 'b', 2: 'c' }`, injected into the very slot
 *        `@middy/http-cors` reads. unbound, `headers: z.string()` type-checks and then fails at
 *        run time with no throw (`rule.require.illegal-states-unrepresentable`)
 *
 * .why the bound is a NAMED type = it holds at three declaration sites, one of them a
 *        separately-importable public export with no clamp of its own. written out three times it
 *        is kept in sync by prose; named once, a divergence is a type error at the declaration
 *        that drifts. see `ApiGatewayHeadersDeclared` for the shape and its reason
 */
export type ForApiGatewayInput<
  THeaders extends ApiGatewayHeadersDeclared,
  TPayload,
  TBody,
> = {
  schema: {
    /**
     * .what = describes `inputAfter` — the PAIR `invoke` receives, `{ headers?, payload }`
     * .why = guards the point of consequence on the way in: a caller who sent the wrong
     *        shape is refused before the handler runs
     *
     * .note = `payload` is REQUIRED and `headers` is OPTIONAL, and the asymmetry traces to an
     *         axis rather than to taste. body validation is an EXTANT guarantee — 78 sites
     *         already get it, so an absent key would silently drop it. header validation is a
     *         NEW capability — headers have never been validated, so an absent key is the
     *         status quo and no request that succeeds today can be refused
     *         (`domain.terms/headers.md`)
     *
     * .note = declare `headers` and zod strips the keys you did not name — but only from the
     *         value YOUR schema returns. the sdk merges that back over the wire bag, so
     *         `origin` and `accept` stay readable by the vendors that need them
     */
    input: ZodSchema<{ headers?: THeaders; payload: TPayload }>;

    /**
     * .what = describes `outputBefore` — the whole response `invoke` returns
     * .why = guards the point of consequence on the way out: a handler that built the
     *        wrong response is refused before the encode turns it into bytes
     *
     * .note = this describes the ENVELOPE, never the body inside it. use
     *         `asApiGatewayResponseSchema({ payload })` to lift a body schema into one, and
     *         `z.any()` to opt out of validation entirely
     */
    output: ZodSchema<ApiGatewayResponse<TBody>>;
  };
  invoke: (
    input: {
      /**
       * .what = the request headers, keys lowercased — rfc 9110 §5.1 makes http field names
       *         case-insensitive, so `headers['Authorization']` and `headers['authorization']`
       *         cannot be two different keys
       * .why lifted = it is the transport's metadata bag beside the body, a slot every family
       *         that carries such a bag names `headers` (`rule.require.consistent-variant-contracts`)
       * .note = this IS `event.headers` — one object, two access paths. never a copy
       * .why frozen = it is a slot of the envelope, so it freezes with it. `FrozenDeep` is what
       *         says so at compile time; see `event` below
       */
      headers: FrozenDeep<ApiGatewayHeadersMerged<THeaders>>;

      /**
       * .what = the body, parsed and validated against `schema.input.payload`
       * .why the word = http's own — rfc 9110 calls it the "payload body". the untouched wire
       *         string is at `event._.raw.body`; there is no unvalidated parsed body anywhere
       * .note = this IS `event.payload` — one object, two access paths
       * .why frozen = same as `headers`: a slot of the envelope, sealed with it
       */
      payload: FrozenDeep<TPayload>;

      /**
       * .what = the whole object that arrived, v1/v2 reconciled; the wire form is at `._.raw`
       * .why frozen = this is middy's own `request.event`, by reference — the object
       *         `@middy/http-cors` and `@middy/http-response-serializer` read in their `after`
       *         hooks, AFTER the handler has returned. a write through it corrupts what a vendor
       *         reads, so the freeze makes that unrepresentable
       * .why not a copy = a copy removes the same hazard and destroys the projection —
       *         `headers === event.headers` would stop to hold, and the two could drift
       *         (`domain.terms/event.md`)
       * .why `FrozenDeep` and not `Readonly` = `Readonly<T>` is shallow, so it would refuse
       *         `event.x = 1` and allow `event.headers.x = 1` — a write the deep runtime freeze
       *         then throws on, in production, with a `TypeError` that names no cause. this type
       *         states the guarantee the freeze enforces
       *         (`rule.require.illegal-states-unrepresentable`)
       */
      event: FrozenDeep<
        ApiGatewayRequestEventUnified<{
          headers: ApiGatewayHeadersMerged<THeaders>;
          payload: TPayload;
        }>
      >;
    },
    context: ContextLogTrail,
  ) => Promise<ApiGatewayResponse<TBody>>;
  /**
   * .what = projections applied to the io before it reaches cloudwatch
   *
   * .defect = LIVE, NOT FIXED — `logTranslate.input` never runs for this family; only `.output`
   *              fires. so a projection written here to redact request bodies is dead code, and
   *              the log it would have shaped is never emitted at all. redact inside `invoke`
   *              instead
   *
   *              .the cause = `genIoLoggerMiddleware`'s `before` reads `context.log`, which
   *              `genTrailMiddleware`'s `before` writes — and trail sits at a higher index, so it
   *              has not run yet. `before` hooks run in forward array order
   *
   *              .proof it is live = `[case16][t1]` asserts the log branch does not run, and is
   *              green. `[t0]` is its positive control — same middleware, same option, trail at a
   *              lower index
   *
   *              .repair, unapplied = move `genTrailMiddleware()` from index 8 to index 3. blast
   *              radius, probed: one assertion. left because `main` carries the identical order
   *              and the move also puts trail ahead of event normalization
   */
  logTranslate?: TranslateLog;
  cors?: CorsConfig;
  deserialize?: {
    /**
     * .what = whether to deserialize the json body into `event.payload`
     * .why = converts a json string body into an object
     *
     * .note = the key is `payload` because that is the slot it fills — `event.payload`. a
     *         toggle that named a field no shape carries is a toggle a reader cannot line up
     *
     * defaults to true; set to false for raw string input
     */
    payload: boolean;
  };
};

/** .what = sdk contract type for forApiGateway context, exported for consumer inference */
export type ForApiGatewayContext = ContextAwsLambdaServer;

/** .what = converts this sdk's cors config into `@middy/http-cors` options */
const corsInputToCorsConfig = (cors: CorsConfig) => {
  return {
    /**
     * .what = supplies either `origin` or `origins`, and omits the key it does not supply
     * .why = `@middy/http-cors` merges as `{ ...defaults, ...opts }` (`index.cjs:44-47`), so an
     *        explicit `undefined` clobbers the default. its `origins` default is `[]` and
     *        `getOrigin` opens with `options.origins.length` (`index.cjs:12-13`), so
     *        `origins: undefined` throws from `after` and turns every success into a 500
     * .note = so pass no key you do not mean to set — not `maxAge`, not any later addition
     */
    ...(cors.origins === '*' ? { origin: '*' } : { origins: cors.origins }),
    credentials: cors.credentials,
    headers: cors.headers ?? 'content-type,authorization',

    /**
     * .absent by choice = `disableBeforePreflightResponse: false` would turn on the vendor's
     *      `OPTIONS` short-circuit — limit 1 on `CorsConfig`. blast radius, probed: one case
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
export const forApiGateway = <
  THeaders extends ApiGatewayHeadersDeclared,
  TPayload,
  TBody,
>(
  config: ForApiGatewayInput<THeaders, TPayload, TBody>,
  context?: ContextAwsLambdaServer,
): middy.MiddyfiedHandler<
  ApiGatewayRequestEventOnwire,
  ApiGatewayResponseOnwire,
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
    event: ApiGatewayRequestEventUnified<{
      headers: ApiGatewayHeadersMerged<THeaders>;
      payload: TPayload;
    }>,
    lambdaContext: Context,
  ): Promise<ApiGatewayResponseOnwire<TBody>> => {
    // read the trail log `genTrailMiddleware` wrote; the cast lives in the shared reader
    const { log } = asContextLogTrail({ context: lambdaContext });

    /**
     * .what = seals the envelope before the handler can touch it
     * .why = `event` IS middy's `request.event`, by reference, and two vendors read it in their
     *        `after` hooks — after `invoke` has returned. a handler that writes through it
     *        corrupts what they read, with no error anywhere
     * .why deep = a shallow freeze leaves `event.headers`, `event.params`, and `event._.raw`
     *        writable, and `headers` is exactly the object `@middy/http-cors` reads
     *        (`index.js:83`)
     * .why safe = measured across the five installed `@middy/*` packages: 8 reads of
     *        `request.event`, and 0 writes. every sdk write to it is a `before` hook, so none
     *        survives to here (`domain.terms/event.md`)
     *
     * .residual = `@middy/http-json-body-parser` does write `request.event.body`
     *        (`index.js:25`) and would throw under this freeze. it is imported nowhere in
     *        `src/` — this sdk parses the body itself, in `asApiGatewayRequestEventUnified`
     */
    const eventFrozen = setEventFrozen({ event });

    /**
     * .what = hands over the pair plus the envelope; the two lifted fields are PROJECTIONS of
     *         its slots
     * .note = read from `eventFrozen` rather than `event` — it is the SAME reference (the freeze
     *         is in place), and the narrowed type is what carries the readonly guarantee to the
     *         handler. a read off `event` would hand over the pre-freeze type and silently drop it
     */
    const response = await config.invoke(
      {
        headers: eventFrozen.headers,
        payload: eventFrozen.payload,
        event: eventFrozen,
      },
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
    const keysOfResponseOnwire =
      typeof response === 'object' && response !== null
        ? getAllResponseOnwireKeysFound({ response })
        : [];
    if (keysOfResponseOnwire.length)
      MalfunctionError.throw(
        'handler returned the aws ApiGatewayResponseOnwire shape rather than an ApiGatewayResponse',
        {
          keysOfResponseOnwire,
          fix: 'rename `statusCode` to `status`, and return the body as a value rather than a JSON string',
          response,
        },
      );

    // the throw above took every response-wire shape, so this closes the REST — a string, an
    // array, a null. one names a fix for the likely mistake; this one covers the others
    isApiGatewayResponse.assure(response);

    // validate the whole response envelope against the declared output schema
    const validatedResponse = getValidatedOutput({
      response,
      schema: config.schema.output,
    });

    // the wire encode — status defaults here, before any middleware observes the response
    return asApiGatewayResponseOnwire({ response: validatedResponse });
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
  // 10. input validation       (before)   - validates { headers, payload } against schema.input
  //
  // the order carries the load, on two axes — middy holds the hook phases in opposite orders, and
  // a break on either axis no-ops silently: no throw, no log, no type error. state your entry's
  // needs against both before you place it.
  //
  //   `before` — forward order. an entry that reads what another `before` produces sits at a
  //      higher index. producers: 7 -> unified `request.event`; 8 -> `request.context.log` +
  //      `isContempCaller`; 10 -> the validated `event.headers` + `event.payload`
  //
  //   `after` / `onError` — reverse order, since middy `unshift`s them. an entry whose `onError`
  //      reads `request.response` sits at a lower index than the builders (1,2) that set it.
  //      entry 0 is last on both hooks, the only slot that can correct a header the serializer
  //      already stamped
  //
  // the `onError` family that reads `request.response` — membership by cause, never by guard
  // syntax (the vendors test `=== undefined`, the io logger tests truthiness):
  //    0  genContentTypeCoherenceMiddleware  -> runs last, sees the response
  //    3  genIoLoggerMiddleware              -> runs early, response undefined
  //    5  @middy/http-cors                   -> so no cors on a 4xx/5xx
  //    6  @middy/http-security-headers       -> so no owasp on a 4xx/5xx
  //
  // the three that no-op are one deferred fix — the reorder also moves the success-path `after`
  // order for every handler. the `before` axis is violated too; see the note on entry 3.
  // `.dream/v2026_09_22.fix.no-cors-or-owasp-headers-on-error-responses.md`
  const middlewares = [
    genContentTypeCoherenceMiddleware(),
    /**
     * .note = both keep the invocation a success — a caller fault must not emit a cloudwatch
     *         error (invariant.badrequesterror-not-lambda-error) — and the 500 body carries a
     *         generic message plus the correlation id, never the error's own message
     *
     * .note = this family is always-ancient by construction, so the shared middleware's
     *         `isContempCaller` branch resolves one way and needs no guard: an http payload is
     *         an api-gateway envelope, which `getIsWrappedPayload` cannot match, and where trail
     *         never ran `asContextTrailed` defaults the flag to `false`
     */
    genConstraintErrorMiddleware({
      asOutputAfter: (payload) =>
        asApiGatewayResponseOnwireJson({ status: 400, payload }),
    }),
    genInternalServiceErrorMiddleware({
      asOutputAfter: ({ exid }) =>
        asApiGatewayResponseOnwireJson({
          status: 500,
          payload: {
            errorMessage: 'internal server error',
            errorType: 'InternalServiceError',
            ...(exid ? { correlationId: exid } : {}),
          },
        }),
    }),
    /**
     * .breaks the `before` axis, deliberately — this reads `request.context.log`, which
     *      `genTrailMiddleware` (8) produces, so `handler.input` never logs. the record is on
     *      `logTranslate`; the repair moves trail to index 3, never this entry — trail declares
     *      only a `before`, so its move cannot disturb the `after`/`onError` order
     */
    genIoLoggerMiddleware({ logTranslate: config.logTranslate }),
    httpResponseSerializer({
      serializers,
      defaultContentType: 'application/json',
    }),
    /**
     * .breaks the `onError` axis, deliberately — these two sit below the error builders, so
     *      their `onError` hooks run first, see no response, and no-op. that is limit 2 on
     *      `CorsConfig`. the repair also moves their `after` hooks relative to the serializer,
     *      so it changes every success response's headers too
     */
    ...(config.cors ? [httpCors(corsInputToCorsConfig(config.cors))] : []),
    httpSecurityHeaders({
      frameOptions: { action: 'DENY' },
    }),
    genApiGatewayRequestEventNormalizationMiddleware({
      parsePayload: deserialize.payload,
    }),
    genTrailMiddleware(),
    genIntrospectionMiddleware({
      schema: config.schema,
      env: context?.env,
      /**
       * .what = this family keeps `inputAfter` at `event.payload`, and owes an
       *         `ApiGatewayResponseOnwire` back
       * .why = `request.event` must stay http-shaped for `@middy/http-cors`, so the caller's
       *        value rides at `event.payload` rather than in the event's place. and the
       *        short-circuit bypasses the serializer, so the body is encoded here
       */
      asInputAfter: (request) => request.event?.payload,
      asOutputAfter: (schema) =>
        asApiGatewayResponseOnwireJson({ status: 200, payload: schema }),
    }),
    genZodInputValidationMiddleware({ schema: config.schema.input }),
  ];

  /**
   * .as = the chain translates both ends, and typescript cannot track a transform across a
   *       middleware chain:
   *       - input:  ApiGatewayRequestEventOnwire           -> TPayload  (before logic)
   *       - output: ApiGatewayResponseOnwire<TBody> -> ApiGatewayResponseOnwire (after)
   *       the second is the serializer's step — it encodes the body to bytes
   * .removal = drops if middy gains typed inference across `.use`; every shape it spans is
   *            already named, so only the cast is owed
   */
  return middy(
    logic as unknown as (
      event: ApiGatewayRequestEventOnwire,
      context: Context,
    ) => Promise<ApiGatewayResponseOnwire>,
  ).use(middlewares);
};
