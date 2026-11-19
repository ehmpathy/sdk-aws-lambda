import type { KinesisStreamEvent } from 'aws-lambda';

/**
 * .what = type guard for the shape kinesis hands a lambda
 * .why = the decode refuses a value kinesis did not produce, rather than hand a handler a
 *        half-decoded envelope (`rule.require.failfast`)
 *
 * .why it reads `eventSource` and not merely `Records` = `{ Records: [] }` is also the shape sqs,
 *        sns, and s3 deliver. aws stamps every kinesis record `eventSource: 'aws:kinesis'`, which
 *        tells them apart
 *
 * .why an empty `Records` array reads as kinesis = a tumble window's final invoke may carry none,
 *        and a guard cannot attribute it; the count rule belongs to `forKinesis.perRecord`
 * .note = only the first record is inspected: one trigger binds one lambda to one stream
 *         (`rule.avoid.constraints-the-state-already-proves`)
 */
export const getIsKinesisEvent = (
  event: unknown,
): event is KinesisStreamEvent => {
  if (!event || typeof event !== 'object') return false;

  // a read through `Reflect.get`, never an `as` cast, so the unknown stays unknown until checked
  const records: unknown = Reflect.get(event, 'Records');
  if (!Array.isArray(records)) return false;

  // an empty batch carries no record left to identify it by
  if (records.length === 0) return true;

  const first: unknown = records[0];
  if (!first || typeof first !== 'object') return false;
  if (Reflect.get(first, 'eventSource') !== 'aws:kinesis') return false;

  // the stamp alone is no proof the decode can read: the `kinesis` bag it dereferences must be there
  const bag: unknown = Reflect.get(first, 'kinesis');
  return !!bag && typeof bag === 'object';
};
