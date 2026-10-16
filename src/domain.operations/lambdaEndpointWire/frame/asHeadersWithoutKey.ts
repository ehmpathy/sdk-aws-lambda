/**
 * .what = casts a headers bag into the same bag with every case variant of one key dropped
 * .why = http field names are case-insensitive (rfc 9110 §5.1), so `X-Trail-Exid` and `x-trail-exid`
 *        are one header. a bag that holds both, merged into a `Headers`, joins them as `a, b`, and the
 *        endpoint reads the join as the exid. the caller's variant is dropped before the sdk writes its own,
 *        so the sdk's key is the only one on the wire
 */
export const asHeadersWithoutKey = <TValue>(input: {
  headers: Record<string, TValue> | null | undefined;
  key: string;
}): Record<string, TValue> =>
  Object.fromEntries(
    Object.entries(input.headers ?? {}).filter(
      ([name]) => name.toLowerCase() !== input.key.toLowerCase(),
    ),
  );
