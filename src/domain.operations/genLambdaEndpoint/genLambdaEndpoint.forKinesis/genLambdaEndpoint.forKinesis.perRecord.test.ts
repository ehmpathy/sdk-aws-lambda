import type { KinesisStreamEvent } from 'aws-lambda';
import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { getError, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { asLambdaEvent } from '../../asLambdaEvent/asLambdaEvent';
import { runLambdaEndpoint } from '../../runLambdaEndpoint/runLambdaEndpoint';
import type { ForKinesisPerRecordInput } from './genLambdaEndpoint.forKinesis.perRecord';
import { perRecord } from './genLambdaEndpoint.forKinesis.perRecord';

type PayloadDeclared = { clickId: string };

/**
 * .what = the bag and context `invoke` receives, derived from the contract rather than restated
 */
type InvokeInput = Parameters<
  ForKinesisPerRecordInput<PayloadDeclared>['invoke']
>[0];
type InvokeContext = Parameters<
  ForKinesisPerRecordInput<PayloadDeclared>['invoke']
>[1];

const SCHEMA_CLICK = z.object({
  payload: z.object({ clickId: z.string() }),
});

/**
 * .what = runs a handler the way a deployed kinesis trigger does, and reads the warn lines it left
 * .why = an acknowledged refusal is a successful invoke, so the warn line is its only trace
 * .note = a spy, never a mock: the real line still prints
 */
const getKinesisOutcome = async (input: {
  handler: ReturnType<typeof perRecord>;
  event: KinesisStreamEvent;
}): Promise<{ error: Error | null; warnLines: string[] }> => {
  const spy = jest.spyOn(console, 'warn');
  try {
    const error = await runLambdaEndpoint
      .onReferenced({ handler: input.handler, event: input.event })
      .then(() => null)
      .catch((caught: Error) => caught);
    const warnLines = spy.mock.calls.map((args) =>
      args.map((arg) => JSON.stringify(arg)).join(' '),
    );
    return { error, warnLines };
  } finally {
    spy.mockRestore();
  }
};

describe('genLambdaEndpoint.forKinesis.perRecord', () => {
  given('[case3] a valid click', () => {
    const seen: { input: InvokeInput; context: InvokeContext }[] = []; // .note = deliberate mutation in a const box: invoke has no return path
    const handler = perRecord({
      schema: { input: SCHEMA_CLICK },
      invoke: async (input, context) => {
        seen.push({ input, context });
      },
    });
    const event = asLambdaEvent.fromKinesis({
      records: [JSON.stringify({ clickId: 'c-1' })],
    });

    when('[t0] aws delivers it', () => {
      const outcome = useThen('the invoke succeeds', async () =>
        getKinesisOutcome({ handler, event }),
      );

      then('the invoke resolves, so the shard advances', () => {
        expect(outcome.error).toEqual(null);
      });

      then(
        'invoke receives the base64-decoded, parsed, validated payload',
        () => {
          expect(seen[0]?.input.payload).toEqual({ clickId: 'c-1' });

          // the whole slot the handler is handed; the kinesis factory mints no volatile value
          expect(seen[0]?.input).toMatchSnapshot();
        },
      );

      then('payload is a projection of the one record', () => {
        expect(seen[0]?.input.payload).toBe(
          seen[0]?.input.event.records[0]?.payload,
        );
      });

      then('no headers slot is handed over — a kinesis record has none', () => {
        expect('headers' in seen[0]!.input).toEqual(false);
        expect('headers' in seen[0]!.input.event.records[0]!).toEqual(false);
      });

      then(
        'the record id is the sequence number, and the raw record rides along',
        () => {
          expect(seen[0]?.input.event.records[0]?.id).toEqual(
            event.Records[0]!.kinesis.sequenceNumber,
          );
          expect(
            seen[0]?.input.event.records[0]?._.raw.kinesis.partitionKey,
          ).toEqual(event.Records[0]!.kinesis.partitionKey);
        },
      );

      then('the envelope is frozen', () => {
        expect(Object.isFrozen(seen[0]?.input.event)).toEqual(true);
        expect(Object.isFrozen(seen[0]?.input.payload)).toEqual(true);
      });

      then('a fresh exid is minted; no caller trail is read', () => {
        expect(seen[0]?.context.log.trail?.exid).toMatch(/^exid:/);
      });
    });
  });

  given('[case4] an invoke of other than one record', () => {
    const handler = perRecord({
      schema: { input: SCHEMA_CLICK },
      invoke: async () => undefined,
    });

    when('[t0] two records arrive, as under batchSize 10', () => {
      then('it fails loud, and names the fix', async () => {
        const error = await getError(
          runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromKinesis({ records: ['{}', '{}'] }),
          }),
        );
        expect(error.message).toContain(
          'forKinesis.perRecord received a batch of other than one record',
        );
        expect(error.message).toContain('batchSize');
        expect(error.message).toContain(
          'genLambdaEndpoint.forKinesis.perBatch',
        );

        // the whole text a developer meets; kinesis fixture ids are derived, so none is masked
        expect(error.message).toMatchSnapshot();
      });
    });

    when('[t1] an empty batch arrives', () => {
      then('it fails loud too: the count is not one', async () => {
        const error = await getError(
          runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromKinesis({ records: [] }),
          }),
        );
        expect(error.message).toContain('batch of other than one record');
        expect(error.message).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the text-stream footgun: a text stream left on the json default
   * .why = a non-json record reaches the schema as its string, so the zod issue alone reads
   *        "expected object, received string" and names no move. the refusal must name the fix
   */
  given('[case5] a text record on the json default', () => {
    const handler = perRecord({
      schema: { input: SCHEMA_CLICK },
      invoke: async () => undefined,
    });
    const event = asLambdaEvent.fromKinesis({ records: ['hello world'] });

    when('[t0] aws delivers it', () => {
      const outcome = useThen('the invoke succeeds', async () =>
        getKinesisOutcome({ handler, event }),
      );

      then('it is refused and acknowledged, as a caller fault', () => {
        expect(outcome.error).toEqual(null);
      });

      then('the refusal line names the `deserialize` fix', () => {
        const lines = outcome.warnLines.filter((line) =>
          line.includes('kinesis.record.refused'),
        );
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('deserialize: { payload: false }');
      });
    });
  });

  /**
   * .what = the freeze this variant owes, at depth and at compile time
   * .why = `[case3]` reads `Object.isFrozen` at the top, which a shallow freeze would pass
   *        (`rule.require.frozen-invoke-inputs`)
   */
  given('[case6] a handler that writes to what it was handed', () => {
    when('[t0] it writes into the payload, one level in', () => {
      then('the write is refused at run time', async () => {
        const handler = perRecord({
          schema: { input: SCHEMA_CLICK },
          invoke: async ({ payload }) => {
            (payload as { clickId: string }).clickId = 'rewritten';
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
        const declared: ForKinesisPerRecordInput<PayloadDeclared> = {
          schema: { input: SCHEMA_CLICK },
          invoke: async ({ event, payload }) => {
            // @ts-expect-error — through the envelope, at depth two
            event.records[0]!.id = 'forged';

            // @ts-expect-error — through the lifted payload
            payload.clickId = 'rewritten';
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
  given('[case7] a schema that declares headers', () => {
    when('[t0] it is handed to the contract', () => {
      then('it fails to compile, while a payload-only schema fits', () => {
        const declared: ForKinesisPerRecordInput<PayloadDeclared> = {
          // @ts-expect-error — a kinesis record carries no metadata bag
          schema: { input: SCHEMA_CLICK.extend({ headers: z.object({}) }) },
          invoke: async () => {},
        };
        const strict: ForKinesisPerRecordInput<PayloadDeclared> = {
          schema: { input: SCHEMA_CLICK.strict() },
          invoke: async () => {},
        };
        expect([declared, strict]).toHaveLength(2);
      });
    });
  });

  given('[case13] a record the schema refuses, then a handler fault', () => {
    when('[t0] a malformed click arrives', () => {
      const calls: unknown[] = []; // .note = deliberate mutation in a const box: invoke has no return path
      const handler = perRecord({
        schema: { input: SCHEMA_CLICK },
        invoke: async (input) => {
          calls.push(input);
        },
      });
      const event = asLambdaEvent.fromKinesis({
        records: [JSON.stringify({ wrong: 'shape' })],
      });
      const outcome = useThen('the invoke succeeds', async () =>
        getKinesisOutcome({ handler, event }),
      );

      then('the invoke resolves, so the shard does not block on it', () => {
        expect(outcome.error).toEqual(null);
        expect(calls).toEqual([]);
      });

      then(
        'one warn line names the record, the class, and the raw record',
        () => {
          const lines = outcome.warnLines.filter((line) =>
            line.includes('kinesis.record.refused'),
          );
          expect(lines).toHaveLength(1);
          expect(lines[0]).toContain(event.Records[0]!.kinesis.sequenceNumber);
          expect(lines[0]).toContain('ConstraintError');
          expect(lines[0]).toContain(event.Records[0]!.eventID);
        },
      );
    });

    when('[t1] the handler throws a caller fault', () => {
      const handler = perRecord({
        schema: { input: SCHEMA_CLICK },
        invoke: async () => {
          throw new ConstraintError('click is from a banned caller');
        },
      });
      const outcome = useThen('the invoke succeeds', async () =>
        getKinesisOutcome({
          handler,
          event: asLambdaEvent.fromKinesis({
            records: [JSON.stringify({ clickId: 'c-1' })],
          }),
        }),
      );

      then('it is acknowledged, with a warn line', () => {
        expect(outcome.error).toEqual(null);
        const line = outcome.warnLines.find((each) =>
          each.includes('kinesis.record.refused'),
        );
        expect(line).toContain('click is from a banned caller');
      });
    });

    when('[t2] the handler throws a server fault', () => {
      const handler = perRecord({
        schema: { input: SCHEMA_CLICK },
        invoke: async () => {
          throw new MalfunctionError('the click store is down');
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

      then('the throw escapes, so the shard retries the record', () => {
        expect(outcome.error?.message).toContain('the click store is down');
      });

      then('no refusal line is logged — it was not acknowledged', () => {
        expect(
          outcome.warnLines.filter((line) =>
            line.includes('kinesis.record.refused'),
          ),
        ).toEqual([]);
      });
    });
  });
});
