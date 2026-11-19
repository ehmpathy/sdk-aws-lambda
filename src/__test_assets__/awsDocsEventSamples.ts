import type { KinesisStreamEvent } from 'aws-lambda';

/**
 * .what = the sns sample event from aws's lambda docs, verbatim
 * .why = a shape aws wrote, not this sdk's factory, so a test that feeds it cannot share a premise
 *        with the decoder it checks
 * .source = https://docs.aws.amazon.com/lambda/latest/dg/with-sns.html § sample sns event shape
 * .note = its cert url key ends in `URL`, where `@types/aws-lambda` and the factory say `Url`
 *         (F10). the html page renders `&` in `UnsubscribeUrl` as `&amp;`; the text is `&`
 */
export const SAMPLE_SNS_EVENT_FROM_AWS_DOCS = {
  Records: [
    {
      EventVersion: '1.0',
      EventSubscriptionArn:
        'arn:aws:sns:us-east-1:123456789012:sns-lambda:21be56ed-a058-49f5-8c98-aedd2564c486',
      EventSource: 'aws:sns',
      Sns: {
        SignatureVersion: '1',
        Timestamp: '2019-01-02T12:45:07.000Z',
        Signature:
          'tcc6faL2yUC6dgZdmrwh1Y4cGa/ebXEkAi6RibDsvpi+tE/1+82j...65r==',
        SigningCertURL:
          'https://sns.us-east-1.amazonaws.com/SimpleNotificationService-ac565b8b1a6c5d002d285f9598aa1d9b.pem',
        MessageId: '95df01b4-ee98-5cb9-9903-4c221d41eb5e',
        Message: 'Hello from SNS!',
        MessageAttributes: {
          Test: { Type: 'String', Value: 'TestString' },
          TestBinary: { Type: 'Binary', Value: 'TestBinary' },
        },
        Type: 'Notification',
        UnsubscribeUrl:
          'https://sns.us-east-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:us-east-1:123456789012:test-lambda:21be56ed-a058-49f5-8c98-aedd2564c486',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:sns-lambda',
        Subject: 'TestInvoke',
      },
    },
  ],
};

/**
 * .what = the kinesis sample event from aws's lambda docs, verbatim
 * .why = a shape aws wrote, not this sdk's factory (see the sns sample above)
 * .source = https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis.html § example event
 * .note = each `data` decodes to a plain sentence, not json — a text stream
 */
export const SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS: KinesisStreamEvent = {
  Records: [
    {
      kinesis: {
        kinesisSchemaVersion: '1.0',
        partitionKey: '1',
        sequenceNumber:
          '49590338271490256608559692538361571095921575989136588898',
        data: 'SGVsbG8sIHRoaXMgaXMgYSB0ZXN0Lg==',
        approximateArrivalTimestamp: 1545084650.987,
      },
      eventSource: 'aws:kinesis',
      eventVersion: '1.0',
      eventID:
        'shardId-000000000006:49590338271490256608559692538361571095921575989136588898',
      eventName: 'aws:kinesis:record',
      invokeIdentityArn: 'arn:aws:iam::123456789012:role/lambda-role',
      awsRegion: 'us-east-2',
      eventSourceARN:
        'arn:aws:kinesis:us-east-2:123456789012:stream/lambda-stream',
    },
    {
      kinesis: {
        kinesisSchemaVersion: '1.0',
        partitionKey: '1',
        sequenceNumber:
          '49590338271490256608559692540925702759324208523137515618',
        data: 'VGhpcyBpcyBvbmx5IGEgdGVzdC4=',
        approximateArrivalTimestamp: 1545084711.166,
      },
      eventSource: 'aws:kinesis',
      eventVersion: '1.0',
      eventID:
        'shardId-000000000006:49590338271490256608559692540925702759324208523137515618',
      eventName: 'aws:kinesis:record',
      invokeIdentityArn: 'arn:aws:iam::123456789012:role/lambda-role',
      awsRegion: 'us-east-2',
      eventSourceARN:
        'arn:aws:kinesis:us-east-2:123456789012:stream/lambda-stream',
    },
  ],
};
