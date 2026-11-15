import type { KinesisStreamEvent, KinesisStreamRecord } from 'aws-lambda';

/**
 * .what = the one slot a caller may constrain on one kinesis record
 * .why = a kinesis record carries no metadata bag, so there is no `headers` slot to constrain
 *        (`domain.terms/headers.md`)
 */
export interface KinesisRecordShape {
  payload: unknown;
}

/**
 * .what = one kinesis record, with its data decoded
 * .why `KinesisRecord` and not `KinesisRecordDecoded` = `KinesisStreamEventDecoded` already names
 *        the schema face (`asLambdaEventSchema.fromKinesis`): the aws envelope with its data
 *        decoded in place. this is the endpoint face, the sdk's own `{ id, payload, _ }` shape (F06)
 *
 * .note = no `headers` slot, absent rather than empty: a kinesis producer sets a partition key and
 *         data, and naught else. the partition key is at `_.raw.kinesis.partitionKey`
 * .note = `payload` is the handler's projection of this slot — one object, never a copy
 */
export interface KinesisRecord<
  TShape extends KinesisRecordShape = KinesisRecordShape,
> {
  /**
   * .what = the record's sequence number within its shard
   * .why `id` and not `sequenceNumber` = the sdk's word for a record's identifier in every record
   *        source, and the value kinesis reads back from a batch answer's `itemIdentifier`
   */
  id: string;

  /**
   * .what = the data — base64-decoded, parsed, and validated by the time `invoke` runs
   * .note = the untouched base64 string is at `_.raw.kinesis.data`
   */
  payload: TShape['payload'];

  /**
   * .what = the ejection route — the vendor record, before this shape decoded it
   * .why = `kinesis.partitionKey`, `kinesis.approximateArrivalTimestamp`, `eventSourceARN`, and
   *        `eventID` each live here
   */
  _: { raw: KinesisStreamRecord };
}

/**
 * .what = a kinesis invoke, with its records decoded
 * .why = `event` is the whole object that arrived, in every family
 */
export interface KinesisEventRecords<
  TShape extends KinesisRecordShape = KinesisRecordShape,
> {
  /**
   * .what = the records this invoke carries, in shard order
   * .why `records` and not `Records` = aws capitalizes it on the wire; this shape does not
   */
  records: KinesisRecord<TShape>[];

  /**
   * .what = the ejection route — the wire form, before this shape decoded it
   */
  _: { raw: KinesisStreamEvent };
}
