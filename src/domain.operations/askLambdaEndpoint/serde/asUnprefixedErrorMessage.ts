/**
 * .what = strips helpful-errors emoji prefix from error message
 * .why = prevents double prefix when errors cross lambda boundary
 *
 * helpful-errors prefixes messages with pattern: "✋ {ClassName}: {message}"
 * when we create a new ConstraintError with this message, it adds another prefix
 * e.g., "✋ ConstraintError: ✋ ConstraintError: validation failed"
 *
 * this transformer extracts the original message to avoid duplicate prefixes
 */
export const asUnprefixedErrorMessage = (input: {
  message: string;
}): string => {
  // match pattern: "✋ {ClassName}: {rest}"
  // .note = class names may have suffixes from bundler deduplication (e.g., ConstraintError5)
  const prefixPattern = /^✋\s+\w+:\s*/;
  const match = input.message.match(prefixPattern);

  if (!match) {
    return input.message;
  }

  // strip the prefix
  return input.message.slice(match[0].length);
};
