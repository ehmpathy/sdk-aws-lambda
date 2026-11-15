import type { SNSEvent } from 'aws-lambda';

/**
 * .what = type guard for the shape sns hands a lambda
 * .why = the decode refuses a value sns did not produce, rather than hand a handler a half-decoded
 *        envelope (`rule.require.failfast`)
 *
 * .why it reads `EventSource` and not merely `Records` = `{ Records: [] }` is also the shape sqs,
 *        s3, and kinesis deliver. aws stamps every sns record `EventSource: 'aws:sns'` — capital
 *        `E`, where sqs and kinesis spell it `eventSource` — which tells them apart
 *
 * .why an empty `Records` array reads as sns = it is a shape a guard cannot attribute, and the
 *        count rule belongs to `forSns`, which refuses any count but one, loudly
 * .note = only the first record is inspected: one trigger binds one lambda to one topic
 *         (`rule.avoid.constraints-the-state-already-proves`)
 */
export const getIsSnsEvent = (event: unknown): event is SNSEvent => {
  if (!event || typeof event !== 'object') return false;

  // a read through `Reflect.get`, never an `as` cast, so the unknown stays unknown until checked
  const records: unknown = Reflect.get(event, 'Records');
  if (!Array.isArray(records)) return false;

  // an empty batch carries no record left to identify it by; the count rule refuses it later
  if (records.length === 0) return true;

  const first: unknown = records[0];
  if (!first || typeof first !== 'object') return false;
  if (Reflect.get(first, 'EventSource') !== 'aws:sns') return false;

  // the stamp alone is no proof the decode can read: the `Sns` bag it dereferences must be there
  const bag: unknown = Reflect.get(first, 'Sns');
  return !!bag && typeof bag === 'object';
};
