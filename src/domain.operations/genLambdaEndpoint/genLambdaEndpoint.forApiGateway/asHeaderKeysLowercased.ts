import type { ApiGatewayHeadersOnwire } from './ApiGatewayRequestEventUnified';

/**
 * .what = re-keys a header bag with every key lowercased
 * .why = rfc 9110 §5.1 makes http field names case-insensitive, so a bag that distinguishes
 *        `Authorization` from `authorization` contradicts its own protocol. every runtime in
 *        this path already lowercases — node, express, api gateway v2 — and a verbatim
 *        passthrough would be a third behavior this sdk invented
 *
 * .why a named transformer = the fold earns a name a test can aim at and a reader can find,
 *        rather than an inline `Object.fromEntries` inside the reconcile
 *        (rule.require.named-transformers)
 *
 * .note = it also absorbs the absent bag. v1 declares `headers` required and v2 declares it
 *         optional, so the wire union's member is `… | undefined`. a transformer that returns
 *         a bag either way deletes the `as`-cast the reconcile would otherwise owe here
 *         (rule.forbid.as-cast)
 *
 * .note = a later duplicate key wins, which is what every http runtime does when it folds
 *         `Accept` onto `accept`. the case cannot be recovered afterward, and that is the
 *         point: a reader who needs the wire's own letter-case reads `event._.raw`
 *
 * .note = "later" is a property of the input's construction order, never of this function.
 *         `Object.entries` walks the bag in its own insertion order and `Object.fromEntries`
 *         writes in that same order, so this transformer inherits whatever order the party
 *         that built the bag chose — aws, for a real trigger; a fixture literal, for a test.
 *         so to pin which of `Accept` / `accept` survives, pin the bag, never this file
 *
 * .note = the `input: { headers }` bag is the repo's transformer shape, never decoration: it
 *         makes `{ headers: undefined }` read as *the bag was absent* rather than as *no
 *         argument was supplied*, which is exactly the distinction the note above turns on
 *         (rule.require.input-context-pattern)
 */
export const asHeaderKeysLowercased = (input: {
  headers: ApiGatewayHeadersOnwire | undefined;
}): ApiGatewayHeadersOnwire => {
  if (!input.headers) return {};

  return Object.fromEntries(
    Object.entries(input.headers).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );
};
