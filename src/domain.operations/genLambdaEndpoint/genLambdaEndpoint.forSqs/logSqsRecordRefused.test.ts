import type { SQSRecord } from 'aws-lambda';
import { ConstraintError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import { logSqsRecordRefused } from './logSqsRecordRefused';

/**
 * .what = a warn that records each call, injected through context
 * .why = the refusal line is the one durable trace of a deleted message, so its exact shape is
 *        the operator's contract; a fake keeps the read pure and deterministic
 * .note = deliberate mutation in a `const` box — the calls land from inside the operation
 */
const genLogFake = (): {
  context: { log: { warn: (message: string, metadata?: unknown) => void } };
  calls: { message: string; metadata: unknown }[];
} => {
  const calls: { message: string; metadata: unknown }[] = [];
  return {
    calls,
    context: {
      log: {
        warn: (message, metadata) => {
          calls.push({ message, metadata });
        },
      },
    },
  };
};

/**
 * .what = one sqs message as aws delivers it to a lambda, from a fifo queue, with a typed attribute
 * .why = a requeue needs every part a producer set: the exact body bytes, the typed attributes,
 *        the fifo group and dedupe ids, and the source queue. each is present here, so the proof
 *        below covers every field a requeue reads
 */
const messageAsDelivered: SQSRecord = {
  messageId: 'msg-7',
  receiptHandle: 'receipt-7',
  body: '{"orderId":"o-1","note":"  keeps its own spaces  "}',
  attributes: {
    ApproximateReceiveCount: '1',
    SentTimestamp: '1761400000000',
    SenderId: 'AIDAEXAMPLE',
    ApproximateFirstReceiveTimestamp: '1761400000100',
    MessageGroupId: 'orders',
    MessageDeduplicationId: 'dedupe-7',
  },
  messageAttributes: {
    'x-trail-exid': {
      stringValue: 'trail-7',
      dataType: 'String',
      stringListValues: [],
      binaryListValues: [],
    },
  },
  md5OfBody: 'md5-7',
  eventSource: 'aws:sqs',
  eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:orders.fifo',
  awsRegion: 'us-east-1',
};

describe('logSqsRecordRefused', () => {
  given('[case1] a message refused with a ConstraintError', () => {
    when('[t0] the refusal is logged', () => {
      const { context, calls } = genLogFake();
      logSqsRecordRefused(
        {
          message: messageAsDelivered,
          error: new ConstraintError('order withdrawn'),
        },
        context,
      );

      then(
        'one warn line names the id, the class, the cause, the fate, and the full message',
        () => {
          expect(calls).toEqual([
            {
              message: 'sqs.record.refused',
              metadata: {
                id: 'msg-7',
                class: 'ConstraintError',
                errorMessage: '✋ ConstraintError: order withdrawn', // helpful-errors heads its message with the class
                consequence:
                  'deleted only if this invoke succeeds; redriven if it fails',
                message: messageAsDelivered,
              },
            },
          ]);
        },
      );

      // .why = a log sink stores the line as json, so the requeue reads it back from json. a
      //        round-trip that equals the delivered message proves no field a requeue needs is lost
      then(
        'the message read back from the json log line equals the message aws delivered',
        () => {
          const lineStored = JSON.parse(JSON.stringify(calls[0]?.metadata)) as {
            message: SQSRecord;
          };
          expect(lineStored.message).toEqual(messageAsDelivered);
        },
      );

      then(
        'the line holds every part a requeue sends: body bytes, typed attributes, fifo ids, queue',
        () => {
          const lineStored = JSON.parse(JSON.stringify(calls[0]?.metadata)) as {
            message: SQSRecord;
          };
          expect(lineStored.message.body).toEqual(messageAsDelivered.body);
          expect(lineStored.message.messageAttributes).toEqual(
            messageAsDelivered.messageAttributes,
          );
          expect(lineStored.message.attributes.MessageGroupId).toEqual(
            'orders',
          );
          expect(lineStored.message.attributes.MessageDeduplicationId).toEqual(
            'dedupe-7',
          );
          expect(lineStored.message.eventSourceARN).toEqual(
            'arn:aws:sqs:us-east-1:000000000000:orders.fifo',
          );
        },
      );

      // the same line as a reviewable artifact, beside its peer `logSqsRecordInvalid`'s snapshot
      then('the line an operator reads is pinned', () => {
        expect(calls).toMatchSnapshot();
      });
    });
  });
});
