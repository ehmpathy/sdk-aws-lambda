import type { KinesisStreamEvent, SNSEvent, SQSEvent } from 'aws-lambda';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import {
  SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS,
  SAMPLE_SNS_EVENT_FROM_AWS_DOCS,
} from '../../__test_assets__/awsDocsEventSamples';
import { asLambdaEvent } from '../asLambdaEvent/asLambdaEvent';
import { asLambdaEventSchema } from './asLambdaEventSchema';

/**
 * .what = a json message, the shape an ses notice takes on an sns topic
 */
const schemaOfNotice = z.object({
  notificationType: z.enum(['Bounce', 'Complaint', 'Delivery']),
  mail: z.object({ messageId: z.string() }),
});
const notice = { notificationType: 'Bounce', mail: { messageId: 'm-1' } };

/**
 * .what = reads the issue paths a refusal names, as dotted strings
 */
const asIssuePaths = (input: { error: z.ZodError }): string[] =>
  input.error.issues.map((issue) => issue.path.join('.'));

/**
 * .what = the parsed sns event, with each `Sns.Timestamp` masked
 * .why = a clock time in a tracked file is refused by the repo's timestamps hook, and the
 *        value is the docs sample's, not a decode the case is about
 */
const asSnsTimestampMasked = (input: {
  event: { Records: { Sns: object }[] };
}): unknown => ({
  ...input.event,
  Records: input.event.Records.map((record) => ({
    ...record,
    Sns: { ...record.Sns, Timestamp: '<timestamp>' },
  })),
});

describe('asLambdaEventSchema', () => {
  given('[case1] fromSns(), envelope only', () => {
    const schema = asLambdaEventSchema.fromSns();

    when('[t0] a factory event is parsed', () => {
      const event = asLambdaEvent.fromSns({ messages: ['hi'] });
      then('it parses to exactly the event aws sent', () => {
        expect(schema.parse(event)).toEqual(event);
      });
    });

    when('[t1] the aws docs sample is parsed', () => {
      const result = schema.safeParse(SAMPLE_SNS_EVENT_FROM_AWS_DOCS);
      then('it parses, the contested cert url key kept as sent', () => {
        expect(result.success).toBe(true);
        expect(result.data?.Records[0]?.Sns).toMatchObject({
          SigningCertURL: expect.stringContaining('.pem'),
        });
      });
      then('the output is the event aws sent, pinned', () => {
        expect(result.data).toEqual(SAMPLE_SNS_EVENT_FROM_AWS_DOCS);
        expect(asSnsTimestampMasked({ event: result.data! })).toMatchSnapshot();
      });
    });

    when('[t2] an sqs event is misrouted to it', () => {
      const event: SQSEvent = asLambdaEvent.fromSqs({ messages: ['{}'] });
      const result = schema.safeParse(event);
      then('it is refused, and the issue names the absent sns key', () => {
        expect(result.success).toBe(false);
        expect(asIssuePaths({ error: result.error! })).toContain(
          'Records.0.Sns',
        );
        expect(result.error?.issues).toMatchSnapshot();
      });
    });

    when('[t3] aws adds a key the schema does not know', () => {
      const event = asLambdaEvent.fromSns({ messages: ['hi'] });
      const eventWider = {
        ...event,
        Records: [
          { ...event.Records[0]!, Sns: { ...event.Records[0]!.Sns, Fresh: 1 } },
        ],
      };
      then('the key is kept, never stripped or refused', () => {
        const parsed = schema.parse(eventWider);
        expect(parsed.Records[0]?.Sns).toMatchObject({ Fresh: 1 });
        // the kept key set, since the factory's ids and timestamp vary per run
        expect(Object.keys(parsed.Records[0]!.Sns).sort()).toMatchSnapshot();
      });
    });

    when('[t4] sns sends a null subject', () => {
      const record = SAMPLE_SNS_EVENT_FROM_AWS_DOCS.Records[0]!;
      const eventNullSubject = {
        Records: [{ ...record, Sns: { ...record.Sns, Subject: null } }],
      };
      const result = schema.safeParse(eventNullSubject);
      then('it parses, the null subject kept as sent', () => {
        expect(result.success).toBe(true);
        expect(result.data?.Records[0]?.Sns.Subject).toBeNull();
        expect(asSnsTimestampMasked({ event: result.data! })).toMatchSnapshot();
      });
    });

    when('[t5] a message attribute lacks its Value', () => {
      const event = asLambdaEvent.fromSns({ messages: ['hi'] });
      const eventBadAttribute = {
        Records: [
          {
            ...event.Records[0]!,
            Sns: {
              ...event.Records[0]!.Sns,
              MessageAttributes: { kind: { Type: 'String' } },
            },
          },
        ],
      };
      const result = schema.safeParse(eventBadAttribute);
      then('it is refused at that attribute', () => {
        expect(result.success).toBe(false);
        expect(asIssuePaths({ error: result.error! })).toEqual([
          'Records.0.Sns.MessageAttributes.kind.Value',
        ]);
        expect(result.error?.issues).toMatchSnapshot();
      });
    });
  });

  given('[case2] fromSns({ payload }), a json message', () => {
    const schema = asLambdaEventSchema.fromSns({ payload: schemaOfNotice });

    when('[t0] a factory event with a json notice is parsed', () => {
      const event = asLambdaEvent.fromSns({
        messages: [JSON.stringify(notice)],
      });
      then('Message is the decoded, validated notice', () => {
        expect(schema.parse(event).Records[0]?.Sns.Message).toEqual(notice);
      });
      then('every other envelope field is kept as sent', () => {
        expect(schema.parse(event).Records[0]?.Sns.MessageId).toEqual(
          event.Records[0]?.Sns.MessageId,
        );
      });
    });

    when('[t1] the notice fails the payload schema', () => {
      const event = asLambdaEvent.fromSns({
        messages: [JSON.stringify({ ...notice, notificationType: 'Delay' })],
      });
      const result = schema.safeParse(event);
      then('it is refused at the field inside the message', () => {
        expect(result.success).toBe(false);
        expect(asIssuePaths({ error: result.error! })).toEqual([
          'Records.0.Sns.Message.notificationType',
        ]);
        expect(result.error?.issues).toMatchSnapshot();
      });
    });

    when('[t2] the message is not json', () => {
      const result = schema.safeParse(
        asLambdaEvent.fromSns({ messages: ['Hello from SNS!'] }),
      );
      then('it is refused at Message, never thrown', () => {
        expect(result.success).toBe(false);
        expect(asIssuePaths({ error: result.error! })).toEqual([
          'Records.0.Sns.Message',
        ]);
      });
      then('the issue names the text opt-out as the fix', () => {
        expect(result.error?.issues[0]?.message).toContain(
          'deserialize: { payload: false }',
        );
      });
    });
  });

  given('[case3] fromSns({ payload, deserialize: { payload: false } })', () => {
    const schema = asLambdaEventSchema.fromSns({
      payload: z.string().min(1),
      deserialize: { payload: false },
    });

    when('[t0] the aws docs sample, a text message, is parsed', () => {
      then('Message meets the payload schema as the raw string', () => {
        expect(
          schema.parse(SAMPLE_SNS_EVENT_FROM_AWS_DOCS).Records[0]?.Sns.Message,
        ).toEqual('Hello from SNS!');
      });
    });

    when('[t1] the text fails the payload schema', () => {
      const result = schema.safeParse(
        asLambdaEvent.fromSns({ messages: [''] }),
      );
      then('it is refused at Message', () => {
        expect(asIssuePaths({ error: result.error! })).toEqual([
          'Records.0.Sns.Message',
        ]);
        expect(result.error?.issues).toMatchSnapshot();
      });
    });
  });

  given('[case4] fromKinesis(), envelope only', () => {
    const schema = asLambdaEventSchema.fromKinesis();

    when('[t0] a factory event is parsed', () => {
      const event = asLambdaEvent.fromKinesis({ records: ['a', 'b'] });
      then('it parses to exactly the event aws sent, data still base64', () => {
        expect(schema.parse(event)).toEqual(event);
      });
    });

    when('[t1] the aws docs sample is parsed', () => {
      then('it parses', () => {
        expect(schema.parse(SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS)).toEqual(
          SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS,
        );
      });
    });

    when('[t2] an sns event is misrouted to it', () => {
      const result = schema.safeParse(
        asLambdaEvent.fromSns({ messages: ['hi'] }),
      );
      then('it is refused at the absent kinesis key', () => {
        expect(result.success).toBe(false);
        expect(asIssuePaths({ error: result.error! })).toContain(
          'Records.0.kinesis',
        );
        expect(result.error?.issues).toMatchSnapshot();
      });
    });

    when('[t3] the event carries keys the schema does not know', () => {
      // a tumble-window event adds `window` and `state` at the top (c23); aws may add a record key
      const event = asLambdaEvent.fromKinesis({ records: ['a'] });
      const eventWider = {
        ...event,
        window: { start: '2026-11-14T00:00:00Z', end: '2026-11-14T00:01:00Z' },
        state: {},
        Records: [{ ...event.Records[0]!, fresh: 1 }],
      };
      then('each key is kept, never stripped or refused', () => {
        const parsed = schema.parse(eventWider);
        expect(parsed).toMatchObject({ window: eventWider.window, state: {} });
        expect(parsed.Records[0]).toMatchObject({ fresh: 1 });
        // the kept key sets, since the factory's ids vary per run and the window holds a clock
        expect({
          event: Object.keys(parsed).sort(),
          record: Object.keys(parsed.Records[0]!).sort(),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case5] fromKinesis({ payload }), a json stream', () => {
    const schemaOfClick = z.object({ url: z.string(), at: z.number() });
    const schema = asLambdaEventSchema.fromKinesis({ payload: schemaOfClick });
    const clicks = [
      { url: '/a', at: 1 },
      { url: '/b', at: 2 },
    ];

    when('[t0] a factory batch is parsed', () => {
      const event = asLambdaEvent.fromKinesis({
        records: clicks.map((click) => JSON.stringify(click)),
      });
      then('each data is decoded from base64, parsed, and validated', () => {
        expect(
          schema.parse(event).Records.map((record) => record.kinesis.data),
        ).toEqual(clicks);
      });
    });

    when('[t1] one record in the batch fails the payload schema', () => {
      const event = asLambdaEvent.fromKinesis({
        records: [JSON.stringify(clicks[0]), JSON.stringify({ url: '/b' })],
      });
      const result = schema.safeParse(event);
      then('the whole batch is refused, the issue names the bad record', () => {
        expect(result.success).toBe(false);
        expect(asIssuePaths({ error: result.error! })).toEqual([
          'Records.1.kinesis.data.at',
        ]);
        expect(result.error?.issues).toMatchSnapshot();
      });
    });

    when('[t2] a text stream meets the json default', () => {
      const result = schema.safeParse(SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS);
      then('each record is refused at data, never thrown', () => {
        expect(asIssuePaths({ error: result.error! })).toEqual([
          'Records.0.kinesis.data',
          'Records.1.kinesis.data',
        ]);
      });
      then('the issue names the text opt-out as the fix', () => {
        expect(result.error?.issues[0]?.message).toContain(
          'deserialize: { payload: false }',
        );
      });
    });
  });

  given(
    '[case6] fromKinesis({ payload, deserialize: { payload: false } })',
    () => {
      const schema = asLambdaEventSchema.fromKinesis({
        payload: z.string().min(1),
        deserialize: { payload: false },
      });

      when('[t0] the aws docs sample, a text stream, is parsed', () => {
        then('each data is the utf8 text, decoded from base64', () => {
          expect(
            schema
              .parse(SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS)
              .Records.map((record) => record.kinesis.data),
          ).toEqual(['Hello, this is a test.', 'This is only a test.']);
        });
      });

      when('[t1] one text record in the batch fails the payload schema', () => {
        const result = schema.safeParse(
          asLambdaEvent.fromKinesis({ records: ['a log line', ''] }),
        );
        then(
          'the whole batch is refused, the issue names the bad record',
          () => {
            expect(result.success).toBe(false);
            expect(asIssuePaths({ error: result.error! })).toEqual([
              'Records.1.kinesis.data',
            ]);
            expect(result.error?.issues).toMatchSnapshot();
          },
        );
      });
    },
  );

  given('[case7] the declared faces', () => {
    when('[t0] each schema is assigned to the aws-lambda wire type', () => {
      then('it compiles with no cast', () => {
        // a compile-time assertion: each wire face (zod input) is the aws-lambda type
        const snsWire: z.input<ReturnType<typeof asLambdaEventSchema.fromSns>> =
          asLambdaEvent.fromSns({ messages: ['hi'] }) satisfies SNSEvent;
        const kinesisWire: z.input<
          ReturnType<typeof asLambdaEventSchema.fromKinesis>
        > = SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS;
        expect(snsWire.Records).toHaveLength(1);
        expect(kinesisWire.Records).toHaveLength(2);
      });
    });
  });

  given('[case8] kinesis data that is not valid base64, or not text', () => {
    /**
     * .what = the kinesis docs sample, with each record's `data` replaced
     * .why = the factory always base64-encodes valid text, so it can never reach these edges
     */
    const withKinesisData = (input: { data: string }): KinesisStreamEvent => ({
      Records: SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS.Records.map((record) => ({
        ...record,
        kinesis: { ...record.kinesis, data: input.data },
      })),
    });

    // gzip's magic bytes: what a cloudwatch-logs subscription stream delivers
    const bytesOfGzip = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xfe]);

    when('[t0] data is not valid base64, under the json default', () => {
      const result = asLambdaEventSchema
        .fromKinesis({ payload: z.object({ url: z.string() }) })
        .safeParse(withKinesisData({ data: '%%not*base64%%' }));
      then(
        'the lenient decode yields garbage, refused at data, never thrown',
        () => {
          expect(result.success).toBe(false);
          expect(asIssuePaths({ error: result.error! })).toEqual([
            'Records.0.kinesis.data',
            'Records.1.kinesis.data',
          ]);
          expect(result.error?.issues).toMatchSnapshot();
        },
      );
    });

    when(
      '[t1] data is binary, under the text opt-out with a bare string',
      () => {
        const result = asLambdaEventSchema
          .fromKinesis({ payload: z.string(), deserialize: { payload: false } })
          .safeParse(withKinesisData({ data: bytesOfGzip.toString('base64') }));
        then(
          'the bytes pass as a mangled string — the doc caution, pinned',
          () => {
            expect(result.success).toBe(true);
            expect(result.data?.Records[0]?.kinesis.data).not.toEqual(
              bytesOfGzip.toString('binary'),
            );
            expect(result.data?.Records[0]?.kinesis.data).toContain('�');
            // json-escaped, so the control bytes read as `\u0000` and the snap stays text
            expect(
              result.data?.Records.map((record) =>
                JSON.stringify(record.kinesis.data),
              ),
            ).toMatchSnapshot();
          },
        );
      },
    );

    when(
      '[t2] data is binary, under the text opt-out with a constrained form',
      () => {
        const result = asLambdaEventSchema
          .fromKinesis({
            payload: z.string().regex(/^[\x20-\x7E]+$/),
            deserialize: { payload: false },
          })
          .safeParse(withKinesisData({ data: bytesOfGzip.toString('base64') }));
        then(
          'the doc advice holds: the constrained text schema refuses it',
          () => {
            expect(result.success).toBe(false);
            expect(asIssuePaths({ error: result.error! })).toEqual([
              'Records.0.kinesis.data',
              'Records.1.kinesis.data',
            ]);
            expect(result.error?.issues).toMatchSnapshot();
          },
        );
      },
    );
  });

  given('[case9] the outputs a caller reads, pinned', () => {
    // the docs samples, with a json message or json data in place of the docs' text
    const snsRecord = SAMPLE_SNS_EVENT_FROM_AWS_DOCS.Records[0]!;
    const snsEventJson = {
      Records: [
        {
          ...snsRecord,
          Sns: { ...snsRecord.Sns, Message: JSON.stringify(notice) },
        },
      ],
    };
    const kinesisEventJson: KinesisStreamEvent = {
      Records: SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS.Records.map(
        (record, index) => ({
          ...record,
          kinesis: {
            ...record.kinesis,
            data: Buffer.from(
              JSON.stringify({ url: `/${index}`, at: index }),
            ).toString('base64'),
          },
        }),
      ),
    };
    const schemaOfClick = z.object({ url: z.string(), at: z.number() });

    when('[t0] each call form decodes its sample', () => {
      then('fromSns({ payload }) hands the handler the decoded notice', () => {
        const parsed = asLambdaEventSchema
          .fromSns({ payload: schemaOfNotice })
          .parse(snsEventJson);
        expect(parsed.Records[0]!.Sns.Message).toEqual(notice);
        expect(asSnsTimestampMasked({ event: parsed })).toMatchSnapshot();
      });
      then(
        'fromSns({ payload, text }) hands the handler the raw message',
        () => {
          const parsed = asLambdaEventSchema
            .fromSns({ payload: z.string(), deserialize: { payload: false } })
            .parse(SAMPLE_SNS_EVENT_FROM_AWS_DOCS);
          expect(parsed.Records[0]!.Sns.Message).toEqual(
            SAMPLE_SNS_EVENT_FROM_AWS_DOCS.Records[0]!.Sns.Message,
          );
          expect(asSnsTimestampMasked({ event: parsed })).toMatchSnapshot();
        },
      );
      then(
        'fromKinesis({ payload }) hands the handler each decoded record',
        () => {
          const parsed = asLambdaEventSchema
            .fromKinesis({ payload: schemaOfClick })
            .parse(kinesisEventJson);
          expect(parsed.Records.map((record) => record.kinesis.data)).toEqual(
            kinesisEventJson.Records.map((_, index) => ({
              url: `/${index}`,
              at: index,
            })),
          );
          expect(parsed).toMatchSnapshot();
        },
      );
      then(
        'fromKinesis({ payload, text }) hands the handler each utf8 line',
        () => {
          const parsed = asLambdaEventSchema
            .fromKinesis({
              payload: z.string(),
              deserialize: { payload: false },
            })
            .parse(SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS);
          expect(parsed.Records.map((record) => record.kinesis.data)).toEqual(
            SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS.Records.map((record) =>
              Buffer.from(record.kinesis.data, 'base64').toString('utf8'),
            ),
          );
          expect(parsed).toMatchSnapshot();
        },
      );
      then('fromKinesis() keeps data the base64 aws sent', () => {
        const parsed = asLambdaEventSchema
          .fromKinesis()
          .parse(SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS);
        expect(parsed).toEqual(SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS);
        expect(parsed).toMatchSnapshot();
      });
    });

    when('[t1] a text message meets the json default', () => {
      then('the sns refusal a caller reads names the fix', () => {
        const result = asLambdaEventSchema
          .fromSns({ payload: schemaOfNotice })
          .safeParse(SAMPLE_SNS_EVENT_FROM_AWS_DOCS);
        expect(result.success).toBe(false);
        expect(result.error?.issues).toMatchSnapshot();
      });
      then('the kinesis refusal a caller reads names the fix', () => {
        const result = asLambdaEventSchema
          .fromKinesis({ payload: schemaOfClick })
          .safeParse(SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS);
        expect(result.success).toBe(false);
        expect(result.error?.issues).toMatchSnapshot();
      });
    });
  });

  given('[case10] an event with no records', () => {
    // .why = sns delivers one message per invoke, so an empty sns batch is no sns delivery; a
    //        handler that reads `Records[0]` would meet one as a TypeError, a server fault aws
    //        retries. so the sns envelope refuses it
    when('[t0] each sns schema meets `Records: []`', () => {
      then('every sns form refuses it at Records', () => {
        const outcomes = [
          asLambdaEventSchema.fromSns(),
          asLambdaEventSchema.fromSns({ payload: schemaOfNotice }),
        ].map((schema) => schema.safeParse({ Records: [] }));
        expect(outcomes.map((outcome) => outcome.success)).toEqual([
          false,
          false,
        ]);
        expect(
          outcomes.map((outcome) => asIssuePaths({ error: outcome.error! })),
        ).toEqual([['Records'], ['Records']]);
        expect(
          outcomes.map((outcome) => outcome.error?.issues),
        ).toMatchSnapshot();
      });
    });

    // .why = aws's own kinesis sample handlers guard an empty batch, and a tumble window's final
    //        invoke may carry none; a refusal there answers with no `state` and suspends the shard
    when('[t1] each kinesis schema meets `Records: []`', () => {
      then('every kinesis form accepts it', () => {
        const outcomes = [
          asLambdaEventSchema.fromKinesis(),
          asLambdaEventSchema.fromKinesis({
            payload: z.object({ url: z.string() }),
          }),
        ].map((schema) => schema.safeParse({ Records: [] }));
        expect(outcomes.map((outcome) => outcome.success)).toEqual([
          true,
          true,
        ]);
        expect(outcomes.map((outcome) => outcome.data)).toMatchSnapshot();
      });
    });
  });
});
