import type { SQSEvent } from 'aws-lambda';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { asLambdaEvent } from '../asLambdaEvent/asLambdaEvent';
import { getOneLambdaEventSchemaSource } from '../lambdaEndpointWire/frame/getOneLambdaEventSchemaSource';
import { asLambdaEventSchema } from './asLambdaEventSchema';
import type { SqsEventBodyDecoded } from './SqsEventBodyDecoded';

/**
 * .what = the sqs sample event from aws's lambda docs, verbatim
 * .source = https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html § example standard queue message event
 * .note = each `body` is a plain sentence, not json — a text queue
 */
const SAMPLE_SQS_EVENT_FROM_AWS_DOCS: SQSEvent = {
  Records: [
    {
      messageId: '059f36b4-87a3-44ab-83d2-661975830a7d',
      receiptHandle: 'AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a...',
      body: 'Test message.',
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1545082649183',
        SenderId: 'AIDAIENQZJOLO23YVJ4VO',
        ApproximateFirstReceiveTimestamp: '1545082649185',
      },
      messageAttributes: {
        myAttribute: {
          stringValue: 'myValue',
          stringListValues: [],
          binaryListValues: [],
          dataType: 'String',
        },
      },
      md5OfBody: 'e4e68fb7bd0e697a0ae8f1bb342846b3',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-2:123456789012:my-queue',
      awsRegion: 'us-east-2',
    },
    {
      messageId: '2e1424d4-f796-459a-8184-9c92662be6da',
      receiptHandle: 'AQEBzWwaftRI0KuVm4tP+/7q1rGgNqicHq...',
      body: 'Test message.',
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1545082650636',
        SenderId: 'AIDAIENQZJOLO23YVJ4VO',
        ApproximateFirstReceiveTimestamp: '1545082650649',
      },
      messageAttributes: {},
      md5OfBody: 'e4e68fb7bd0e697a0ae8f1bb342846b3',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-2:123456789012:my-queue',
      awsRegion: 'us-east-2',
    },
  ],
};

/**
 * .what = a json order, the shape a task queue carries
 */
const schemaOfOrder = z.object({ orderId: z.string(), qty: z.number() });
const order = { orderId: 'ord-7', qty: 2 };

/**
 * .what = reads the issue paths a refusal names, as dotted strings
 */
const asIssuePaths = (input: { error: z.ZodError }): string[] =>
  input.error.issues.map((issue) => issue.path.join('.'));

describe('asLambdaEventSchema.fromSqs', () => {
  given('[case1] fromSqs(), envelope only', () => {
    const schema = asLambdaEventSchema.fromSqs();

    when('[t0] the aws docs sample is parsed', () => {
      then('it passes, and the body stays the wire string', () => {
        const event = schema.parse(SAMPLE_SQS_EVENT_FROM_AWS_DOCS);
        expect(event.Records.map((record) => record.body)).toEqual([
          'Test message.',
          'Test message.',
        ]);
      });
      then('the envelope is kept whole, the attributes included', () => {
        const event = schema.parse(SAMPLE_SQS_EVENT_FROM_AWS_DOCS);
        expect(event).toEqual(SAMPLE_SQS_EVENT_FROM_AWS_DOCS);
        expect(event).toMatchSnapshot();
      });
    });

    when('[t1] a factory event is parsed', () => {
      then('it passes: the fixture and the schema agree', () => {
        const event = asLambdaEvent.fromSqs({ messages: ['a', 'b'] });
        expect(schema.parse(event)).toEqual(event);
      });
    });

    when('[t2] an sns event is parsed as sqs', () => {
      const result = schema.safeParse(
        asLambdaEvent.fromSns({ messages: ['hi'] }),
      );
      then('it is refused: the source is not sqs', () => {
        expect(result.success).toBe(false);
      });
    });

    when('[t3] a key aws adds later rides the record', () => {
      then('it is kept, never stripped', () => {
        const event = asLambdaEvent.fromSqs({
          messages: ['a'],
          record: { futureKey: 'kept' } as never,
        });
        expect(schema.parse(event).Records[0]).toHaveProperty(
          'futureKey',
          'kept',
        );
      });
    });

    when('[t4] an event with no records is parsed', () => {
      then('it passes, as the forSqs decoder accepts it', () => {
        expect(schema.parse({ Records: [] })).toEqual({ Records: [] });
      });
    });

    /**
     * .why = aws sends `md5OfMessageAttributes: null` on a message with no attributes, though
     *        `@types/aws-lambda` says `?: string`, so neither the docs sample nor the factory shows
     *        it. a schema that refused it would refuse real batches, and under `forAsk` that refusal
     *        deletes the whole batch
     */
    when('[t5] a record carries md5OfMessageAttributes: null', () => {
      const event = {
        Records: [
          {
            ...SAMPLE_SQS_EVENT_FROM_AWS_DOCS.Records[1]!,
            md5OfMessageAttributes: null,
          },
        ],
      };
      then(
        'it passes, and the null reads as absent, as SQSEvent declares',
        () => {
          const parsed = schema.parse(event);
          expect(parsed.Records[0]!.md5OfMessageAttributes).toBeUndefined();
          expect(parsed.Records[0]!.messageId).toEqual(
            event.Records[0]!.messageId,
          );
        },
      );
      then('the payload form passes it too', () => {
        const result = asLambdaEventSchema
          .fromSqs({ payload: z.string(), deserialize: { payload: false } })
          .safeParse(event);
        expect(result.success).toBe(true);
      });
    });
  });

  given('[case2] fromSqs({ payload }), a json body', () => {
    const schema = asLambdaEventSchema.fromSqs({ payload: schemaOfOrder });

    when('[t0] a factory event with a json order is parsed', () => {
      const event = asLambdaEvent.fromSqs({
        messages: [JSON.stringify(order)],
      });
      then('body is the decoded, validated order', () => {
        const body = schema.parse(event).Records[0]?.body;
        expect(body).toEqual(order);
        expect(body).toMatchSnapshot();
      });
      then('every other envelope field is kept as sent', () => {
        expect(schema.parse(event).Records[0]?.messageId).toEqual(
          event.Records[0]?.messageId,
        );
      });
    });

    when('[t1] the second order fails the payload schema', () => {
      const result = schema.safeParse(
        asLambdaEvent.fromSqs({
          messages: [
            JSON.stringify(order),
            JSON.stringify({ ...order, qty: 'two' }),
          ],
        }),
      );
      then('it is refused at the field inside that body', () => {
        expect(result.success).toBe(false);
        expect(asIssuePaths({ error: result.error! })).toEqual([
          'Records.1.body.qty',
        ]);
        expect(result.error?.issues).toMatchSnapshot();
      });
    });

    when('[t2] the body is not json', () => {
      const result = schema.safeParse(SAMPLE_SQS_EVENT_FROM_AWS_DOCS);
      then('it is refused at body, never thrown', () => {
        expect(result.success).toBe(false);
        expect(asIssuePaths({ error: result.error! })).toEqual([
          'Records.0.body',
          'Records.1.body',
        ]);
      });
      then('the issue names the text opt-out as the fix', () => {
        expect(result.error?.issues[0]?.message).toContain(
          'deserialize: { payload: false }',
        );
      });
    });
  });

  given('[case3] fromSqs({ payload, deserialize: { payload: false } })', () => {
    const schema = asLambdaEventSchema.fromSqs({
      payload: z.string().min(1),
      deserialize: { payload: false },
    });

    when('[t0] the aws docs sample, a text queue, is parsed', () => {
      then('body meets the payload schema as the raw string', () => {
        const event = schema.parse(SAMPLE_SQS_EVENT_FROM_AWS_DOCS);
        expect(event.Records[0]?.body).toEqual('Test message.');
        expect(event).toMatchSnapshot();
      });
    });

    when('[t1] the text fails the payload schema', () => {
      const result = schema.safeParse(
        asLambdaEvent.fromSqs({ messages: [''] }),
      );
      then('it is refused at body', () => {
        expect(asIssuePaths({ error: result.error! })).toEqual([
          'Records.0.body',
        ]);
      });
    });
  });

  given('[case4] the declared faces', () => {
    when('[t0] each call form is built and read', () => {
      then('the two call forms carry their own face types', () => {
        // a compile-time read: each assignment fails to compile if the face drifts
        const envelope: SQSEvent = asLambdaEventSchema
          .fromSqs()
          .parse(SAMPLE_SQS_EVENT_FROM_AWS_DOCS);
        const decoded: SqsEventBodyDecoded<{ orderId: string; qty: number }> =
          asLambdaEventSchema
            .fromSqs({ payload: schemaOfOrder })
            .parse(
              asLambdaEvent.fromSqs({ messages: [JSON.stringify(order)] }),
            );
        expect(envelope.Records).toHaveLength(2);
        expect(decoded.Records[0]?.body.orderId).toEqual('ord-7');
      });

      then('each schema declares its source as sqs, for forAsk to read', () => {
        expect(
          getOneLambdaEventSchemaSource({
            schema: asLambdaEventSchema.fromSqs(),
          }),
        ).toEqual({ name: 'sqs' });
        expect(
          getOneLambdaEventSchemaSource({
            schema: asLambdaEventSchema.fromSqs({ payload: schemaOfOrder }),
          }),
        ).toEqual({ name: 'sqs' });
      });
    });
  });
});
