import type { SQSRecord } from 'aws-lambda';
import { ConstraintError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import { RECORD_SOURCE_KINESIS } from '../genLambdaEndpoint.forKinesis/genLambdaEndpoint.forKinesis.constants';
import { RECORD_SOURCE_SNS } from '../genLambdaEndpoint.forSns/genLambdaEndpoint.forSns.constants';
import { RECORD_SOURCE_SQS } from '../genLambdaEndpoint.forSqs/genLambdaEndpoint.forSqs.constants';
import { logRecordRefused } from './logRecordRefused';
import type { RecordSource } from './RecordSource';

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

describe('logRecordRefused', () => {
  given('[case1] a message refused with a ConstraintError', () => {
    when('[t0] the refusal is logged', () => {
      const { context, calls } = genLogFake();
      logRecordRefused(
        {
          source: RECORD_SOURCE_SQS,
          id: messageAsDelivered.messageId,
          raw: messageAsDelivered,
          error: new ConstraintError('order withdrawn'),
          logTranslate: null,
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

      // the same line as a reviewable artifact, beside its peer `logRecordInvalid`'s snapshot
      then('the line an operator reads is pinned', () => {
        expect(calls).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the source's words lead the line and key the raw record
   * .why = one leaf serves every record source, so the words must come from the source rather
   *        than from the leaf — a kinesis refusal that read `sqs.record.refused` would send an
   *        operator to the wrong source
   */
  given('[case2] a source that calls its unit a record', () => {
    const source: RecordSource = {
      name: 'kinesis',
      noun: 'record',
      consequenceRefused: 'the fate a kinesis record meets',
      carrier: 'none',
    };
    const raw = { eventID: 'shardId-000000000000:49590' };

    when('[t0] the refusal is logged', () => {
      const { context, calls } = genLogFake();
      logRecordRefused(
        {
          source,
          id: '49590',
          raw,
          error: new ConstraintError('bad click'),
          logTranslate: null,
        },
        context,
      );

      then(
        'the line is named for the source, and keys the raw record by its noun',
        () => {
          expect(calls).toEqual([
            {
              message: 'kinesis.record.refused',
              metadata: {
                id: '49590',
                class: 'ConstraintError',
                errorMessage: '✋ ConstraintError: bad click',
                consequence: 'the fate a kinesis record meets',
                record: raw,
              },
            },
          ]);
        },
      );
    });
  });

  /**
   * .what = the line each shipped non-sqs source emits, pinned per source
   * .why = the noun and the consequence differ per source, and each is an operator's contract.
   *        a snapshot per source shows a change to either as a diff to review
   */
  given('[case3] each shipped source beside sqs', () => {
    const cases = [
      {
        source: RECORD_SOURCE_SNS,
        id: 'sns-msg-1',
        raw: { EventSource: 'aws:sns' },
      },
      {
        source: RECORD_SOURCE_KINESIS,
        id: '49590',
        raw: { eventSource: 'aws:kinesis' },
      },
    ];

    cases.map((thisCase, index) =>
      when(`[t${index}] a ${thisCase.source.name} refusal is logged`, () => {
        const { context, calls } = genLogFake();
        logRecordRefused(
          {
            source: thisCase.source,
            id: thisCase.id,
            raw: thisCase.raw,
            error: new ConstraintError('bad record'),
            logTranslate: null,
          },
          context,
        );

        then(
          'the line is named for its source, and matches its snapshot',
          () => {
            expect(calls.map((call) => call.message)).toEqual([
              `${thisCase.source.name}.record.refused`,
            ]);
            expect(Object.keys(calls[0]?.metadata ?? {})).toContain(
              thisCase.source.noun,
            );
            expect(calls).toMatchSnapshot();
          },
        );
      }),
    );
  });

  /**
   * .what = an author's `logTranslate.input` redacts the record on the refusal line
   * .why = `logTranslate` is the one redaction hook an author declares. a refusal line that skipped
   *        it would leak a redacted field to cloudwatch on the first bad record, at warn, the level
   *        surely on in prod — so each source proves the marker never reaches the line
   */
  given('[case4] a source whose author declared a redactor', () => {
    const MARKER = 'secret-token-7';

    // redacts every string that holds the marker, at any depth, and keeps the event shape
    const redact = (value: unknown): unknown => {
      if (typeof value === 'string')
        return value.includes(MARKER) ? '<redacted>' : value;
      if (Array.isArray(value)) return value.map(redact);
      if (typeof value === 'object' && value !== null)
        return Object.fromEntries(
          Object.entries(value).map(([key, each]) => [key, redact(each)]),
        );
      return value;
    };

    const cases = [
      {
        source: RECORD_SOURCE_SQS,
        raw: { messageId: 'msg-1', body: `{"token":"${MARKER}"}` },
      },
      {
        source: RECORD_SOURCE_SNS,
        raw: { EventSource: 'aws:sns', Sns: { Message: MARKER } },
      },
      {
        source: RECORD_SOURCE_KINESIS,
        raw: { eventSource: 'aws:kinesis', kinesis: { data: MARKER } },
      },
    ];

    cases.map((thisCase, index) =>
      when(`[t${index}] a ${thisCase.source.name} refusal is logged`, () => {
        const { context, calls } = genLogFake();
        logRecordRefused(
          {
            source: thisCase.source,
            id: 'id-1',
            raw: thisCase.raw,
            error: new ConstraintError('bad record'),
            logTranslate: { input: redact },
          },
          context,
        );

        then('the marker never reaches the line', () => {
          expect(JSON.stringify(calls)).not.toContain(MARKER);
        });

        then(
          'the record still rides under its noun, redacted, in its own shape',
          () => {
            expect(calls[0]?.metadata).toMatchObject({
              [thisCase.source.noun]: redact(thisCase.raw),
            });
          },
        );
      }),
    );

    when('[t3] the redactor answers in a shape other than the event', () => {
      const { context, calls } = genLogFake();
      logRecordRefused(
        {
          source: RECORD_SOURCE_SQS,
          id: 'id-1',
          raw: { body: MARKER },
          error: new ConstraintError('bad record'),
          logTranslate: { input: () => '<all redacted>' },
        },
        context,
      );

      then(
        'the line carries what the redactor returned, as it returned it',
        () => {
          expect(calls[0]?.metadata).toMatchObject({
            message: '<all redacted>',
          });
        },
      );
    });
  });
});
