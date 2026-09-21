/**
 * external log shape from askLambdaEndpoint callers
 *
 * .note = accepts optional trail/exid because callers may not provide trail context
 *         this is the expected input from public API boundaries
 */
interface ExternalLogShape {
  trail?: { exid?: string | null } | null;
}

/**
 * .what = boundary normalizer for log shape
 * .why = converts external log shape to strict internal shape with explicit nulls
 *
 * .note = this function is the boundary between external (optional) and internal (strict)
 *         input accepts external shape with optionals (from public API)
 *         output uses strict nulls for internal consumption
 */
export const getLogForExidExtraction = (input: {
  log: ExternalLogShape | null;
}): { trail: { exid: string | null } | null } | null => {
  if (!input.log) return null;
  if (!input.log.trail) return { trail: null };
  return { trail: { exid: input.log.trail.exid ?? null } };
};
