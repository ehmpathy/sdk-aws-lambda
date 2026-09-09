import type {
  APIGatewayProxyResult,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';

/**
 * .what = every key of the aws wire payload, EITHER version, that `ApiGatewayResponse` omits
 * .why = ties the list below to aws's own interfaces, so a field aws adds is a `tsc` failure
 *        rather than a gap. the union spans both results because `multiValueHeaders` is
 *        v1-only and `cookies` is v2-only
 */
type KeyOfWirePayloadUnread = Exclude<
  keyof APIGatewayProxyResult | keyof APIGatewayProxyStructuredResultV2,
  'headers' | 'body'
>;

/**
 * .what = the wire keys a mid-migration consumer writes from habit, every one of which the
 *         encode would drop without a word
 *
 * .note = `statusCode` is the severe one — the one field whose name changed (`status`), so
 *         `status ?? 200` replaces a caller's 404 with a 200 AND double-encodes the body they
 *         already stringified. the rest are deferred keys (F7), quieter but equally silent
 *
 * .note = a `Record<K, true>` rather than a `string[]`, so the compiler holds it EXHAUSTIVE: a
 *         list proves each entry is real and says not one word about one being ABSENT, which is
 *         the drift that matters. clamp proven to bite — drop a key and tsc raises TS2741
 */
const IS_KEY_OF_WIRE_PAYLOAD_UNREAD: Record<KeyOfWirePayloadUnread, true> = {
  statusCode: true,
  multiValueHeaders: true,
  isBase64Encoded: true,
  cookies: true,
};

/**
 * .what = the same list, as keys
 * .why = one source of truth, so the exhaustive map and the iterated list cannot drift apart
 */
const KEYS_OF_WIRE_PAYLOAD: string[] = Object.keys(
  IS_KEY_OF_WIRE_PAYLOAD_UNREAD,
);

/**
 * .what = lists which aws wire-payload keys a handler's response carries
 * .why = one detector, so the public type-check and the handler-side guard cannot drift. the
 *        check needs a boolean; the guard needs the key NAMES to tell the author the fix
 */
export const getAllWirePayloadKeysFound = (input: {
  response: object;
}): string[] => KEYS_OF_WIRE_PAYLOAD.filter((key) => key in input.response);
