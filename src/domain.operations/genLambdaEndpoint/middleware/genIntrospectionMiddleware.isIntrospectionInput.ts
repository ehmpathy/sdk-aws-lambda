/**
 * .what = detects whether a handler's `inputAfter` asks for schema introspection
 * .why = lets the middleware answer the ask before the handler runs
 *
 * .why the name = this predicate serves BOTH endpoint families, and `payload` is the
 *        api-gateway family's own word for a BODY (`event.payload`, rfc 9110). the value it
 *        tests is the whole event for the ask-endpoint family, so `payload` would carry two
 *        senses at a seam with two callers (`domain.terms/payload.md`). `input` is the term
 *        both families share — it is the `(input, context)` word, and the position this value
 *        occupies is `inputAfter`
 */
export const isIntrospectionInput = (input: unknown): boolean => {
  if (typeof input !== 'object' || input === null) return false;
  if (!('introspect' in input)) return false;
  return (input as Record<string, unknown>).introspect === 'schema';
};
