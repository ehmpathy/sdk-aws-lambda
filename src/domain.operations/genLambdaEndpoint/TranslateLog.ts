/**
 * .what = projections applied to io before it reaches cloudwatch
 * .why = a log projection is cosmetic — it changes what an operator reads, never what the
 *        caller receives
 *
 * .note = these are untyped on purpose. a log projection runs over whatever the chain holds
 *         at that moment, which for an error path is neither of the declared output shapes
 *
 * .note = this type once sat in a `Translate.ts` beside a `Translate<TShapes>` interface, a
 *         `LambdaEndpointShapes` bag, and a `Translator<TFrom, TInto>` alias — a config
 *         namespace for the four translator boundaries an endpoint has. those three shipped
 *         with ZERO production consumers, because the input-side translator they existed to
 *         type never landed: its home in the middy chain is unresolved (`request.event` is
 *         read by `@middy/http-cors` in its `after` hook, so the natural seam starves cors).
 *         so they were dead declarations, below the rule of three
 *         (rule.prefer.wet-over-dry), and they are deleted rather than shipped.
 *
 *         the DESIGN is not lost — the four points (`inputBefore` / `inputAfter` /
 *         `outputBefore` / `outputAfter`), the tri-state (absent = default, `false` =
 *         disarmed, function = yours), and the structural-bind rationale are recorded in
 *         `1.vision.yield.md`. a term costs one line to restore from there; a dead
 *         declaration costs every reader who meets it. `TranslateLog` stays because it is
 *         the one member with real consumers — `logTranslate` on both endpoint families and
 *         on `genIoLoggerMiddleware`, plus a public export.
 */
export interface TranslateLog {
  input?: (payload: unknown) => unknown;
  output?: (response: unknown) => unknown;
}
