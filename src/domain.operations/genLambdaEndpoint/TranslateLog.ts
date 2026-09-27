/**
 * .what = projections applied to io before it reaches cloudwatch
 * .why = a log projection is cosmetic — it changes what an operator reads, never what the
 *        caller receives
 *
 * .note = these are untyped on purpose. a log projection runs over whatever the chain holds
 *         at that moment, which for an error path is neither of the declared output shapes
 */
export interface TranslateLog {
  input?: (payload: unknown) => unknown;
  output?: (response: unknown) => unknown;
}
