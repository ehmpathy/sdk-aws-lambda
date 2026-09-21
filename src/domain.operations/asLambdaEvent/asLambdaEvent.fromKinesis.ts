import type { KinesisStreamEvent, KinesisStreamRecord } from 'aws-lambda';

import {
  AWS_ACCOUNT_SYNTHETIC,
  AWS_REGION_SYNTHETIC,
} from '../../domain.objects/AwsIdentitySynthetic';
import { AWS_EVENT_AT_EPOCH_S } from './asLambdaEvent.constants';

/**
 * .what = casts payloads into the kinesis envelope aws delivers
 * .why = a kinesis consumer receives `{ Records: [{ kinesis: { data, ... } }] }`,
 *        and the payload lives at `Records[].kinesis.data` — **base64 encoded**
 *        (define.lambda-event-source)
 *
 * ⚠️ **the base64 encode is done for you.** hand a plain string; the factory
 *    encodes it, because that is what the wire delivers and a hand-rolled
 *    fixture routinely forgets it.
 *
 * wire-faithful by default, per F10 — see `asLambdaEvent.fromSqs` for the argument.
 *
 * @example
 * ```ts
 * const event = asLambdaEvent.fromKinesis({ records: [JSON.stringify(datum)] });
 * ```
 */
export const fromKinesis = (input: {
  /**
   * the record payloads, as plain strings. base64-encoded for you.
   */
  records: string[];

  /**
   * per-record overrides, applied to every record
   */
  record?: Partial<KinesisStreamRecord>;

  /**
   * the stream name the records came from
   */
  stream?: string;
}): KinesisStreamEvent => {
  const stream = input.stream ?? 'example-stream';
  const streamArn = `arn:aws:kinesis:${AWS_REGION_SYNTHETIC}:${AWS_ACCOUNT_SYNTHETIC}:stream/${stream}`;

  return {
    Records: input.records.map((data, index) => {
      // the sequence number is said twice — once as itself, once embedded in the
      // eventID, which aws forms as `${shardId}:${sequenceNumber}`. derived rather
      // than written twice, so the two cannot drift out of that relation.
      const sequenceNumber = `4959${String(index).padStart(52, '0')}`;

      return {
        kinesis: {
          kinesisSchemaVersion: '1.0',
          partitionKey: `partition-${index}`,
          sequenceNumber,
          // the wire delivers base64; a fixture that skips this teaches a false shape
          data: Buffer.from(data, 'utf8').toString('base64'),
          // ⚠️ kinesis stamps epoch SECONDS where sqs and api gateway stamp millis
          approximateArrivalTimestamp: AWS_EVENT_AT_EPOCH_S,
        },
        eventSource: 'aws:kinesis',
        eventVersion: '1.0',
        eventID: `shardId-000000000000:${sequenceNumber}`,
        eventName: 'aws:kinesis:record',
        invokeIdentityArn: `arn:aws:iam::${AWS_ACCOUNT_SYNTHETIC}:role/example-role`,
        awsRegion: AWS_REGION_SYNTHETIC,
        eventSourceARN: streamArn,
        ...input.record,
      };
    }),
  };
};
