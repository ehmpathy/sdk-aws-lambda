/**
 * .what = strips a helpful-errors class prefix from an error message
 * .why = prevents a double prefix when an error crosses the lambda boundary.
 *        the handler's error already carries one, and the caller constructs a
 *        fresh error from that message — so an unstripped prefix compounds.
 *
 * 🔴 the emoji is OPTIONAL — `helpful-errors` emits `{emoji} {Name}: ` only where
 *    the class declares a static emoji, and exactly TWO do (`ConstraintError`
 *    `✋`, `MalfunctionError` `💥`). every other subclass emits a bare
 *    `{Name}: `, so a pattern anchored on one emoji misses the majority —
 *    `BadRequestError` among them, which is the ancient path's own class.
 *
 * ⚠️ the class name must end in `Error`, and that bound is what keeps the
 *    pattern safe: a bare `^\w+:\s*` would strip the caller's own text, so
 *    `field: uuid must be a uuid` would lose `field: `.
 *
 * .note = the `\d*` admits bundler deduplication suffixes (`ConstraintError5`).
 */
export const asUnprefixedErrorMessage = (input: {
  message: string;
}): string => {
  // match "{emoji}? {ClassName}Error{digits}?: {rest}"
  const prefixPattern = /^(?:\S+\s+)?\w*Error\d*:\s*/;
  const match = input.message.match(prefixPattern);

  if (!match) {
    return input.message;
  }

  // strip the prefix
  return input.message.slice(match[0].length);
};
