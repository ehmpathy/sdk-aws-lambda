/**
 * .what = detect if payload requests schema introspection
 * .why = enables middleware to intercept introspection requests before handler
 */
export const isIntrospectionPayload = (payload: unknown): boolean => {
  if (typeof payload !== 'object' || payload === null) return false;
  if (!('introspect' in payload)) return false;
  return (payload as Record<string, unknown>).introspect === 'schema';
};
