/**
 * .what = casts a fetch `Headers` into a plain record, keys lowercased by the http client
 * .why = a caller reads a header by name, and a live `Headers` cannot survive a json strip, a spread,
 *        or a snapshot
 *
 * .note = DELIBERATE MUTATION — of a record made in this scope, which does not escape until whole.
 *         the declared `Headers` type under this tsconfig's lib has no `entries()` and is not
 *         iterable, so `forEach` is the only reader (`rule.require.immutable-vars` sanctions an
 *         unavoidable mutation that is isolated and annotated)
 */
export const asHeadersRecord = (input: {
  headers: Headers;
}): Record<string, string> => {
  const record: Record<string, string> = {};
  input.headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
};
