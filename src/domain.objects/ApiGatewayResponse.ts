import type { PickAny } from 'type-fns';

/**
 * .what = the http response a handler puts on the wire — the `outputBefore` point, which
 *         `schema.output` describes
 *
 * .note = `PickAny` demands at least one key, so `{}` is a compile error. an empty response
 *         would reach middy's `normalizeHttpResponse` and pick up `statusCode ??= 500` — a
 *         silent server-fault on the wire for code that returned success
 */
export type ApiGatewayResponse<TBody> = PickAny<{
  /** .note = omit for 200 */
  status: number;

  /**
   * .note = set `Content-Type` to take the body verbatim; the serializer skips a response that
   *         already declares one. omit it and the body is json-encoded for you
   *
   * ⚠️ .note = ONE VALUE PER HEADER, so a header that must repeat (`Set-Cookie`) cannot be
   *            expressed — a `Record` key is unique, and js drops the earlier value with no
   *            warn. aws carries repeats in `multiValueHeaders` (v1) / `cookies` (v2); this
   *            contract declares neither, and `getAllWirePayloadKeysFound` REFUSES both loudly
   *            so the attempt fails fast. deferred, not denied — each is one additive key (F7)
   */
  headers: Record<string, string>;

  /**
   * ⚠️ .note = OMIT the key for no body. an explicit `body: ''` is a different value — a real
   *            two-byte json `""` under `application/json`, which is coherent but is not
   *            body-less. `[case10]` of `local.wireResponse.acceptance.test.ts` pins both
   */
  body: TBody;
}>;
