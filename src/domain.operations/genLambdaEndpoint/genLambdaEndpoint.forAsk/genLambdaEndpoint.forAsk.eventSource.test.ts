import type { Context, KinesisStreamEvent, SNSEvent } from 'aws-lambda';
import {
  BadRequestError,
  ConstraintError,
  getError,
  MalfunctionError,
} from 'helpful-errors';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { asLambdaEvent } from '../../asLambdaEvent/asLambdaEvent';
import { asLambdaEventSchema } from '../../asLambdaEventSchema/asLambdaEventSchema';
import { asLambdaContext } from '../../runLambdaEndpoint/context/asLambdaContext';
import { getJsonSchemaFromZod } from '../middleware/genIntrospectionMiddleware.getJsonSchemaFromZod';
import { forAsk } from './genLambdaEndpoint.forAsk';

/**
 * .what = runs a handler and reads the warn lines it left
 * .why = an event-source refusal is a successful invoke, so the warn line is its only trace
 * .note = a spy, never a mock: the real line still prints, and the test reads what it was handed
 */
const getOutcome = async <TEvent>(input: {
  handler: (event: TEvent, context: Context) => Promise<unknown>;
  event: TEvent;
}): Promise<{ result: unknown; warnLines: string[] }> => {
  const spy = jest.spyOn(console, 'warn');
  try {
    const result = await input.handler(input.event, asLambdaContext());
    const warnLines = spy.mock.calls.map((args) =>
      args.map((arg) => JSON.stringify(arg)).join(' '),
    );
    return { result, warnLines };
  } finally {
    spy.mockRestore();
  }
};

const schemaOfNotice = z.object({
  notificationType: z.enum(['Bounce', 'Complaint', 'Delivery']),
});

describe('forAsk, with an asLambdaEventSchema input', () => {
  given('[case1] an sns handler wired with fromSns({ payload })', () => {
    const handler = forAsk({
      schema: {
        input: asLambdaEventSchema.fromSns({ payload: schemaOfNotice }),
        output: z.object({ type: z.string() }),
      },
      // the message is typed by the payload schema; no JSON.parse, no cast
      invoke: async ({ payload }) => ({
        type: payload.Records[0]!.Sns.Message.notificationType,
      }),
    });

    when('[t0] aws delivers a valid notice', () => {
      const event: SNSEvent = asLambdaEvent.fromSns({
        messages: [JSON.stringify({ notificationType: 'Bounce' })],
      });
      const outcome = useThen('the handler accepts the SNSEvent', async () =>
        getOutcome({ handler, event }),
      );
      then('invoke reads the decoded message', () => {
        expect(outcome.result).toEqual({ type: 'Bounce' });
      });
      then('no refusal line is logged', () => {
        expect(
          outcome.warnLines.filter((line) =>
            line.includes('lambda.event.refused'),
          ),
        ).toEqual([]);
      });
    });

    when('[t1] aws delivers a notice the payload schema refuses', () => {
      const event: SNSEvent = asLambdaEvent.fromSns({
        messages: [JSON.stringify({ notificationType: 'DeliveryDelay' })],
      });
      const outcome = useThen('the invoke succeeds', async () =>
        getOutcome({ handler, event }),
      );
      then(
        'the answer is a caller fault body, so lambda does not retry',
        () => {
          expect(outcome.result).toMatchObject({
            errorType: 'BadRequestError',
          });
        },
      );
      then(
        'one warn line names the source, the path, and the message id',
        () => {
          const lines = outcome.warnLines.filter((line) =>
            line.includes('lambda.event.refused'),
          );
          expect(lines).toHaveLength(1);
          expect(lines[0]).toContain('"level":"warn"');
          expect(lines[0]).toContain('sns');
          expect(lines[0]).toContain('Records.0.Sns.Message.notificationType');
          expect(lines[0]).toContain(event.Records[0]!.Sns.MessageId);
        },
      );
    });

    when('[t2] an sqs event is misrouted to it', () => {
      const outcome = useThen('the invoke succeeds', async () =>
        getOutcome({
          // .as = a deliberate misroute: the declared input forbids this event, so only a cast sends it
          handler: handler as unknown as (
            event: unknown,
            context: Context,
          ) => Promise<unknown>,
          event: asLambdaEvent.fromSqs({ messages: ['{}'] }),
        }),
      );
      then('the warn line names the absent sns key, with no ids', () => {
        const line = outcome.warnLines.find((each) =>
          each.includes('lambda.event.refused'),
        );
        expect(line).toContain('Records.0.Sns');
        expect(line).toContain('\\"ids\\":[]');
      });
    });
  });

  given('[case2] a kinesis handler wired with fromKinesis({ payload })', () => {
    const handler = forAsk({
      schema: {
        input: asLambdaEventSchema.fromKinesis({
          payload: z.object({ url: z.string() }),
        }),
        output: z.object({ urls: z.array(z.string()) }),
      },
      invoke: async ({ payload }) => ({
        urls: payload.Records.map((record) => record.kinesis.data.url),
      }),
    });

    when('[t0] one record in a batch of two is refused', () => {
      const event: KinesisStreamEvent = asLambdaEvent.fromKinesis({
        records: [JSON.stringify({ url: '/a' }), JSON.stringify({ at: 1 })],
      });
      const outcome = useThen('the invoke succeeds', async () =>
        getOutcome({ handler, event }),
      );
      then('the whole batch is answered as a caller fault', () => {
        expect(outcome.result).toMatchObject({ errorType: 'BadRequestError' });
      });
      then(
        'the warn line names the bad record and every eventID to replay',
        () => {
          const line = outcome.warnLines.find((each) =>
            each.includes('lambda.event.refused'),
          );
          expect(line).toContain('Records.1.kinesis.data.url');
          expect(line).toContain(event.Records[0]!.eventID);
          expect(line).toContain(event.Records[1]!.eventID);
        },
      );
    });
  });

  given(
    '[case2b] a payload schema whose own callback throws a ConstraintError',
    () => {
      /**
       * .why = that error escapes `safeParse` raw, so it carries no `issues` metadata. the warn line
       *        must still name the cause, and must state `issues` as an array, never `undefined`
       */
      const handler = forAsk({
        schema: {
          input: asLambdaEventSchema.fromSns({
            payload: schemaOfNotice.refine((notice) => {
              if (notice.notificationType === 'Complaint')
                throw new ConstraintError('complaints route to the abuse desk');
              return true;
            }),
          }),
          output: z.object({ type: z.string() }),
        },
        invoke: async ({ payload }) => ({
          type: payload.Records[0]!.Sns.Message.notificationType,
        }),
      });

      when('[t0] the callback throws', () => {
        const outcome = useThen('the invoke succeeds', async () =>
          getOutcome({
            handler,
            event: asLambdaEvent.fromSns({
              messages: [JSON.stringify({ notificationType: 'Complaint' })],
            }),
          }),
        );
        then(
          'the warn line names the cause, with issues as an empty array',
          () => {
            const line = outcome.warnLines.find((each) =>
              each.includes('lambda.event.refused'),
            );
            expect(line).toContain('complaints route to the abuse desk');
            expect(line).toContain('\\"issues\\":[]');
          },
        );
      });
    },
  );

  given(
    '[case2c] a payload schema whose own callback throws a BadRequestError',
    () => {
      /**
       * .why = `genConstraintErrorMiddleware` answers a BadRequestError as a caller fault too, so
       *        aws drops the event the same way. the warn line must fire for every throw that
       *        predicate accepts, not only this copy's ConstraintError class
       */
      const handler = forAsk({
        schema: {
          input: asLambdaEventSchema.fromSns({
            payload: schemaOfNotice.refine((notice) => {
              if (notice.notificationType === 'Complaint')
                throw new BadRequestError('complaints route to the abuse desk');
              return true;
            }),
          }),
          output: z.object({ type: z.string() }),
        },
        invoke: async ({ payload }) => ({
          type: payload.Records[0]!.Sns.Message.notificationType,
        }),
      });

      when('[t0] the callback throws', () => {
        const outcome = useThen('the invoke succeeds', async () =>
          getOutcome({
            handler,
            event: asLambdaEvent.fromSns({
              messages: [JSON.stringify({ notificationType: 'Complaint' })],
            }),
          }),
        );
        then('the answer is a caller fault body', () => {
          expect(outcome.result).toMatchObject({
            errorType: 'BadRequestError',
          });
        });
        then('the warn line is logged, with its class and cause', () => {
          const line = outcome.warnLines.find((each) =>
            each.includes('lambda.event.refused'),
          );
          expect(line).toContain('complaints route to the abuse desk');
          expect(line).toContain('BadRequestError');
          expect(line).toContain('\\"issues\\":[]');
        });
      });
    },
  );

  given(
    '[case2d] an sns handler whose own invoke throws a ConstraintError',
    () => {
      /**
       * .why = `forAsk` answers a caller fault from `invoke` as a success too, so aws drops the
       *        event the same way a schema refusal does. the warn line is its only trace,
       *        whichever step refused it
       */
      const handler = forAsk({
        schema: {
          input: asLambdaEventSchema.fromSns({ payload: schemaOfNotice }),
          output: z.object({ type: z.string() }),
        },
        invoke: async ({ payload }) => {
          if (payload.Records[0]!.Sns.Message.notificationType === 'Complaint')
            throw new ConstraintError('complaints route to the abuse desk');
          return { type: payload.Records[0]!.Sns.Message.notificationType };
        },
      });

      when('[t0] invoke refuses the notice', () => {
        const event: SNSEvent = asLambdaEvent.fromSns({
          messages: [JSON.stringify({ notificationType: 'Complaint' })],
        });
        const outcome = useThen('the invoke succeeds', async () =>
          getOutcome({ handler, event }),
        );
        then(
          'the answer is a caller fault body, so lambda does not retry',
          () => {
            expect(outcome.result).toMatchObject({
              errorType: 'BadRequestError',
            });
          },
        );
        then('one warn line names the cause and the message id', () => {
          const lines = outcome.warnLines.filter((line) =>
            line.includes('lambda.event.refused'),
          );
          expect(lines).toHaveLength(1);
          expect(lines[0]).toContain('"level":"warn"');
          expect(lines[0]).toContain('complaints route to the abuse desk');
          expect(lines[0]).toContain('ConstraintError');
          expect(lines[0]).toContain(event.Records[0]!.Sns.MessageId);
        });
      });
    },
  );

  given(
    '[case2e] a kinesis handler whose own invoke throws a server fault',
    () => {
      const handler = forAsk({
        schema: {
          input: asLambdaEventSchema.fromKinesis(),
          output: z.object({ count: z.number() }),
        },
        invoke: async () => {
          throw new MalfunctionError('downstream store unreachable');
        },
      });

      when('[t0] invoke throws', () => {
        const outcome = useThen('the invoke fails', async () => {
          const spy = jest.spyOn(console, 'warn');
          try {
            const error = await getError(
              handler(
                asLambdaEvent.fromKinesis({ records: ['a'] }),
                asLambdaContext(),
              ),
            );
            const refusals = spy.mock.calls.filter((args) =>
              JSON.stringify(args).includes('lambda.event.refused'),
            );
            return { error, refusalCount: refusals.length };
          } finally {
            spy.mockRestore();
          }
        });
        then('the throw surfaces, so the shard retries the batch', () => {
          expect(outcome.error).toBeInstanceOf(MalfunctionError);
        });
        then('no refusal line; a retried batch is not dropped', () => {
          expect(outcome.refusalCount).toEqual(0);
        });
      });
    },
  );

  given(
    '[case2g] an sns handler whose invoke, or whose payload transform, throws a server fault',
    () => {
      const handlerWithInvokeThrow = forAsk({
        schema: {
          input: asLambdaEventSchema.fromSns(),
          output: z.object({ ok: z.boolean() }),
        },
        invoke: async () => {
          throw new MalfunctionError('downstream store unreachable');
        },
      });
      const handlerWithTransformThrow = forAsk({
        schema: {
          input: asLambdaEventSchema.fromSns({
            payload: z.object({ kind: z.string() }).transform(() => {
              throw new Error('lookup table unreachable');
            }),
          }),
          output: z.object({ ok: z.boolean() }),
        },
        invoke: async () => ({ ok: true }),
      });

      /**
       * .what = runs a handler on one sns notice, and counts the refusal lines it writes
       */
      const runAndCountRefusals = async (input: {
        handler: typeof handlerWithInvokeThrow;
      }): Promise<{ error: Error; refusalCount: number }> => {
        const spy = jest.spyOn(console, 'warn');
        try {
          const error = await getError(
            input.handler(
              asLambdaEvent.fromSns({ messages: ['{"kind":"alert"}'] }),
              asLambdaContext(),
            ),
          );
          const refusals = spy.mock.calls.filter((args) =>
            JSON.stringify(args).includes('lambda.event.refused'),
          );
          return { error, refusalCount: refusals.length };
        } finally {
          spy.mockRestore();
        }
      };

      when('[t0] invoke throws a MalfunctionError', () => {
        const outcome = useThen('the invoke fails', async () =>
          runAndCountRefusals({ handler: handlerWithInvokeThrow }),
        );
        then('the throw surfaces, so lambda retries the notice', () => {
          expect(outcome.error).toBeInstanceOf(MalfunctionError);
        });
        then('no refusal line', () => {
          expect(outcome.refusalCount).toEqual(0);
        });
      });

      when('[t1] the payload transform throws a plain Error', () => {
        const outcome = useThen('the invoke fails', async () =>
          runAndCountRefusals({ handler: handlerWithTransformThrow }),
        );
        then('the throw surfaces as a server fault, never a refusal', () => {
          expect(outcome.error.message).toContain('lookup table unreachable');
        });
        then('no refusal line', () => {
          expect(outcome.refusalCount).toEqual(0);
        });
      });
    },
  );

  given(
    '[case2f] an sns schema the consumer refined at the envelope (a zod clone)',
    () => {
      /**
       * .why = `.refine` is the natural envelope wrap (e.g. one record per invoke). the clone keeps
       *        the source via `_zod.parent`, so its refusals still warn
       */
      const handler = forAsk({
        schema: {
          input: asLambdaEventSchema
            .fromSns()
            .refine((event) => event.Records.length === 1, {
              message: 'expected exactly one record per invoke',
            }),
          output: z.object({ ok: z.boolean() }),
        },
        invoke: async () => ({ ok: true }),
      });

      when('[t0] aws delivers two records', () => {
        const outcome = useThen('the invoke succeeds', async () =>
          getOutcome({
            handler,
            event: asLambdaEvent.fromSns({ messages: ['a', 'b'] }),
          }),
        );
        then('the warn line is written, with the refine message', () => {
          const lines = outcome.warnLines.filter((line) =>
            line.includes('lambda.event.refused'),
          );
          expect(lines).toHaveLength(1);
          expect(lines[0]).toContain('expected exactly one record per invoke');
        });
      });
    },
  );

  given('[case3] a direct-invoke handler with a plain schema', () => {
    const handler = forAsk({
      schema: {
        input: z.object({ name: z.string() }),
        output: z.object({ ok: z.boolean() }),
      },
      invoke: async () => ({ ok: true }),
    });

    when('[t0] a caller sends a value the schema refuses', () => {
      const outcome = useThen('the invoke succeeds', async () =>
        getOutcome({
          // .as = a deliberate misroute: the declared input forbids this event, so only a cast sends it
          handler: handler as unknown as (
            event: unknown,
            context: Context,
          ) => Promise<unknown>,
          event: { name: 7 },
        }),
      );
      then('the answer is a caller fault body', () => {
        expect(outcome.result).toMatchObject({ errorType: 'BadRequestError' });
      });
      then('no refusal warn line is logged; its log level is unchanged', () => {
        expect(
          outcome.warnLines.filter((line) =>
            line.includes('lambda.event.refused'),
          ),
        ).toEqual([]);
      });
    });
  });

  given('[case4] the published input contract', () => {
    when('[t0] an sns and a kinesis schema with payload are rendered', () => {
      const sns = getJsonSchemaFromZod(
        asLambdaEventSchema.fromSns({ payload: schemaOfNotice }),
      );
      // json default, so the decoded shape is an object and a leak of it would show
      const kinesis = getJsonSchemaFromZod(
        asLambdaEventSchema.fromKinesis({
          payload: z.object({ url: z.string() }),
        }),
      );
      then(
        'each payload slot shows the wire string, never the decoded shape',
        () => {
          expect(JSON.stringify(sns)).toContain('"Message":{"type":"string"}');
          expect(JSON.stringify(kinesis)).toContain('"data":{"type":"string"}');
          expect(JSON.stringify(kinesis)).not.toContain('"url"');
          expect(sns).toMatchSnapshot();
          expect(kinesis).toMatchSnapshot();
        },
      );
    });
  });
});
