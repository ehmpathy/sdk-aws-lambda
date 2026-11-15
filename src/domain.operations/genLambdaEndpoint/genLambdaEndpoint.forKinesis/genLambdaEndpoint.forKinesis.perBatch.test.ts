import type { KinesisStreamEvent } from 'aws-lambda';
import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { getError, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { asLambdaEvent } from '../../asLambdaEvent/asLambdaEvent';
import { runLambdaEndpoint } from '../../runLambdaEndpoint/runLambdaEndpoint';
import type { ForKinesisPerBatchInput } from './genLambdaEndpoint.forKinesis.perBatch';
import { perBatch } from './genLambdaEndpoint.forKinesis.perBatch';

type PayloadDeclared = { clickId: string };

/**
 * .what = the bag and context `invoke` receives, derived from the contract rather than restated
 */
type InvokeInput = Parameters<
  ForKinesisPerBatchInput<PayloadDeclared>['invoke']
>[0];
type InvokeContext = Parameters<
  ForKinesisPerBatchInput<PayloadDeclared>['invoke']
>[1];

const SCHEMA_CLICK = z.object({
  payload: z.object({ clickId: z.string() }),
});

/**
 * .what = runs a handler the way a deployed kinesis trigger does, and reads the log lines it left
 * .why = an acknowledged refusal is a successful invoke, so the warn line is its only trace
 * .note = a spy, never a mock: the real line still prints
 */
const getKinesisOutcome = async (input: {
  handler: ReturnType<typeof perBatch>;
  event: KinesisStreamEvent;
}): Promise<{
  response: unknown;
  error: Error | null;
  warnLines: string[];
}> => {
  const spy = jest.spyOn(console, 'warn');
  try {
    const result = await runLambdaEndpoint
      .onReferenced({ handler: input.handler, event: input.event })
      .then((response) => ({ response, error: null }))
      .catch((caught: Error) => ({ response: null, error: caught }));
    const warnLines = spy.mock.calls.map((args) =>
      args.map((arg) => JSON.stringify(arg)).join(' '),
    );
    return { ...result, warnLines };
  } finally {
    spy.mockRestore();
  }
};

describe('genLambdaEndpoint.forKinesis.perBatch', () => {
  given(
    '[case1] a batch of four: one malformed, one the handler fails, two served',
    () => {
      const seen: { input: InvokeInput; context: InvokeContext }[] = []; // .note = deliberate mutation in a const box: invoke has no return path
      const handler = perBatch({
        schema: { input: SCHEMA_CLICK },
        invoke: async (input, context) => {
          seen.push({ input, context });
          return {
            successes: input.records.filter(
              (record) => record.payload.clickId !== 'c-fail',
            ),
          };
        },
      });
      const event = asLambdaEvent.fromKinesis({
        records: [
          JSON.stringify({ clickId: 'c-1' }),
          JSON.stringify({ wrong: 'shape' }),
          JSON.stringify({ clickId: 'c-fail' }),
          JSON.stringify({ clickId: 'c-4' }),
        ],
      });
      const sequenceOf = (index: number): string =>
        event.Records[index]!.kinesis.sequenceNumber;

      when('[t0] aws delivers it', () => {
        const outcome = useThen('the invoke succeeds', async () =>
          getKinesisOutcome({ handler, event }),
        );

        then('the handler is handed only the records that passed', () => {
          expect(
            seen[0]?.input.records.map((record) => record.payload.clickId),
          ).toEqual(['c-1', 'c-fail', 'c-4']);
        });

        // a filter, never a copy: each record handed over IS its peer in `event.records`
        then(
          'each record handed over is the same object as its envelope peer',
          () => {
            const records = seen[0]?.input.records;
            const peers = seen[0]?.input.event.records;
            expect(records?.[0]).toBe(peers?.[0]);
            expect(records?.[1]).toBe(peers?.[2]);
            expect(records?.[2]).toBe(peers?.[3]);
          },
        );

        then('each record id is its sequence number', () => {
          expect(seen[0]?.input.records.map((record) => record.id)).toEqual([
            sequenceOf(0),
            sequenceOf(2),
            sequenceOf(3),
          ]);
        });

        then('the event holds all four, base64-decoded', () => {
          expect(seen[0]?.input.event.records).toHaveLength(4);
          expect(seen[0]?.input.event.records[1]?.payload).toEqual({
            wrong: 'shape',
          });
        });

        then(
          'a kinesis record carries no headers slot — absent, not empty',
          () => {
            expect('headers' in seen[0]!.input.records[0]!).toEqual(false);
          },
        );

        then(
          'only the failed record is answered, by sequence number, so kinesis checkpoints before it',
          () => {
            expect(outcome.response).toEqual({
              batchItemFailures: [{ itemIdentifier: sequenceOf(2) }],
            });
            expect(outcome.response).toMatchSnapshot();
          },
        );

        then(
          'the malformed record is acknowledged with one warn line, which names it',
          () => {
            const lines = outcome.warnLines.filter((line) =>
              line.includes('kinesis.record.refused'),
            );
            expect(lines).toHaveLength(1);
            expect(lines[0]).toContain(sequenceOf(1));
            expect(lines[0]).toContain('ConstraintError');
            expect(lines[0]).toContain(event.Records[1]!.eventID);
          },
        );

        then('the envelope is frozen', () => {
          expect(Object.isFrozen(seen[0]?.input.event)).toEqual(true);
          expect(Object.isFrozen(seen[0]?.input.records)).toEqual(true);
        });

        then('a fresh exid is minted; no caller trail is read', () => {
          expect(seen[0]?.context.log.trail?.exid).toMatch(/^exid:/);
        });
      });
    },
  );

  given('[case2] a handler whose answer the sdk cannot read', () => {
    when('[t0] it answers with bare id strings', () => {
      const handler = perBatch({
        schema: { input: SCHEMA_CLICK },
        invoke: async ({ records }) => ({
          // .as = a deliberate malformed answer: the declared return forbids bare strings
          successes: records.map((record) => record.id) as unknown as {
            id: string;
          }[],
        }),
      });

      then(
        'it fails loud and names the fix, so the batch retries',
        async () => {
          const error = await getError(
            runLambdaEndpoint.onReferenced({
              handler,
              event: asLambdaEvent.fromKinesis({
                records: [JSON.stringify({ clickId: 'c-1' })],
              }),
            }),
          );
          expect(error.message).toContain(
            'forKinesis.perBatch handler answered with a success that carries no `id`',
          );
          expect(error.message).toContain('return the records themselves');

          // the whole text a developer meets; kinesis fixture ids are derived, so none is masked
          expect(error.message).toMatchSnapshot();
        },
      );
    });

    when('[t1] it answers with no successes array', () => {
      const handler = perBatch({
        schema: { input: SCHEMA_CLICK },
        // .as = a deliberate malformed answer: the declared return requires `successes`
        invoke: async () => ({}) as unknown as { successes: [] },
      });

      then('it fails loud', async () => {
        const error = await getError(
          runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromKinesis({
              records: [JSON.stringify({ clickId: 'c-1' })],
            }),
          }),
        );
        expect(error.message).toContain(
          'forKinesis.perBatch handler answered without a `successes` array',
        );
        expect(error.message).toMatchSnapshot();
      });
    });
  });

  given('[case12] a valid batch, then a handler that throws', () => {
    when('[t0] every record is served', () => {
      const handler = perBatch({
        schema: { input: SCHEMA_CLICK },
        invoke: async ({ records }) => ({ successes: records }),
      });
      const outcome = useThen('the invoke succeeds', async () =>
        getKinesisOutcome({
          handler,
          event: asLambdaEvent.fromKinesis({
            records: [
              JSON.stringify({ clickId: 'c-1' }),
              JSON.stringify({ clickId: 'c-2' }),
            ],
          }),
        }),
      );

      then('an empty failure list: kinesis advances past the batch', () => {
        expect(outcome.response).toEqual({ batchItemFailures: [] });
        expect(outcome.response).toMatchSnapshot();
      });
    });

    when('[t1] the handler throws', () => {
      const handler = perBatch({
        schema: { input: SCHEMA_CLICK },
        invoke: async () => {
          throw new MalfunctionError('the click store is down');
        },
      });

      then('the throw escapes, so the whole batch retries', async () => {
        const error = await getError(
          runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromKinesis({
              records: [JSON.stringify({ clickId: 'c-1' })],
            }),
          }),
        );
        expect(error.message).toContain('the click store is down');
      });
    });

    /**
     * .what = the throw contract that differs from `perRecord`
     * .why = no single record owns a throw from a batch handler, so even a caller-fault class
     *        retries the whole batch — and at kinesis that holds the shard. an author who moves from
     *        `perRecord` keeps the throw, so the difference is pinned here
     */
    when('[t2] the handler throws a ConstraintError', () => {
      const handler = perBatch({
        schema: { input: SCHEMA_CLICK },
        invoke: async () => {
          throw new ConstraintError('click is from a banned caller');
        },
      });
      const outcome = useThen('the invoke fails', async () =>
        getKinesisOutcome({
          handler,
          event: asLambdaEvent.fromKinesis({
            records: [JSON.stringify({ clickId: 'c-1' })],
          }),
        }),
      );

      then('the throw escapes, so the whole batch retries', () => {
        expect(outcome.error?.message).toContain(
          'click is from a banned caller',
        );
      });

      then('no refusal line is logged — no record was acknowledged', () => {
        expect(
          outcome.warnLines.filter((line) =>
            line.includes('kinesis.record.refused'),
          ),
        ).toEqual([]);
      });
    });

    when('[t3] the batch is empty', () => {
      const seen: unknown[] = []; // .note = deliberate mutation in a const box: invoke has no return path
      const handler = perBatch({
        schema: { input: SCHEMA_CLICK },
        invoke: async ({ records }) => {
          seen.push(records);
          return { successes: [] };
        },
      });

      then(
        'the handler runs with no records, and naught is retried',
        async () => {
          const response = await runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromKinesis({ records: [] }),
          });
          expect(seen).toEqual([[]]);
          expect(response).toEqual({ batchItemFailures: [] });
        },
      );
    });

    /**
     * .why = a refused record is acknowledged, so a batch the schema refuses whole still owes the
     *        handler its turn and kinesis an empty failure list; a skipped invoke or a retried
     *        refusal would hold the shard behind records that fail the same way every time
     */
    when('[t4] the schema refuses every record', () => {
      const seen: unknown[] = []; // .note = deliberate mutation in a const box: invoke has no return path
      const handler = perBatch({
        schema: { input: SCHEMA_CLICK },
        invoke: async ({ records }) => {
          seen.push(records);
          return { successes: records };
        },
      });
      const outcome = useThen('the invoke succeeds', async () =>
        getKinesisOutcome({
          handler,
          event: asLambdaEvent.fromKinesis({
            records: [
              JSON.stringify({ wrong: 'shape' }),
              JSON.stringify({ wrong: 'shape' }),
            ],
          }),
        }),
      );

      then('the handler still runs, with no records', () => {
        expect(outcome.error).toBeNull();
        expect(seen).toEqual([[]]);
      });

      then('naught is retried: each refusal is acknowledged', () => {
        expect(outcome.response).toEqual({ batchItemFailures: [] });
      });

      then('each record leaves one refusal line', () => {
        expect(
          outcome.warnLines.filter((line) =>
            line.includes('kinesis.record.refused'),
          ),
        ).toHaveLength(2);
      });
    });
  });

  /**
   * .what = the freeze this variant owes, at depth and at compile time
   * .why = `[case1]` reads `Object.isFrozen` at the top, which a shallow freeze would pass. a batch
   *        variant reads `event.records` after `invoke`, so a forged id there would rewrite the set
   *        its own claim guard checks (`rule.require.frozen-invoke-inputs`)
   */
  given('[case16] a handler that writes to what it was handed', () => {
    when('[t0] it writes into a record, one level in', () => {
      then('the write is refused at run time', async () => {
        const handler = perBatch({
          schema: { input: SCHEMA_CLICK },
          invoke: async ({ records }) => {
            (records[0] as { id: string }).id = 'forged';
            return { successes: records };
          },
        });
        const error = await getError(
          runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromKinesis({
              records: [JSON.stringify({ clickId: 'c-1' })],
            }),
          }),
        );
        expect(error.message).toContain('read only property');
      });
    });

    when('[t1] the write is a compile error too', () => {
      then('the contract types the guarantee on every slot', () => {
        const declared: ForKinesisPerBatchInput<PayloadDeclared> = {
          schema: { input: SCHEMA_CLICK },
          invoke: async ({ event, records }) => {
            // @ts-expect-error — through the envelope, at depth two
            event.records[0]!.id = 'forged';

            // @ts-expect-error — through the validated records, into a payload
            records[0]!.payload.clickId = 'rewritten';

            return { successes: records };
          },
        };
        expect(typeof declared.invoke).toEqual('function');
      });
    });
  });

  /**
   * .why = a kinesis record has no `headers` slot, so a schema that declares one refuses every
   *        record at run time and the shard advances past each. the contract makes it a compile error
   */
  given('[case17] a schema that declares headers', () => {
    when('[t0] it is handed to the contract', () => {
      then('it fails to compile, while a payload-only schema fits', () => {
        const declared: ForKinesisPerBatchInput<PayloadDeclared> = {
          // @ts-expect-error — a kinesis record carries no metadata bag
          schema: { input: SCHEMA_CLICK.extend({ headers: z.object({}) }) },
          invoke: async ({ records }) => ({ successes: records }),
        };
        const strict: ForKinesisPerBatchInput<PayloadDeclared> = {
          schema: { input: SCHEMA_CLICK.strict() },
          invoke: async ({ records }) => ({ successes: records }),
        };
        expect([declared, strict]).toHaveLength(2);
      });
    });
  });

  given('[case14] a text stream, with deserialize off', () => {
    const seen: unknown[] = []; // .note = deliberate mutation in a const box: invoke has no return path
    const handler = perBatch({
      schema: { input: z.object({ payload: z.string() }) },
      deserialize: { payload: false },
      invoke: async ({ records }) => {
        seen.push(...records.map((record) => record.payload));
        return { successes: records };
      },
    });

    when('[t0] a record shaped as json arrives', () => {
      then('payload is the decoded utf8 text, unparsed', async () => {
        await runLambdaEndpoint.onReferenced({
          handler,
          event: asLambdaEvent.fromKinesis({ records: ['{"a":1}'] }),
        });
        expect(seen).toEqual(['{"a":1}']);
      });
    });
  });

  given('[case15] an event that is not from kinesis', () => {
    const handler = perBatch({
      schema: { input: SCHEMA_CLICK },
      invoke: async ({ records }) => ({ successes: records }),
    });

    when('[t0] an sns event is misrouted to it', () => {
      then('it fails loud: the wire is not a kinesis shape', async () => {
        const error = await getError(
          runLambdaEndpoint.onReferenced({
            // .as = a deliberate misroute: the declared input forbids this event, so only a cast sends it
            handler: handler as unknown as Parameters<
              typeof runLambdaEndpoint.onReferenced
            >[0]['handler'],
            event: asLambdaEvent.fromSns({ messages: ['{}'] }),
          }),
        );
        expect(error.message).toContain('wire is not a kinesis event shape');
        expect(
          error.message
            .replace(/beefbeef[0-9a-f-]{28}/g, '<uuid>')
            .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<timestamp>'),
        ).toMatchSnapshot();
      });
    });
  });
});
