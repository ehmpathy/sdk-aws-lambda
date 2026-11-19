import type { RecordSource } from '../record/RecordSource';

/**
 * .what = the facts the `forSns` family supplies to the shared record leaves
 * .why = one declaration feeds every log line, error, and carrier stamp `forSns` emits
 *        (`rule.forbid.parallel-codepaths`)
 *
 * .why a `RecordSource` and not a `RecordSourceBatched` = sns delivers one message per invoke, so
 *        no per-batch variant exists to meet a per-record server fault
 * .why carrier `none` = sns carries `MessageAttributes`, but the trail lift from them is unbuilt,
 *        and a `{ event, trail }` wrapper is never honored at a family it was not named for
 *        (`invariant.ancient-vs-contemp-callers.md`). each invoke mints a fresh `exid`
 */
export const RECORD_SOURCE_SNS: RecordSource = {
  name: 'sns',
  noun: 'message',
  consequenceRefused:
    'acknowledged only if this invoke succeeds; lambda retries it if it fails',
  carrier: 'none',
};
