/**
 * .what = the event sources an `asLambdaEventSchema.*` builder can declare, in one list
 * .why = the builders stamp a name from it, the reader accepts only a name in it, and `forAsk`
 *        keys its per-source table by it — so a new source is one entry here, and every
 *        `Record<LambdaEventSchemaSourceName, …>` that lacks it fails to compile
 */
export const LAMBDA_EVENT_SCHEMA_SOURCE_NAMES = [
  'sqs',
  'sns',
  'kinesis',
] as const;

/**
 * .what = the name of an event source an `asLambdaEventSchema.*` schema validates
 */
export type LambdaEventSchemaSourceName =
  (typeof LAMBDA_EVENT_SCHEMA_SOURCE_NAMES)[number];

/**
 * .what = what a schema built by `asLambdaEventSchema.*` declares about itself
 * .why = a refusal by an event-source schema owes a warn line (aws drops the event, so the log
 *        is its only trace), while every other `forAsk` caller keeps its debug-only log. this
 *        record is how `forAsk` tells the two apart
 *
 * .note = data only, never code: the mark may cross from another copy of this package
 *         (`Symbol.for`), and a name is checkable where a function is not. what `forAsk` does
 *         with a name (which ids to read, what became of the event) is `forAsk`'s own table
 * .note = it lives here because two peers name it — the builders that stamp it and the
 *         endpoint that reads it (rule.prefer.most-common-denominator)
 */
export interface LambdaEventSchemaSource {
  name: LambdaEventSchemaSourceName;
}
