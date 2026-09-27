import type { ApiGatewayRequestEventOnwire } from '../../../domain.objects/ApiGatewayRequestEventOnwire';

/**
 * .what = the header bag as the wire carries it — every key api gateway delivered
 * .why = one named shape for seven sites (two envelope slots, two `asHeaderKeysLowercased`
 *        signatures, three type-parameter bounds), so the compiler keeps them in sync.
 *        `| undefined` forces a check at every index, since an unsent key reads as absent
 */
export type ApiGatewayHeadersOnwire = Record<string, string | undefined>;

/**
 * .what = the shape an author's `schema.input.headers` may name — the wire bag, or absent
 * .why = absent denotes "constrain no header", the status quo for extant handlers.
 *        bound to a record because the validator spreads the result back over the wire bag:
 *        an unbound `headers: z.string()` would spread `{ 0: 'a', 1: 'b', … }` into the slot
 *        `@middy/http-cors` reads. clamped by `forApiGateway.test.ts [case20]`
 */
export type ApiGatewayHeadersDeclared = ApiGatewayHeadersOnwire | undefined;

/**
 * .what = the two slots a caller may constrain on an api-gateway event
 * .why = the validator writes validated values back into the envelope, so the envelope's types
 *        must follow the caller's schema — else `event.payload` is `unknown` and the hand-off
 *        owes an `as`-cast
 * .note = headers and body only: the two slots the family lifts onto `invoke`'s input; the rest
 *         of the envelope is reconciled, never validated
 */
export interface ApiGatewayRequestEventUnifiedShape {
  headers: ApiGatewayHeadersOnwire;
  payload: unknown;
}

/**
 * .what = the header bag a handler receives — the declared keys, beside every other wire key
 * .why = `genZodInputValidationMiddleware` merges rather than replaces, because
 *        `@middy/http-cors` reads `origin` and `@middy/http-response-serializer` reads `accept`
 *        from this slot. so `headers['x-forwarded-for']` must still compile after a schema
 * .why a conditional = `undefined & Record<…>` reduces to `never`, which would erase a state the
 *        bound declares legal. `forApiGateway` infers a union that distributes past it; a hand
 *        written `ApiGatewayHeadersMerged<undefined>` would not
 * .note = clamped in the type checker: `[case18]` (both halves) and `[case23]` (the direct read)
 */
export type ApiGatewayHeadersMerged<
  THeadersDeclared extends ApiGatewayHeadersDeclared,
> = THeadersDeclared extends undefined
  ? ApiGatewayHeadersOnwire
  : ApiGatewayHeadersOnwire & THeadersDeclared;

/**
 * .what = an api-gateway request with v1/v2 differences reconciled
 * .why = v1 puts the method at `httpMethod`, v2 at `requestContext.http.method`; a handler that
 *        reads either is version-locked. the raw union is `ApiGatewayRequestEventOnwire`
 *
 * .note = the handler's `headers` and `payload` are this shape's own slots — `headers ===
 *         event.headers`, `payload === event.payload` — because the validator writes back
 *         rather than parse beside (`domain.terms/headers.md`)
 *
 * .the vendor keys = this object sits in middy's `request.event`, where `@middy/http-cors`
 *        picks a method reader by `request.event.version ?? '1.0'` and then reads
 *        `event.httpMethod` (`@middy/http-cors/index.js:38,64-67,106-109`):
 *        - `httpMethod` is CARRIED — on the object, off this interface, written beside `method`
 *          by the reconcile. do not delete it as rename residue
 *        - `version` is FORBIDDEN — `'2.0'` routes cors to `requestContext.http.method`, which
 *          this shape lacks, and every cors success becomes a 500. clamped by `[case3]`,
 *          `[case18]`, `[case19][t2]`
 */
export interface ApiGatewayRequestEventUnified<
  TShape extends
    ApiGatewayRequestEventUnifiedShape = ApiGatewayRequestEventUnifiedShape,
> {
  /**
   * .what = the http method — `GET`, `POST`, …
   * .why `method` = the type already says api gateway; `httpMethod` is aws's v1 wire name
   */
  method: string;

  /**
   * .what = the request headers, keys lowercased
   * .why = rfc 9110 §5.1: field names are case-insensitive, so `Authorization` and
   *        `authorization` must not be two keys
   * .note = validated against `schema.input.headers` where declared; otherwise unconstrained
   */
  headers: TShape['headers'];

  /**
   * .what = the body — parsed, and validated by the time `logic` runs
   * .note = no unvalidated parsed body sits beside it (`domain.terms/payload.md`). the untouched
   *         wire string is at `_.raw.body`, for a handler that must hash the exact bytes
   */
  payload: TShape['payload'];

  /**
   * .what = how the body arrived on the wire
   * .why a bag = a second codec fact (charset, compression) lands as a key, not a loose field
   */
  codec: { base64: boolean };

  /**
   * .what = the two parameter bags api gateway extracted from the url
   * .note = the url path string is not carried; a handler is bound to its route, and `_.raw`
   *         holds it
   */
  params: {
    path: Record<string, string | undefined> | null;
    query: Record<string, string | undefined> | null;
  };

  /**
   * .what = the ejection route — the wire form before reconcile
   * .why = `_` marks the version-locked escape hatch; every field above is version-agnostic
   */
  _: { raw: ApiGatewayRequestEventOnwire };
}
