import type { PickAny } from 'type-fns';

/**
 * .what = the http response a handler puts on the wire — the `outputBefore` point, which
 *         `schema.output` describes
 *
 * .note = `PickAny` demands at least one key, so `{}` is a compile error. an empty response
 *         would reach middy's `normalizeHttpResponse` and pick up `statusCode ??= 500` — a
 *         silent server-fault on the wire for code that returned success
 */
export type ApiGatewayResponse<TPayload> = PickAny<{
  /** .note = omit for 200 */
  status: number;

  /**
   * .note = set `Content-Type` to take the body verbatim; the serializer skips a response that
   *         already declares one. omit it and the body is json-encoded for you
   *
   * .note = one value per header, so a header that must repeat (`Set-Cookie`) cannot be
   *         expressed — a `Record` key is unique, and js drops the earlier value with no warn.
   *         aws carries repeats in `multiValueHeaders` (v1) / `cookies` (v2); this contract
   *         declares neither, and `getAllResponseOnwireKeysFound` refuses both loudly so the
   *         attempt fails fast. deferred, not denied — each is one additive key
   */
  headers: Record<string, string>;

  /**
   * .what = the response body, in the handler's own terms — json-encoded for you unless the
   *         response declares its own `Content-Type`
   * .why `payload` and not `body` = one word per concept, in both directions. the inbound
   *        envelope's body is `payload` (`domain.terms/payload.md`), and a response whose body
   *        answered to a second word would make the sdk speak two languages across one
   *        round-trip. `ApiGatewayResponseOnwire.body` keeps `body` because that key is aws's
   *
   * .note = omit the key for no body. an explicit `payload: ''` is a different value — a real
   *         two-byte json `""` under `application/json`, which is coherent but is not
   *         body-less. `[case10]` of `local.httpResponse.acceptance.test.ts` pins both
   */
  payload: TPayload;
}>;
