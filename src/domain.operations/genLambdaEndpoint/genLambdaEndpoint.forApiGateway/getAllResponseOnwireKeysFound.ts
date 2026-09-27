import type {
  APIGatewayProxyResult,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

/**
 * .what = every key of `ApiGatewayResponseOnwire`, either version, that `ApiGatewayResponse`
 *         omits
 * .why = ties the list below to aws's own interfaces, so a field aws adds is a `tsc` failure
 *        rather than a gap. the union spans both results because `multiValueHeaders` is v1-only
 *        and `cookies` is v2-only
 *
 * .why `headers` is the only exclusion = it is the one name the two shapes share. the envelope's
 *        body slot takes the word `payload`, so `body` is a name only the wire holds and belongs
 *        in this list rather than outside it
 */
type KeyOfResponseOnwireUnread = Exclude<
  keyof APIGatewayProxyResult | keyof APIGatewayProxyStructuredResultV2,
  'headers'
>;

/**
 * .what = the wire keys an author who knows aws's response shape writes from habit, every one
 *         of which the encode would drop without a word
 *
 * .note = two of these are severe, and both for one reason: the field's name changed, so a
 *         return that still uses the wire word is silently wrong rather than refused —
 *
 *           statusCode -> status    `status ?? 200` replaces a caller's 404 with a 200, and
 *                                   double-encodes the body they already stringified
 *           body       -> payload   the response emits empty and the author sees a bare 200
 *
 *         the rest are deferred keys, quieter and equally silent
 * .note = `body` is clamped by `[case15][t1]` — drop it from this record and that one test goes
 *         red (a 200 where a 500 is due) while its four siblings stay green
 *         (`rule.require.clamp-edge-cases`)
 *
 * .note = a `Record<K, true>` rather than a `string[]`, so the compiler holds it exhaustive: a
 *         list proves each entry is real and says not one word about an absent one, which is the
 *         drift that matters. drop a key and tsc raises TS2741
 */
const IS_KEY_OF_RESPONSE_WIRE_UNREAD: Record<KeyOfResponseOnwireUnread, true> =
  {
    statusCode: true,
    body: true,
    multiValueHeaders: true,
    isBase64Encoded: true,
    cookies: true,
  };

/**
 * .what = the same list, as keys
 * .why = one source of truth, so the exhaustive map and the iterated list cannot drift apart
 */
const KEYS_OF_RESPONSE_WIRE: string[] = Object.keys(
  IS_KEY_OF_RESPONSE_WIRE_UNREAD,
);

/**
 * .what = lists which aws response-wire keys a handler's response carries
 * .why = one detector, so the public type-check and the handler-side guard cannot drift. the
 *        check needs a boolean; the guard needs the key NAMES to tell the author the fix
 */
export const getAllResponseOnwireKeysFound = (input: {
  response: object;
}): string[] => KEYS_OF_RESPONSE_WIRE.filter((key) => key in input.response);
