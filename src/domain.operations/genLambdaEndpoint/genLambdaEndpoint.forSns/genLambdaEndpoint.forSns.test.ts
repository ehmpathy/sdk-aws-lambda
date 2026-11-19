import type { SNSEvent } from 'aws-lambda';
import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { getError, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { asLambdaEvent } from '../../asLambdaEvent/asLambdaEvent';
import { runLambdaEndpoint } from '../../runLambdaEndpoint/runLambdaEndpoint';
import type { ForSnsInput } from './genLambdaEndpoint.forSns';
import { forSns } from './genLambdaEndpoint.forSns';

type HeadersDeclared = { Origin?: string };
type PayloadDeclared = { notificationType: string };

/**
 * .what = the bag and context `invoke` receives, derived from the contract rather than restated
 */
type InvokeInput = Parameters<
  ForSnsInput<HeadersDeclared, PayloadDeclared>['invoke']
>[0];
type InvokeContext = Parameters<
  ForSnsInput<HeadersDeclared, PayloadDeclared>['invoke']
>[1];

const SCHEMA_NOTICE = z.object({
  headers: z.object({ Origin: z.string().optional() }),
  payload: z.object({ notificationType: z.enum(['Bounce', 'Delivery']) }),
});

/**
 * .what = one sns event of one message, whose attributes differ only by case
 * .why = sns attribute names are case-sensitive, so the flatten must keep both
 */
const genSnsEventWithAttributes = (input: { message: string }): SNSEvent => {
  const event = asLambdaEvent.fromSns({ messages: [input.message] });
  return {
    Records: event.Records.map((record) => ({
      ...record,
      Sns: {
        ...record.Sns,
        MessageAttributes: {
          Origin: { Type: 'String', Value: 'ses' },
          origin: { Type: 'String', Value: 'kept apart' },
        },
      },
    })),
  };
};

/**
 * .what = runs a handler the way a deployed sns trigger does, and reads the warn lines it left
 * .why = an acknowledged refusal is a successful invoke, so the warn line is its only trace
 * .note = a spy, never a mock: the real line still prints
 */
const getSnsOutcome = async (input: {
  handler: ReturnType<typeof forSns>;
  event: SNSEvent;
  trail?: { exid: string };
}): Promise<{ error: Error | null; warnLines: string[] }> => {
  const spy = jest.spyOn(console, 'warn');
  try {
    const error = await runLambdaEndpoint
      .onReferenced({
        handler: input.handler,
        event: input.event,
        trail: input.trail,
      })
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

describe('genLambdaEndpoint.forSns', () => {
  given('[case1] a valid notice', () => {
    const seen: { input: InvokeInput; context: InvokeContext }[] = []; // .note = deliberate mutation in a const box: invoke has no return path
    const handler = forSns({
      schema: { input: SCHEMA_NOTICE },
      invoke: async (input, context) => {
        seen.push({ input, context });
      },
    });
    const event = genSnsEventWithAttributes({
      message: JSON.stringify({ notificationType: 'Bounce' }),
    });

    when('[t0] aws delivers it', () => {
      const outcome = useThen('the invoke succeeds', async () =>
        getSnsOutcome({ handler, event, trail: { exid: 'exid:producer' } }),
      );

      then('the invoke resolves, so lambda acknowledges it', () => {
        expect(outcome.error).toEqual(null);
      });

      then('invoke receives the decoded, validated payload', () => {
        expect(seen[0]?.input.payload).toEqual({ notificationType: 'Bounce' });

        // the whole input bag, with the fixture's minted uuids and its clock masked
        expect(
          JSON.parse(
            JSON.stringify(seen[0]?.input)
              .replace(/beefbeef[0-9a-f-]{28}/g, '<uuid>')
              .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<timestamp>'),
          ),
        ).toMatchSnapshot();
      });

      then('headers are the flattened attributes, keys verbatim', () => {
        expect(seen[0]?.input.headers).toEqual({
          Origin: 'ses',
          origin: 'kept apart',
        });
      });

      then('payload and headers are projections of the one record', () => {
        expect(seen[0]?.input.payload).toBe(
          seen[0]?.input.event.records[0]?.payload,
        );
        expect(seen[0]?.input.headers).toBe(
          seen[0]?.input.event.records[0]?.headers,
        );
      });

      then(
        'the record id is the MessageId, and the raw record rides along',
        () => {
          expect(seen[0]?.input.event.records[0]?.id).toEqual(
            event.Records[0]!.Sns.MessageId,
          );
          expect(seen[0]?.input.event.records[0]?._.raw.Sns.TopicArn).toEqual(
            event.Records[0]!.Sns.TopicArn,
          );
        },
      );

      then('the envelope is frozen', () => {
        expect(Object.isFrozen(seen[0]?.input.event)).toEqual(true);
        expect(Object.isFrozen(seen[0]?.input.payload)).toEqual(true);
      });

      /**
       * .what = the `none` carrier, observed end to end
       * .why = the runner frames no wrapper for a handler stamped `none`, so the handler reads the
       *        sns event as aws sends it, and mints its own trail
       *        (`invariant.ancient-vs-contemp-callers.md`)
       */
      then('a fresh exid is minted; no caller trail is read', () => {
        expect(seen[0]?.context.log.trail?.exid).toMatch(/^exid:/);
        expect(seen[0]?.context.log.trail?.exid).not.toEqual('exid:producer');
      });

      then('no refusal line is logged', () => {
        expect(
          outcome.warnLines.filter((line) =>
            line.includes('sns.record.refused'),
          ),
        ).toEqual([]);
      });
    });
  });

  given('[case2] a notice the schema refuses', () => {
    const calls: unknown[] = []; // .note = deliberate mutation in a const box: invoke has no return path
    const handler = forSns({
      schema: { input: SCHEMA_NOTICE },
      invoke: async (input) => {
        calls.push(input);
      },
    });
    const event = asLambdaEvent.fromSns({
      messages: [JSON.stringify({ notificationType: 'Delay' })],
    });

    when('[t0] aws delivers it', () => {
      const outcome = useThen('the invoke succeeds', async () =>
        getSnsOutcome({ handler, event }),
      );

      then('the invoke resolves, so lambda does not retry it', () => {
        expect(outcome.error).toEqual(null);
      });

      then('the handler never runs', () => {
        expect(calls).toEqual([]);
      });

      then(
        'one warn line names the message id, the class, and the raw message',
        () => {
          const lines = outcome.warnLines.filter((line) =>
            line.includes('sns.record.refused'),
          );
          expect(lines).toHaveLength(1);
          expect(lines[0]).toContain(event.Records[0]!.Sns.MessageId);
          expect(lines[0]).toContain('ConstraintError');
          expect(lines[0]).toContain('payload.notificationType');
          expect(lines[0]).toContain(event.Records[0]!.Sns.TopicArn);
        },
      );
    });
  });

  given('[case3] a handler that throws a caller fault', () => {
    const handler = forSns({
      schema: { input: SCHEMA_NOTICE },
      invoke: async () => {
        throw new ConstraintError('notice is for a closed account');
      },
    });

    when('[t0] aws delivers a valid notice', () => {
      const outcome = useThen('the invoke succeeds', async () =>
        getSnsOutcome({
          handler,
          event: asLambdaEvent.fromSns({
            messages: [JSON.stringify({ notificationType: 'Bounce' })],
          }),
        }),
      );

      then('it is acknowledged, with a warn line', () => {
        expect(outcome.error).toEqual(null);
        const line = outcome.warnLines.find((each) =>
          each.includes('sns.record.refused'),
        );
        expect(line).toContain('ConstraintError');
        expect(line).toContain('notice is for a closed account');
      });
    });
  });

  given('[case4] a handler that throws a server fault', () => {
    const handler = forSns({
      schema: { input: SCHEMA_NOTICE },
      invoke: async () => {
        throw new MalfunctionError('the mail store is down');
      },
    });

    when('[t0] aws delivers a valid notice', () => {
      const outcome = useThen('the invoke fails', async () =>
        getSnsOutcome({
          handler,
          event: asLambdaEvent.fromSns({
            messages: [JSON.stringify({ notificationType: 'Bounce' })],
          }),
        }),
      );

      then('the throw escapes, so lambda retries it', () => {
        expect(outcome.error?.message).toContain('the mail store is down');
      });

      then('no refusal line is logged — it was not acknowledged', () => {
        expect(
          outcome.warnLines.filter((line) =>
            line.includes('sns.record.refused'),
          ),
        ).toEqual([]);
      });
    });
  });

  given('[case5] an invoke of other than one message', () => {
    const handler = forSns({
      schema: { input: SCHEMA_NOTICE },
      invoke: async () => undefined,
    });

    when('[t0] two messages arrive', () => {
      then('it fails loud, and names the fix', async () => {
        const error = await getError(
          runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromSns({ messages: ['{}', '{}'] }),
          }),
        );
        expect(error.message).toContain(
          'forSns received a batch of other than one message',
        );
        expect(error.message).toContain('sns delivers one message per invoke');

        // the whole text a developer meets, with the fixture's minted uuids masked
        expect(
          error.message.replace(/beefbeef[0-9a-f-]{28}/g, '<uuid>'),
        ).toMatchSnapshot();
      });
    });

    /**
     * .what = the count-zero edge of the same rule
     * .why = `getIsSnsEvent` admits `{ Records: [] }` as sns and leaves the count to this
     *        variant, so the refusal must fire here, with the fix, as its kinesis twin does
     */
    when('[t1] an empty batch arrives', () => {
      then('it fails loud too: the count is not one', async () => {
        const error = await getError(
          runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromSns({ messages: [] }),
          }),
        );
        expect(error.message).toContain(
          'forSns received a batch of other than one message',
        );
        expect(error.message).toMatchSnapshot();
      });
    });
  });

  given('[case6] a text topic, with deserialize off', () => {
    const seen: unknown[] = []; // .note = deliberate mutation in a const box: invoke has no return path
    const handler = forSns({
      schema: { input: z.object({ payload: z.string() }) },
      deserialize: { payload: false },
      invoke: async ({ payload }) => {
        seen.push(payload);
      },
    });

    when('[t0] a message shaped as json arrives', () => {
      then('payload is the raw string, unparsed', async () => {
        await runLambdaEndpoint.onReferenced({
          handler,
          event: asLambdaEvent.fromSns({ messages: ['{"a":1}'] }),
        });
        expect(seen).toEqual(['{"a":1}']);
      });
    });
  });

  given('[case7] an event that is not from sns', () => {
    const handler = forSns({
      schema: { input: SCHEMA_NOTICE },
      invoke: async () => undefined,
    });

    when('[t0] an sqs event is misrouted to it', () => {
      then('it fails loud: the wire is not an sns shape', async () => {
        const error = await getError(
          runLambdaEndpoint.onReferenced({
            // .as = a deliberate misroute: the declared input forbids this event, so only a cast sends it
            handler: handler as unknown as Parameters<
              typeof runLambdaEndpoint.onReferenced
            >[0]['handler'],
            event: asLambdaEvent.fromSqs({ messages: ['{}'] }),
          }),
        );
        expect(error.message).toContain('wire is not an sns event shape');
        expect(
          error.message.replace(/beefbeef[0-9a-f-]{28}/g, '<uuid>'),
        ).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the text-topic footgun: a text topic left on the json default
   * .why = a non-json message reaches the schema as its string, so the zod issue alone names no
   *        move. the refusal must name the fix
   */
  given('[case8] a text message on the json default', () => {
    const handler = forSns({
      schema: { input: SCHEMA_NOTICE },
      invoke: async () => undefined,
    });

    when('[t0] aws delivers it', () => {
      const outcome = useThen('the invoke succeeds', async () =>
        getSnsOutcome({
          handler,
          event: asLambdaEvent.fromSns({ messages: ['your mail bounced'] }),
        }),
      );

      then('it is refused and acknowledged, as a caller fault', () => {
        expect(outcome.error).toEqual(null);
      });

      then('the refusal line names the `deserialize` fix', () => {
        const lines = outcome.warnLines.filter((line) =>
          line.includes('sns.record.refused'),
        );
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('deserialize: { payload: false }');
      });
    });
  });

  /**
   * .what = the freeze this variant owes, at depth and at compile time
   * .why = `[case1]` reads `Object.isFrozen` at the top, which a shallow freeze would pass. a write
   *        one level in proves the freeze is deep; the `@ts-expect-error` arms prove the contract
   *        states it (`rule.require.frozen-invoke-inputs`)
   */
  given('[case9] a handler that writes to what it was handed', () => {
    when('[t0] it writes into the payload, one level in', () => {
      then('the write is refused at run time', async () => {
        const handler = forSns({
          schema: { input: SCHEMA_NOTICE },
          invoke: async ({ payload }) => {
            (payload as { notificationType: string }).notificationType =
              'rewritten';
          },
        });
        const error = await getError(
          runLambdaEndpoint.onReferenced({
            handler,
            event: asLambdaEvent.fromSns({
              messages: [JSON.stringify({ notificationType: 'Bounce' })],
            }),
          }),
        );
        expect(error.message).toContain('read only property');
      });
    });

    when('[t1] the write is a compile error too', () => {
      then('the contract types the guarantee on every slot', () => {
        const declared: ForSnsInput<HeadersDeclared, PayloadDeclared> = {
          schema: { input: SCHEMA_NOTICE },
          invoke: async ({ event, payload, headers }) => {
            // @ts-expect-error — through the envelope, at depth two
            event.records[0]!.id = 'forged';

            // @ts-expect-error — through the lifted payload
            payload.notificationType = 'rewritten';

            // @ts-expect-error — and its peer bag
            headers.Origin = 'forged';
          },
        };
        expect(typeof declared.invoke).toEqual('function');
      });
    });
  });
});
