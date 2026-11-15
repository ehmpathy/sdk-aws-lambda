import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { getError, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import {
  SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS,
  SAMPLE_SNS_EVENT_FROM_AWS_DOCS,
} from '../src/__test_assets__/awsDocsEventSamples';
import {
  asLambdaEvent,
  asLambdaEventSchema,
  genLambdaEndpoint,
  runLambdaEndpoint,
} from '../src/index';

/**
 * .what = drives every record-source half this sdk added beside sqs — `forSns`,
 *         `forKinesis.perRecord`, `forKinesis.perBatch`, and `fromSqs` — through the surface a
 *         consumer imports
 * .why = the unit cases reach each leaf by a deep path no consumer can write, so they prove the
 *        operation and say not one word about whether the exported name runs. this suite proves
 *        the names RUN; `local.sdkContract` proves they EXIST (`rule.require.acceptance.blackbox`)
 */

/**
 * .what = runs a step and records each warn line the sdk emits within it, while the real line
 *         still reaches the console
 * .why = an acknowledged refusal is a successful invoke, so its warn line is the only trace a
 *        test can read
 * .note = a spy, never a mock: it calls through (`rule.forbid.acceptance.mocks`)
 */
const withWarnLines = async <T>(
  step: () => Promise<T>,
): Promise<{ result: T; lines: string[] }> => {
  const spy = jest.spyOn(console, 'warn');
  try {
    const result = await step();
    return {
      result,
      lines: spy.mock.calls.map((args) =>
        args.map((arg) => JSON.stringify(arg)).join(' '),
      ),
    };
  } finally {
    spy.mockRestore();
  }
};

/**
 * .what = reads a recorded warn line back into the object the log outlet emitted, with its
 *         json-string `metadata` parsed too; any other value passes through
 * .why = a line snapped as one escaped string buries the `hint` and the `issues` an operator
 *        reads. as an object, the snapshot lays each field out as a tree a reviewer can read
 */
const asLineObject = (value: unknown): unknown => {
  const parsed =
    typeof value === 'string' && value.startsWith('{') ? JSON.parse(value) : value;
  if (typeof parsed !== 'object' || parsed === null) return parsed;
  const metadata: unknown = Reflect.get(parsed, 'metadata');
  if (typeof metadata !== 'string' || !metadata.startsWith('{')) return parsed;
  return { ...parsed, metadata: JSON.parse(metadata) };
};

/**
 * .what = masks the values each run mints — the clock, the trail exid, a factory message id — so
 *         the rest of an answer or a line can be pinned whole
 * .why = a snapshot of the live journey catches drift in every byte that is stable; a volatile
 *        byte left in would make the snapshot fail on each run instead
 */
const asSnapMasked = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(asLineObject(value))
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<timestamp>')
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
        '<uuid>',
      ),
  );

describe('the record sources beside sqs', () => {
  given('[case1] an sns topic served by genLambdaEndpoint.forSns', () => {
    const seen: unknown[] = [];
    const handler = genLambdaEndpoint.forSns({
      schema: {
        input: z.object({
          payload: z.object({ notice: z.string() }),
        }),
      },
      invoke: async ({ payload, headers }) => {
        seen.push({ payload, headers });
      },
    });

    when('[t0] a valid notice arrives', () => {
      const outcome = useThen('the invoke resolves', async () =>
        withWarnLines(() =>
          runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromSns({
              messages: [JSON.stringify({ notice: 'n-1' })],
            }),
          }),
        ),
      );

      then('the handler reads the decoded payload', () => {
        expect(seen).toContainEqual({ payload: { notice: 'n-1' }, headers: {} });
        expect({ seen: seen.at(-1), result: outcome.result }).toMatchSnapshot();
      });

      then('no refusal line is logged', () => {
        expect(
          outcome.lines.filter((line) => line.includes('sns.record.refused')),
        ).toEqual([]);
      });
    });

    when('[t1] a notice the schema refuses arrives', () => {
      const outcome = useThen('the invoke still resolves', async () =>
        withWarnLines(() =>
          runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromSns({
              messages: [JSON.stringify({ notice: 7 })],
            }),
          }),
        ),
      );

      then('one refusal line names the source and the schema path', () => {
        const lines = outcome.lines.filter((line) =>
          line.includes('sns.record.refused'),
        );
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('notice');
        expect(asSnapMasked(lines[0])).toMatchSnapshot();
      });
    });

    when('[t2] a text message arrives on the json default', () => {
      const outcome = useThen('the invoke still resolves', async () =>
        withWarnLines(() =>
          runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromSns({ messages: ['your mail bounced'] }),
          }),
        ),
      );

      then('the refusal line names the `deserialize` fix', () => {
        const lines = outcome.lines.filter((line) =>
          line.includes('sns.record.refused'),
        );
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('deserialize: { payload: false }');
        expect(asSnapMasked(lines[0])).toMatchSnapshot();
      });
    });

    when('[t3] a notice arrives with message attributes', () => {
      const event = asLambdaEvent.fromSns({
        messages: [JSON.stringify({ notice: 'n-2' })],
      });
      useThen('the invoke resolves', async () =>
        runLambdaEndpoint.onReferenced({
          handler,
          event: {
            Records: event.Records.map((record) => ({
              ...record,
              Sns: {
                ...record.Sns,
                MessageAttributes: {
                  Origin: { Type: 'String', Value: 'ses' },
                },
              },
            })),
          },
        }),
      );

      // sns attribute names are case-sensitive, so the flatten keeps them verbatim
      then('headers are the flattened attributes, names verbatim', () => {
        expect(seen).toContainEqual({
          payload: { notice: 'n-2' },
          headers: { Origin: 'ses' },
        });
        expect(seen.at(-1)).toMatchSnapshot();
      });
    });

    /**
     * .what = a server fault escapes the invoke
     * .why = sns retries a failed delivery, so the throw must reach lambda unchanged, never be
     *        acknowledged as a refusal
     */
    /**
     * .what = a caller fault the handler throws is acknowledged, never retried
     * .why = sns would retry a thrown delivery, and a retry of a message the handler judged bad
     *        can never succeed
     */
    when('[t4] the handler throws a ConstraintError', () => {
      const handlerRefuses = genLambdaEndpoint.forSns({
        schema: { input: z.object({ payload: z.object({ notice: z.string() }) }) },
        invoke: async () => {
          throw new ConstraintError('notice is for a closed account');
        },
      });
      const outcome = useThen('the invoke resolves', async () =>
        withWarnLines(() =>
          runLambdaEndpoint.onReferenced({
            handler: handlerRefuses,
            event: asLambdaEvent.fromSns({
              messages: [JSON.stringify({ notice: 'n-4' })],
            }),
          }),
        ),
      );

      then('one refusal line names the class and the reason', () => {
        const lines = outcome.lines.filter((line) =>
          line.includes('sns.record.refused'),
        );
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('notice is for a closed account');
        expect(asSnapMasked(lines[0])).toMatchSnapshot();
      });
    });

    when('[t5] the handler throws a MalfunctionError', () => {
      const handlerThrows = genLambdaEndpoint.forSns({
        schema: { input: z.object({ payload: z.object({ notice: z.string() }) }) },
        invoke: async () => {
          throw new MalfunctionError('the mail store is down');
        },
      });

      then('the throw escapes, so sns retries the delivery', async () => {
        const error = await getError(
          runLambdaEndpoint.onReferenced({
            handler: handlerThrows,
            event: asLambdaEvent.fromSns({
              messages: [JSON.stringify({ notice: 'n-3' })],
            }),
          }),
        );
        expect(error).toBeInstanceOf(MalfunctionError);
        expect(asSnapMasked(error.message)).toMatchSnapshot();
      });
    });
  });

  given(
    '[case2] a kinesis stream served by genLambdaEndpoint.forKinesis.perRecord',
    () => {
      const seen: unknown[] = [];
      const handler = genLambdaEndpoint.forKinesis.perRecord({
        // strict, so a stray `headers` key on a kinesis record would refuse every valid one
        schema: {
          input: z.object({ payload: z.object({ clickId: z.string() }) }).strict(),
        },
        invoke: async (input) => {
          seen.push(input.payload);
        },
      });

      when('[t0] a valid click arrives under a strict schema', () => {
        const outcome = useThen('the invoke resolves', async () =>
          withWarnLines(() =>
            runLambdaEndpoint.onReferenced({
              handler,
              event: asLambdaEvent.fromKinesis({
                records: [JSON.stringify({ clickId: 'c-1' })],
              }),
            }),
          ),
        );

        then('the handler reads the decoded click', () => {
          expect(seen).toContainEqual({ clickId: 'c-1' });
          expect({
            seen: seen.at(-1),
            result: outcome.result,
          }).toMatchSnapshot();
        });

        then('no refusal line is logged', () => {
          expect(
            outcome.lines.filter((line) =>
              line.includes('kinesis.record.refused'),
            ),
          ).toEqual([]);
        });
      });

      when('[t1] a text record arrives on the json default', () => {
        const outcome = useThen('the invoke still resolves', async () =>
          withWarnLines(() =>
            runLambdaEndpoint.onReferenced({
              handler,
              event: asLambdaEvent.fromKinesis({ records: ['hello world'] }),
            }),
          ),
        );

        then('the refusal line names the `deserialize` fix', () => {
          const lines = outcome.lines.filter((line) =>
            line.includes('kinesis.record.refused'),
          );
          expect(lines).toHaveLength(1);
          expect(lines[0]).toContain('deserialize: { payload: false }');

          // the whole line an operator reads; the clock and the minted exid are masked, since each run differs
          expect(asSnapMasked(lines[0])).toMatchSnapshot();
        });
      });

      /**
       * .what = a caller fault the handler throws is acknowledged, never retried
       * .why = a retry of a record the handler judged bad would stall the shard on it forever
       */
      when('[t2] the handler throws a ConstraintError', () => {
        const handlerRefuses = genLambdaEndpoint.forKinesis.perRecord({
          schema: { input: z.object({ payload: z.object({ clickId: z.string() }) }) },
          invoke: async () => {
            throw new ConstraintError('click is from a banned caller');
          },
        });
        const outcome = useThen('the invoke resolves', async () =>
          withWarnLines(() =>
            runLambdaEndpoint.onReferenced({
              handler: handlerRefuses,
              event: asLambdaEvent.fromKinesis({
                records: [JSON.stringify({ clickId: 'c-banned' })],
              }),
            }),
          ),
        );

        then('one refusal line names the class and the reason', () => {
          const lines = outcome.lines.filter((line) =>
            line.includes('kinesis.record.refused'),
          );
          expect(lines).toHaveLength(1);
          expect(lines[0]).toContain('click is from a banned caller');
          expect(asSnapMasked(lines[0])).toMatchSnapshot();
        });
      });

      /**
       * .what = a server fault escapes the invoke
       * .why = kinesis retries the record on a throw, which is what a transient fault needs
       */
      when('[t3] the handler throws a MalfunctionError', () => {
        const handlerThrows = genLambdaEndpoint.forKinesis.perRecord({
          schema: { input: z.object({ payload: z.object({ clickId: z.string() }) }) },
          invoke: async () => {
            throw new MalfunctionError('the click store is down');
          },
        });

        then('the throw escapes, so kinesis retries the record', async () => {
          const error = await getError(
            runLambdaEndpoint.onReferenced({
              handler: handlerThrows,
              event: asLambdaEvent.fromKinesis({
                records: [JSON.stringify({ clickId: 'c-2' })],
              }),
            }),
          );
          expect(error).toBeInstanceOf(MalfunctionError);
          expect(asSnapMasked(error.message)).toMatchSnapshot();
        });
      });
    },
  );

  given(
    '[case3] a kinesis stream served by genLambdaEndpoint.forKinesis.perBatch',
    () => {
      const handler = genLambdaEndpoint.forKinesis.perBatch({
        schema: {
          input: z.object({ payload: z.object({ clickId: z.string() }) }),
        },
        // the handler claims every valid record but the one it could not store
        invoke: async ({ records }) => ({
          successes: records.filter(
            (record) => record.payload.clickId !== 'c-fails',
          ),
        }),
      });
      const event = asLambdaEvent.fromKinesis({
        records: [
          JSON.stringify({ clickId: 'c-1' }),
          JSON.stringify({ clickId: 'c-fails' }),
          JSON.stringify({ at: 3 }),
        ],
      });

      when('[t0] a batch of a valid, a failed, and a refused record arrives', () => {
        const outcome = useThen('the invoke resolves', async () =>
          withWarnLines(() =>
            runLambdaEndpoint.onReferenced({ handler, event }),
          ),
        );

        /**
         * .what = the answer names the failed record alone
         * .why = the refused record is a caller fault, acknowledged; the valid one was claimed.
         *        kinesis checkpoints below the lowest id named, so the failed record redrives,
         *        and with it every record after it in the shard — the refused one included, which
         *        then warns again on each redrive
         */
        then('batchItemFailures names the failed record alone', () => {
          expect(outcome.result).toEqual({
            batchItemFailures: [
              { itemIdentifier: event.Records[1]!.kinesis.sequenceNumber },
            ],
          });
          expect(outcome.result).toMatchSnapshot();
        });

        then('the refused record leaves one refusal line', () => {
          const lines = outcome.lines.filter((line) =>
            line.includes('kinesis.record.refused'),
          );
          expect(lines).toHaveLength(1);
          expect(lines[0]).toContain(event.Records[2]!.kinesis.sequenceNumber);
          expect(asSnapMasked(lines[0])).toMatchSnapshot();
        });
      });

      /**
       * .what = the throw contract that differs from `perRecord`
       * .why = no single record owns a batch handler's throw, so a caller-fault class retries the
       *        whole batch too, and at kinesis that holds the shard
       */
      when('[t1] the handler throws a ConstraintError', () => {
        const handlerThrows = genLambdaEndpoint.forKinesis.perBatch({
          schema: {
            input: z.object({ payload: z.object({ clickId: z.string() }) }),
          },
          invoke: async () => {
            throw new ConstraintError('click is from a banned caller');
          },
        });

        then('the throw escapes, so the whole batch retries', async () => {
          const error = await getError(
            runLambdaEndpoint.onReferenced({
              handler: handlerThrows,
              event: asLambdaEvent.fromKinesis({
                records: [JSON.stringify({ clickId: 'c-1' })],
              }),
            }),
          );
          expect(error.message).toContain('click is from a banned caller');
          expect(asSnapMasked(error.message)).toMatchSnapshot();
        });
      });
    },
  );

  given('[case4] an sqs schema from asLambdaEventSchema.fromSqs, under forAsk', () => {
    const handler = genLambdaEndpoint.forAsk({
      schema: {
        input: asLambdaEventSchema.fromSqs({
          payload: z.object({ orderId: z.string() }),
        }),
        output: z.object({ orderIds: z.array(z.string()) }),
      },
      invoke: async ({ payload }) => ({
        orderIds: payload.Records.map((record) => record.body.orderId),
      }),
    });

    when('[t0] a batch of valid messages arrives', () => {
      const outcome = useThen('the invoke resolves', async () =>
        withWarnLines(() =>
          runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromSqs({
              messages: [
                JSON.stringify({ orderId: 'o-1' }),
                JSON.stringify({ orderId: 'o-2' }),
              ],
            }),
          }),
        ),
      );

      then('the handler reads each decoded body', () => {
        expect(outcome.result).toEqual({ orderIds: ['o-1', 'o-2'] });
        expect(outcome.result).toMatchSnapshot();
      });
    });

    when('[t1] one message in the batch is refused', () => {
      const outcome = useThen('the invoke resolves', async () =>
        withWarnLines(() =>
          runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromSqs({
              messages: [
                JSON.stringify({ orderId: 'o-1' }),
                JSON.stringify({ order: 2 }),
              ],
            }),
          }),
        ),
      );

      // the runner hands back the caller-fault body as a value, so its class rides in the body
      then('the batch is answered as a caller fault', () => {
        expect(outcome.result).not.toBeInstanceOf(Error);
        expect(JSON.stringify(outcome.result)).toMatch(
          /ConstraintError|BadRequestError/,
        );
        expect(asSnapMasked(outcome.result)).toMatchSnapshot();
      });

      /**
       * .what = the whole batch is refused, and the warn line says sqs deletes it
       * .why = sqs deletes a batch whose invoke succeeds, so the line is the only trace, and it
       *        points at `forSqs`, the family that acknowledges a refused message alone
       */
      then('the warn line names the deletion and the family to move to', () => {
        const line = outcome.lines.find((each) =>
          each.includes('lambda.event.refused'),
        );
        expect(line).toContain('sqs deletes every message in it');
        expect(line).toContain('genLambdaEndpoint.forSqs');
        expect(asSnapMasked(line)).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = drives aws's own sample events, verbatim from its lambda docs, through each endpoint
   * .why = every other case here builds its event with this sdk's `asLambdaEvent` factory, so a
   *        shape that is wrong in both the factory and the decoder would pass. these samples were
   *        written by aws, so they share no premise with the decoder
   * .note = both samples carry text, not json, so each endpoint opts out of the json parse
   */
  given('[case5] the verbatim aws-docs sample events', () => {
    when('[t0] the sns sample reaches genLambdaEndpoint.forSns', () => {
      const seen: unknown[] = [];
      const handler = genLambdaEndpoint.forSns({
        schema: {
          input: z.object({
            headers: z.record(z.string(), z.string()),
            payload: z.string(),
          }),
        },
        deserialize: { payload: false },
        invoke: async ({ payload, headers }) => {
          seen.push({ payload, headers });
        },
      });
      const outcome = useThen('the invoke resolves', async () =>
        withWarnLines(() =>
          runLambdaEndpoint.onReferenced({
            handler,
            event: SAMPLE_SNS_EVENT_FROM_AWS_DOCS,
          }),
        ),
      );

      then('the handler reads the message and its attributes', () => {
        expect(seen).toEqual([
          {
            payload: 'Hello from SNS!',
            headers: { Test: 'TestString', TestBinary: 'TestBinary' },
          },
        ]);
        expect(seen).toMatchSnapshot();
      });

      then('no refusal line is logged', () => {
        expect(
          outcome.lines.filter((line) => line.includes('record.refused')),
        ).toEqual([]);
      });
    });

    when('[t1] the kinesis sample reaches genLambdaEndpoint.forKinesis.perBatch', () => {
      const seen: unknown[] = [];
      const handler = genLambdaEndpoint.forKinesis.perBatch({
        schema: { input: z.object({ payload: z.string() }) },
        deserialize: { payload: false },
        invoke: async ({ records }) => {
          seen.push(
            ...records.map((record) => ({ id: record.id, payload: record.payload })),
          );
          return { successes: records };
        },
      });
      const outcome = useThen('the invoke resolves', async () =>
        withWarnLines(() =>
          runLambdaEndpoint.onReferenced({
            handler,
            event: SAMPLE_KINESIS_EVENT_FROM_AWS_DOCS,
          }),
        ),
      );

      then('the handler reads each decoded record, keyed by sequence number', () => {
        expect(seen).toEqual([
          {
            id: '49590338271490256608559692538361571095921575989136588898',
            payload: 'Hello, this is a test.',
          },
          {
            id: '49590338271490256608559692540925702759324208523137515618',
            payload: 'This is only a test.',
          },
        ]);
        expect(seen).toMatchSnapshot();
      });

      then('the answer retries no record', () => {
        expect(outcome.result).toEqual({ batchItemFailures: [] });
        expect(outcome.result).toMatchSnapshot();
      });
    });
  });
});
