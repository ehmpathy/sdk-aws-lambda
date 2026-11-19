import type { RecordSourceBatched } from '../record/RecordSource';

/**
 * .what = the facts the `forKinesis` family supplies to the shared record leaves
 * .why = one declaration feeds every log line, error, and carrier stamp both variants emit
 *        (`rule.forbid.parallel-codepaths`)
 *
 * .why noun `record` = kinesis calls its unit a record, so an operator searches for that word
 * .why carrier `none` = a kinesis record carries no metadata bag, so no trail can ride it, and a
 *        `{ event, trail }` wrapper is never honored at a family aws delivers to
 *        (`invariant.ancient-vs-contemp-callers.md`). each invoke mints a fresh `exid`
 * .note = a refused record that is acknowledged lets the shard advance past it. a record left out
 *         of a batch answer is retried from its sequence number, so every record after it in the
 *         shard is retried with it — that is kinesis's checkpoint, not a choice of this sdk
 */
export const RECORD_SOURCE_KINESIS: RecordSourceBatched = {
  name: 'kinesis',
  noun: 'record',
  consequenceRefused:
    'skipped only if this invoke succeeds; the shard retries it if it fails',
  consequenceInvalid:
    'retried — a fault of ours, so kinesis retries from this record, with every record after it in the shard',
  carrier: 'none',
};
