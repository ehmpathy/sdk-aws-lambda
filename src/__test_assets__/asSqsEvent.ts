import type { SQSEvent, SQSMessageAttributes, SQSRecord } from 'aws-lambda';

/**
 * .what = the two facts a test actually varies about one sqs message
 * .why = every other field of `SQSRecord` is aws ledger data the sdk never reads, so a test
 *        that had to supply them would state fifteen lines of fiction a reader must then
 *        distrust (`rule.require.hermetic-tests`)
 *
 * .note = `headers` is spelled the way a SENDER spells it — one name, one string — rather than
 *         as aws's `{ stringValue, dataType }` wrapper. the builder applies the wrapper, so a
 *         test reads the same vocabulary the handler does
 */
export interface SqsMessageSpec {
  body: string;
  headers?: Record<string, string>;
}

/**
 * .what = wraps a flat `{ name: value }` bag into the per-value shape sqs delivers
 * .why = the flatten is the whole subject of `asSqsHeadersOnwire`, so the fixture must arrive
 *        WRAPPED or the test proves naught about it
 */
const asSqsMessageAttributes = (input: {
  headers: Record<string, string>;
}): SQSMessageAttributes =>
  Object.fromEntries(
    Object.entries(input.headers).map(([name, value]) => [
      name,
      { stringValue: value, dataType: 'String' },
    ]),
  );

/**
 * .what = builds one record of the batch sqs delivers
 * .why = the ids must differ across a batch, since `perBatch` reports failures BY id and a
 *        shared id would make a green assertion meaningless
 */
const asSqsRecord = (input: {
  index: number;
  message: SqsMessageSpec;
}): SQSRecord =>
  ({
    messageId: `msg-${input.index}`,
    receiptHandle: `receipt-${input.index}`,
    body: input.message.body,
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '1700000000000',
      SenderId: 'sender',
      ApproximateFirstReceiveTimestamp: '1700000000000',
    },
    messageAttributes: asSqsMessageAttributes({
      headers: input.message.headers ?? {},
    }),
    md5OfBody: 'md5',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:test-queue',
    awsRegion: 'us-east-1',
  }) satisfies SQSRecord;

/**
 * .what = builds the sqs event a lambda receives for a batch of messages
 * .why = the assertion under test is about what the sdk DECODES, so the input must arrive in
 *        the vendor's own shape rather than in the decoded one — a hand-written
 *        `SqsEventDecoded` would skip the very boundary the test exists to cross
 */
export const asSqsEvent = (input: {
  messages: SqsMessageSpec[];
}): SQSEvent => ({
  Records: input.messages.map((message, index) =>
    asSqsRecord({ index, message }),
  ),
});
