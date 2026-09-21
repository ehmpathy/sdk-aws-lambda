import type { SQSEvent, SQSRecord } from 'aws-lambda';

import {
  AWS_ACCOUNT_SYNTHETIC,
  AWS_REGION_SYNTHETIC,
} from '../../domain.objects/AwsIdentitySynthetic';
import { asExampleUuid } from './asLambdaEvent.asExampleUuid';
import { AWS_EVENT_AT_EPOCH_MS } from './asLambdaEvent.constants';

/**
 * .what = casts payloads into the sqs envelope aws delivers
 * .why = an sqs consumer receives `{ Records: [{ body, ... }] }`, and the payload
 *        lives at `Records[].body` as a JSON STRING (define.lambda-event-source)
 *
 * 🔴 wire-faithful by default: every aws field carries what aws sends. a fixture
 *    that withholds metadata does not stop a handler from reading it — it hides
 *    that handler behind a `TypeError`. review catches it; a deref does not.
 *
 * @example
 * ```ts
 * const event = asLambdaEvent.fromSqs({ messages: [JSON.stringify(task)] });
 *
 * // override only the field the test is actually about
 * const event = asLambdaEvent.fromSqs({
 *   messages: [body],
 *   record: { eventSourceARN: 'arn:aws:sqs:us-east-1:123:my-queue' },
 * });
 * ```
 */
export const fromSqs = (input: {
  /**
   * the message bodies, as they arrive on the wire — json strings
   */
  messages: string[];

  /**
   * per-field overrides, applied to every record
   */
  record?: Partial<SQSRecord>;

  /**
   * the queue name the records came from
   */
  queue?: string;
}): SQSEvent => {
  const queue = input.queue ?? 'example-queue';

  return {
    Records: input.messages.map((body, index) => ({
      messageId: asExampleUuid(),
      receiptHandle: `receipt-handle-${index}`,
      body,
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: String(AWS_EVENT_AT_EPOCH_MS),
        SenderId: `AIDA${String(index).padStart(17, '0')}`,
        ApproximateFirstReceiveTimestamp: String(AWS_EVENT_AT_EPOCH_MS),
      },
      messageAttributes: {},
      md5OfBody: '00000000000000000000000000000000',
      eventSource: 'aws:sqs',
      eventSourceARN: `arn:aws:sqs:${AWS_REGION_SYNTHETIC}:${AWS_ACCOUNT_SYNTHETIC}:${queue}`,
      awsRegion: AWS_REGION_SYNTHETIC,
      ...input.record,
    })),
  };
};
