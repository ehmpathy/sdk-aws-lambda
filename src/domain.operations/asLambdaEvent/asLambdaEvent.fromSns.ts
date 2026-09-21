import type { SNSEvent, SNSEventRecord } from 'aws-lambda';

import {
  AWS_ACCOUNT_SYNTHETIC,
  AWS_REGION_SYNTHETIC,
} from '../../domain.objects/AwsIdentitySynthetic';
import { asExampleUuid } from './asLambdaEvent.asExampleUuid';
import { AWS_EVENT_AT_ISO } from './asLambdaEvent.constants';

/**
 * .what = casts payloads into the sns envelope aws delivers
 * .why = an sns consumer receives `{ Records: [{ Sns: { Message, ... } }] }`, and
 *        the payload lives at `Records[].Sns.Message` (define.lambda-event-source)
 *
 * wire-faithful by default — see `asLambdaEvent.fromSqs` for the argument.
 *
 * @example
 * ```ts
 * const event = asLambdaEvent.fromSns({ messages: [JSON.stringify(notice)] });
 * ```
 */
export const fromSns = (input: {
  /**
   * the message bodies, as they arrive on the wire — json strings
   */
  messages: string[];

  /**
   * per-record overrides, applied to every record
   */
  record?: Partial<SNSEventRecord>;

  /**
   * the topic name the records came from
   */
  topic?: string;
}): SNSEvent => {
  const topic = input.topic ?? 'example-topic';
  const topicArn = `arn:aws:sns:${AWS_REGION_SYNTHETIC}:${AWS_ACCOUNT_SYNTHETIC}:${topic}`;

  return {
    Records: input.messages.map((message) => {
      // one uuid per record — the arn suffix and the MessageId are the same id
      const uuid = asExampleUuid();

      return {
        EventVersion: '1.0',
        EventSubscriptionArn: `${topicArn}:${uuid}`,
        EventSource: 'aws:sns',
        Sns: {
          SignatureVersion: '1',
          // ⚠️ an ISO string here; sqs sends millis, kinesis sends seconds. derived
          //    from the shared constant so a numeric-literal search reaches it.
          Timestamp: AWS_EVENT_AT_ISO,
          Signature: 'EXAMPLE',
          SigningCertUrl: `https://sns.${AWS_REGION_SYNTHETIC}.amazonaws.com/SimpleNotificationService-example.pem`,
          MessageId: uuid,
          Message: message,
          MessageAttributes: {},
          Type: 'Notification',
          UnsubscribeUrl: `https://sns.${AWS_REGION_SYNTHETIC}.amazonaws.com/?Action=Unsubscribe`,
          TopicArn: topicArn,
          Subject: '',
        },
        ...input.record,
      };
    }),
  };
};
