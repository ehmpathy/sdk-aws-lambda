import type { RecordSourceBatched } from '../record/RecordSource';

/**
 * .what = the facts the `forSqs` family supplies to the shared record leaves
 * .why = one declaration feeds every log line, error, and carrier stamp both variants emit, so a
 *        word changes in one place (`rule.forbid.parallel-codepaths`)
 *
 * .why carrier `wrapper` = the named debt in `invariant.ancient-vs-contemp-callers.md`: a test runner
 *        frames one, and aws never sends one to an sqs handler, so a deployed endpoint reads no
 *        trail until the `messageAttributes` lift lands (`domain.terms/trail-carrier.md`)
 */
export const RECORD_SOURCE_SQS: RecordSourceBatched = {
  name: 'sqs',
  noun: 'message',
  consequenceRefused:
    'deleted only if this invoke succeeds; redriven if it fails',
  consequenceInvalid:
    'redriven — a fault of ours, so sqs redrives this record alone',
  carrier: 'wrapper',
};
