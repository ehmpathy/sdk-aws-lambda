import type { SQSEvent, SQSRecord } from 'aws-lambda';

/**
 * .what = type guard for the shape sqs hands a lambda
 * .why = the reconcile refuses a value neither variant produced, rather than hand a handler a
 *        half-decoded envelope. the guard is what lets it refuse loudly
 *        (`rule.require.failfast`)
 *
 * .why it reads `eventSource` and not merely `Records` = `{ Records: [] }` is also the shape s3,
 *        sns, dynamodb-streams, and kinesis deliver, so a `Records`-only check accepts four other
 *        triggers and decodes each one wrong. aws stamps every sqs record
 *        `eventSource: 'aws:sqs'`, which is the one field that tells them apart
 *
 * .why an empty `Records` array reads as sqs = it is a legitimate sqs shape — a fixture, a
 *        replay, an empty drain — and refusal would be a guess about a value the guard cannot
 *        see. the batch-size rule belongs to `perRecord`, which states it as its own constraint
 *
 * .note = only the first record is inspected. a mixed-source batch cannot arrive — one trigger
 *         binds one lambda to one queue — so a per-record scan would cost a walk to prove a
 *         property aws already guarantees (`rule.avoid.constraints-the-state-already-proves`)
 */
export const getIsSqsEvent = (event: unknown): event is SQSEvent => {
  if (!event || typeof event !== 'object') return false;

  const records = (event as { Records?: unknown }).Records;
  if (!Array.isArray(records)) return false;

  // an empty batch is a legitimate sqs shape; there is no record left to identify it by
  if (records.length === 0) return true;

  const first = records[0] as Partial<SQSRecord> | null | undefined;
  return first?.eventSource === 'aws:sqs';
};
