import {
  BadRequestError,
  ConstraintError,
  MalfunctionError,
} from 'helpful-errors';
import { getError, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import {
  asLambdaEndpointOutput,
  asLambdaEvent,
  asLambdaEventSchema,
  genLambdaEndpoint,
  runLambdaEndpoint,
} from '../src/index';

/**
 * .what = drives sns and kinesis handlers, wired with `asLambdaEventSchema`, through the surface
 *         a consumer imports
 * .why = the unit suites reach the schemas and the warn line by deep paths no consumer can
 *        write. this suite proves the public names compose: the factory builds the event aws
 *        sends, the schema validates it, `forAsk` hands `invoke` the decoded payload
 *        (`rule.require.acceptance.blackbox`)
 *
 * .note = `struct: { payload: 'ancient' }` sends the event as aws does — bare, with no
 *         `{ event, trail }` wrapper, which aws never sends to an sns or kinesis handler
 * .note = on a caller fault the handler RETURNS its refusal body (`errorType: 'BadRequestError'`)
 *         rather than throw, so aws records the invoke as a success. that is why a refusal snap
 *         pairs an error-shaped `result` with a line whose `consequence` says "success"
 */

/**
 * .what = runs a step and records each warn line the sdk emits within it
 * .note = a spy, never a mock: it calls through to the real `console.warn`
 *         (`rule.forbid.acceptance.mocks`)
 */
const withWarnLines = async <T>(input: {
  step: () => Promise<T>;
}): Promise<{ result: T; lines: unknown[] }> => {
  const spy = jest.spyOn(console, 'warn');
  try {
    const result = await input.step();
    return { result, lines: spy.mock.calls.map((args) => args[0]) };
  } finally {
    spy.mockRestore();
  }
};

/**
 * .what = the `lambda.event.refused` line, with its volatile fields masked
 * .why = the timestamp and trail exid move each run; every other field is the operator's
 *        contract, so it stays whole for the snapshot
 *        (`rule.require.snapshots-deny-volatile-not-allow-expected`)
 */
const asRefusedLineMasked = (input: {
  lines: unknown[];
}): Record<string, unknown> | null => {
  const found = input.lines.find(
    (line): line is Record<string, unknown> =>
      isRecord(line) && line.message === 'lambda.event.refused',
  );
  if (!found) return null;

  // read each masked field, and fail with a named error when the line's shape drifts
  const metadata: unknown =
    typeof found.metadata === 'string'
      ? JSON.parse(found.metadata)
      : found.metadata;
  if (!isRecord(metadata) || !Array.isArray(metadata.ids))
    throw new Error(
      'lambda.event.refused line drifted: metadata.ids is not a list; read the line, then update this masker',
    );
  const trail = isRecord(found.trail) ? found.trail : null;
  return {
    ...found,
    timestamp: '<timestamp>',
    // indexed, so the snap shows which id belongs to which record
    metadata: {
      ...metadata,
      ids: metadata.ids.map((_, index) => `<id:${index}>`),
    },
    ...(trail ? { trail: { ...trail, exid: '<exid>' } } : {}),
  };
};

/**
 * .what = the raw ids the `lambda.event.refused` line names, before any mask
 * .why = the snap masks each id, so a line that logged the wrong field would still match it; this
 *        read lets a test tie the ids to the event's own
 */
const getRefusedLineIds = (input: { lines: unknown[] }): unknown[] => {
  const found = input.lines.find(
    (line): line is Record<string, unknown> =>
      isRecord(line) && line.message === 'lambda.event.refused',
  );
  const metadata: unknown =
    typeof found?.metadata === 'string'
      ? JSON.parse(found.metadata)
      : found?.metadata;
  if (!isRecord(metadata) || !Array.isArray(metadata.ids))
    throw new Error(
      'lambda.event.refused line absent, or its metadata.ids is not a list; read the lines',
    );
  return metadata.ids;
};

/**
 * .what = whether a value is a record one can read keys off
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

describe('asLambdaEventSchema, via the public surface', () => {
  given('[case1] an ses-notice handler on an sns topic', () => {
    const handler = genLambdaEndpoint.forAsk({
      schema: {
        input: asLambdaEventSchema.fromSns({
          payload: z.object({
            notificationType: z.enum(['Bounce', 'Complaint', 'Delivery']),
            mail: z.object({ messageId: z.string() }),
          }),
        }),
        output: z.object({
          type: z.enum(['Bounce', 'Complaint', 'Delivery']),
          messageId: z.string(),
        }),
      },
      invoke: async ({ payload }) => ({
        type: payload.Records[0]!.Sns.Message.notificationType,
        messageId: payload.Records[0]!.Sns.Message.mail.messageId,
      }),
    });

    when('[t0] sns delivers a valid notice', () => {
      const result = useThen('the invoke completes', async () =>
        runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asLambdaEvent.fromSns({
            messages: [
              JSON.stringify({
                notificationType: 'Bounce',
                mail: { messageId: 'm-1' },
              }),
            ],
          }),
        }),
      );
      then('invoke read the decoded, typed message', () => {
        expect(result).toEqual({ type: 'Bounce', messageId: 'm-1' });
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] sns delivers a notice type the schema does not know', () => {
      const event = asLambdaEvent.fromSns({
        messages: [
          JSON.stringify({
            notificationType: 'DeliveryDelay',
            mail: { messageId: 'm-2' },
          }),
        ],
      });
      const outcome = useThen('the invoke completes', async () =>
        withWarnLines({ step: async () =>
          runLambdaEndpoint.onReferenced({
            handler,
            struct: { payload: 'ancient' },
            event,
          }),
        }),
      );
      then('the line names the MessageId of the notice sns sent', () => {
        expect(getRefusedLineIds({ lines: outcome.lines })).toEqual(
          event.Records.map((record) => record.Sns.MessageId),
        );
      });
      then('the answer is a caller fault, so lambda does not retry', () => {
        expect(outcome.result).toMatchObject({ errorType: 'BadRequestError' });
      });
      then('one refusal line names the source and the field', () => {
        const line = asRefusedLineMasked({ lines: outcome.lines });
        expect(line).toMatchObject({
          level: 'warn',
          metadata: {
            source: 'sns',
            ids: ['<id:0>'],
            issues: [
              expect.objectContaining({
                path: 'Records.0.Sns.Message.notificationType',
              }),
            ],
          },
        });
        expect({ result: outcome.result, line }).toMatchSnapshot();
      });
    });
  });

  given('[case2] a cloudfront log line handler on a kinesis stream', () => {
    const handler = genLambdaEndpoint.forAsk({
      schema: {
        input: asLambdaEventSchema.fromKinesis({
          payload: z.string().regex(/\t/, 'expected a tab-separated log line'),
          deserialize: { payload: false },
        }),
        output: z.object({ lines: z.array(z.string()) }),
      },
      invoke: async ({ payload }) => ({
        lines: payload.Records.map((record) => record.kinesis.data),
      }),
    });

    when('[t0] kinesis delivers a batch of tab-separated log lines', () => {
      const result = useThen('the invoke completes', async () =>
        runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asLambdaEvent.fromKinesis({
            records: ['1700000000\t/a\t200', '1700000001\t/b\t404'],
          }),
        }),
      );
      then('invoke read each decoded line', () => {
        expect(result).toEqual({
          lines: ['1700000000\t/a\t200', '1700000001\t/b\t404'],
        });
        // each line split at its tabs, so the snap shows every field (a raw tab reads as spaces)
        expect(
          asLambdaEndpointOutput(result).lines.map((line) => line.split('\t')),
        ).toMatchSnapshot();
      });
    });

    when('[t1] one record in the batch is not a log line', () => {
      const event = asLambdaEvent.fromKinesis({
        records: ['1700000000\t/a\t200', 'not a log line'],
      });
      const outcome = useThen('the invoke completes', async () =>
        withWarnLines({ step: async () =>
          runLambdaEndpoint.onReferenced({
            handler,
            struct: { payload: 'ancient' },
            event,
          }),
        }),
      );
      then('the line names the eventID of every record kinesis sent', () => {
        expect(getRefusedLineIds({ lines: outcome.lines })).toEqual(
          event.Records.map((record) => record.eventID),
        );
      });
      then('the whole batch is answered as a caller fault', () => {
        expect(outcome.result).toMatchObject({ errorType: 'BadRequestError' });
      });
      then('the refusal line names the bad record and every eventID', () => {
        const line = asRefusedLineMasked({ lines: outcome.lines });
        expect(line).toMatchObject({
          metadata: {
            source: 'kinesis',
            ids: ['<id:0>', '<id:1>'],
            issues: [
              expect.objectContaining({ path: 'Records.1.kinesis.data' }),
            ],
          },
        });
        expect({ result: outcome.result, line }).toMatchSnapshot();
      });
    });
  });

  given('[case3] handlers wired with the envelope-only forms', () => {
    const handlerOfSns = genLambdaEndpoint.forAsk({
      schema: {
        input: asLambdaEventSchema.fromSns(),
        output: z.object({ message: z.string() }),
      },
      invoke: async ({ payload }) => ({
        message: payload.Records[0]!.Sns.Message,
      }),
    });
    const handlerOfKinesis = genLambdaEndpoint.forAsk({
      schema: {
        input: asLambdaEventSchema.fromKinesis(),
        output: z.object({ data: z.string() }),
      },
      invoke: async ({ payload }) => ({
        data: payload.Records[0]!.kinesis.data,
      }),
    });

    when('[t0] sns delivers a message', () => {
      const result = useThen('the invoke completes', async () =>
        runLambdaEndpoint.onReferenced({
          handler: handlerOfSns,
          struct: { payload: 'ancient' },
          event: asLambdaEvent.fromSns({ messages: ['{"kind":"alert"}'] }),
        }),
      );
      then('invoke read the message as the wire string', () => {
        expect(result).toEqual({ message: '{"kind":"alert"}' });
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] kinesis delivers a record', () => {
      const result = useThen('the invoke completes', async () =>
        runLambdaEndpoint.onReferenced({
          handler: handlerOfKinesis,
          struct: { payload: 'ancient' },
          event: asLambdaEvent.fromKinesis({ records: ['hello'] }),
        }),
      );
      then('invoke read the data still base64', () => {
        expect(result).toEqual({
          data: Buffer.from('hello', 'utf8').toString('base64'),
        });
        // the decode beside the wire value, so the snap alone shows the base64 holds `hello`
        const { data } = asLambdaEndpointOutput(result);
        expect({
          data,
          decoded: Buffer.from(data, 'base64').toString('utf8'),
        }).toMatchSnapshot();
      });
    });

    when('[t2] an sqs event is misrouted to the sns handler', () => {
      const outcome = useThen('the invoke completes', async () =>
        withWarnLines({
          step: async () =>
            runLambdaEndpoint.onReferenced({
              handler: handlerOfSns,
              struct: { payload: 'ancient' },
              // .as = a deliberate misroute: the declared input forbids this event, so only a cast sends it
              event: asLambdaEvent.fromSqs({ messages: ['{}'] }) as never,
            }),
        }),
      );
      then('the answer is a caller fault, refused at the envelope', () => {
        expect(outcome.result).toMatchObject({ errorType: 'BadRequestError' });
        const line = asRefusedLineMasked({ lines: outcome.lines });
        expect(line).toMatchObject({
          metadata: {
            source: 'sns',
            ids: [],
            issues: expect.arrayContaining([
              expect.objectContaining({ path: 'Records.0.EventSource' }),
              expect.objectContaining({ path: 'Records.0.Sns' }),
            ]),
          },
        });
        expect({ result: outcome.result, line }).toMatchSnapshot();
      });
    });
  });

  given('[case4] a click handler on a kinesis stream, json by default', () => {
    const handler = genLambdaEndpoint.forAsk({
      schema: {
        input: asLambdaEventSchema.fromKinesis({
          payload: z.object({ url: z.string() }),
        }),
        output: z.object({ urls: z.array(z.string()) }),
      },
      invoke: async ({ payload }) => {
        const urls = payload.Records.map((record) => record.kinesis.data.url);
        if (urls.includes('/blocked'))
          throw new ConstraintError('clicks on /blocked are not counted', {
            urls,
          });
        return { urls };
      },
    });

    when('[t0] kinesis delivers a batch of json clicks', () => {
      const result = useThen('the invoke completes', async () =>
        runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asLambdaEvent.fromKinesis({
            records: [JSON.stringify({ url: '/a' }), JSON.stringify({ url: '/b' })],
          }),
        }),
      );
      then('invoke read each record decoded and parsed', () => {
        expect(result).toEqual({ urls: ['/a', '/b'] });
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] the stream sends text, but the schema was left on the json default', () => {
      const outcome = useThen('the invoke completes', async () =>
        withWarnLines({
          step: async () =>
            runLambdaEndpoint.onReferenced({
              handler,
              struct: { payload: 'ancient' },
              event: asLambdaEvent.fromKinesis({
                records: ['1700000000\t/a\t200'],
              }),
            }),
        }),
      );
      then('the batch is acknowledged, and the refusal line names the opt-out', () => {
        expect(outcome.result).toMatchObject({ errorType: 'BadRequestError' });
        const line = asRefusedLineMasked({ lines: outcome.lines });
        expect(JSON.stringify(line)).toContain('deserialize: { payload: false }');
        expect({ result: outcome.result, line }).toMatchSnapshot();
      });
    });

    when('[t2] the handler itself refuses the batch with a ConstraintError', () => {
      const outcome = useThen('the invoke completes', async () =>
        withWarnLines({
          step: async () =>
            runLambdaEndpoint.onReferenced({
              handler,
              struct: { payload: 'ancient' },
              event: asLambdaEvent.fromKinesis({
                records: [JSON.stringify({ url: '/blocked' })],
              }),
            }),
        }),
      );
      then('the batch is acknowledged, and the refusal line names the cause', () => {
        expect(outcome.result).toMatchObject({ errorType: 'BadRequestError' });
        const line = asRefusedLineMasked({ lines: outcome.lines });
        expect(line).toMatchObject({
          level: 'warn',
          metadata: {
            source: 'kinesis',
            ids: ['<id:0>'],
            class: 'ConstraintError',
            issues: [],
          },
        });
        expect({ result: outcome.result, line }).toMatchSnapshot();
      });
    });
  });

  given('[case5] an sns handler whose invoke refuses a notice', () => {
    const handler = genLambdaEndpoint.forAsk({
      schema: {
        input: asLambdaEventSchema.fromSns({
          payload: z.object({ notificationType: z.string() }),
        }),
        output: z.object({ handled: z.boolean() }),
      },
      invoke: async ({ payload }) => {
        if (payload.Records[0]!.Sns.Message.notificationType === 'Complaint')
          throw new BadRequestError('complaints route to the abuse desk');
        return { handled: true };
      },
    });

    when('[t0] sns delivers a complaint', () => {
      const outcome = useThen('the invoke completes', async () =>
        withWarnLines({
          step: async () =>
            runLambdaEndpoint.onReferenced({
              handler,
              struct: { payload: 'ancient' },
              event: asLambdaEvent.fromSns({
                messages: [JSON.stringify({ notificationType: 'Complaint' })],
              }),
            }),
        }),
      );
      then('the notice is acknowledged, and the refusal line names the cause', () => {
        expect(outcome.result).toMatchObject({ errorType: 'BadRequestError' });
        const line = asRefusedLineMasked({ lines: outcome.lines });
        expect(line).toMatchObject({
          level: 'warn',
          metadata: {
            source: 'sns',
            ids: ['<id:0>'],
            class: 'BadRequestError',
          },
        });
        expect({ result: outcome.result, line }).toMatchSnapshot();
      });
    });
  });

  given('[case6] an sns handler, tested on the default struct', () => {
    // .why = a consumer's first test sends no `struct`, so it rides the contemp default: the event
    //        arrives in a `{ event, trail }` wrapper, and a refusal answers in the nested body
    const handler = genLambdaEndpoint.forAsk({
      schema: {
        input: asLambdaEventSchema.fromSns({
          payload: z.object({ notificationType: z.string() }),
        }),
        output: z.object({ handled: z.boolean() }),
      },
      invoke: async () => ({ handled: true }),
    });

    when('[t0] a notice of the wrong shape is sent', () => {
      const outcome = useThen('the invoke completes', async () =>
        withWarnLines({
          step: async () =>
            runLambdaEndpoint.onReferenced({
              handler,
              event: asLambdaEvent.fromSns({
                messages: [JSON.stringify({ kind: 'bounce' })],
              }),
            }),
        }),
      );
      then('the refusal answers in the contemp body, and the line still names the id', () => {
        expect(outcome.result).toMatchObject({
          error: { class: 'ConstraintError' },
        });
        const line = asRefusedLineMasked({ lines: outcome.lines });
        expect(line).toMatchObject({
          level: 'warn',
          metadata: { source: 'sns', ids: ['<id:0>'], class: 'ConstraintError' },
        });
        expect({ result: outcome.result, line }).toMatchSnapshot();
      });
    });
  });

  given('[case7] an sns handler in prep, asked for its contract', () => {
    const handler = genLambdaEndpoint.forAsk(
      {
        schema: {
          input: asLambdaEventSchema.fromSns({
            payload: z.object({ notificationType: z.string() }),
          }),
          output: z.object({ handled: z.boolean() }),
        },
        invoke: async () => ({ handled: true }),
      },
      { env: { access: 'prep' } },
    );

    when('[t0] a caller introspects it', () => {
      const result = useThen('the handler returns its schema', async () =>
        runLambdaEndpoint.onReferenced({
          handler,
          // .as = the introspect probe is no sns event; the handler answers it before validation
          event: { introspect: 'schema' } as never,
        }),
      );
      then(
        'the published input is the wire face: a non-empty Records of sns notices, Message a string',
        () => {
          const published = JSON.stringify(result);
          expect(published).toContain('"Records"');
          expect(published).toContain('"minItems":1');
          expect(published).toContain('"aws:sns"');
          expect(published).toContain('"Message":{"type":"string"');
          expect(result).toMatchSnapshot();
        },
      );
    });
  });

  given('[case8] a kinesis handler whose upstream is down', () => {
    const handler = genLambdaEndpoint.forAsk({
      schema: {
        input: asLambdaEventSchema.fromKinesis({
          payload: z.object({ url: z.string() }),
        }),
        output: z.object({ urls: z.array(z.string()) }),
      },
      invoke: async () => {
        throw new MalfunctionError('the click store is down');
      },
    });

    when('[t0] kinesis delivers a batch', () => {
      // .note = wrapped, since `useThen` copies only enumerable keys and an Error keeps none
      const caught = useThen('the invoke fails', async () =>
        withWarnLines({
          step: async () => ({
            error: await getError(
              runLambdaEndpoint.onReferenced({
                handler,
                struct: { payload: 'ancient' },
                event: asLambdaEvent.fromKinesis({
                  records: [JSON.stringify({ url: '/a' })],
                }),
              }),
            ),
          }),
        }),
      );
      then('the throw surfaces, so lambda retries the batch', () => {
        expect(caught.result.error).toBeInstanceOf(MalfunctionError);
        expect(caught.result.error.message).toContain('the click store is down');
      });
      then('no refusal line is written, since this is no caller fault', () => {
        expect(asRefusedLineMasked({ lines: caught.lines })).toBeNull();
      });
    });
  });

  given('[case9] a kinesis handler in prep, asked for its contract', () => {
    const handler = genLambdaEndpoint.forAsk(
      {
        schema: {
          input: asLambdaEventSchema.fromKinesis({
            payload: z.object({ url: z.string() }),
          }),
          output: z.object({ urls: z.array(z.string()) }),
        },
        invoke: async ({ payload }) => ({
          urls: payload.Records.map((record) => record.kinesis.data.url),
        }),
      },
      { env: { access: 'prep' } },
    );

    when('[t0] a caller introspects it', () => {
      const result = useThen('the handler returns its schema', async () =>
        runLambdaEndpoint.onReferenced({
          handler,
          // .as = the introspect probe is no kinesis event; the handler answers it before validation
          event: { introspect: 'schema' } as never,
        }),
      );
      then('the published input is the wire face: data a string, not the decoded shape', () => {
        const published = JSON.stringify(result);
        expect(published).toContain('"Records"');
        expect(published).toContain('"aws:kinesis"');
        expect(published).toContain('"data":{"type":"string"');
        expect(published).not.toContain('"url"');
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case10] an envelope-only kinesis handler that reports per-record failures', () => {
    // .why = the readme names this answer for a stream of mixed quality, under
    //        `ReportBatchItemFailures`; the handler judges each record and names the bad ones
    const handler = genLambdaEndpoint.forAsk({
      schema: {
        input: asLambdaEventSchema.fromKinesis(),
        output: z.object({
          batchItemFailures: z.array(z.object({ itemIdentifier: z.string() })),
        }),
      },
      invoke: async ({ payload }) => ({
        batchItemFailures: payload.Records.filter(
          (record) =>
            Buffer.from(record.kinesis.data, 'base64').toString('utf8') === 'bad',
        ).map((record) => ({ itemIdentifier: record.kinesis.sequenceNumber })),
      }),
    });

    when('[t0] kinesis delivers a batch with one bad record', () => {
      const event = asLambdaEvent.fromKinesis({ records: ['good', 'bad'] });
      const result = useThen('the invoke completes', async () =>
        runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event,
        }),
      );
      then('the answer names only the bad record, by its sequence number', () => {
        expect(result).toEqual({
          batchItemFailures: [
            { itemIdentifier: event.Records[1]!.kinesis.sequenceNumber },
          ],
        });
        expect(
          asLambdaEndpointOutput(result).batchItemFailures.map(
            (failure, index) => ({ ...failure, itemIdentifier: `<seq:${index}>` }),
          ),
        ).toMatchSnapshot();
      });
    });
  });
});
