import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { getError, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { asSqsEvent } from '../../../__test_assets__/asSqsEvent';
import { runLambdaEndpoint } from '../../runLambdaEndpoint/runLambdaEndpoint';
import type { ForSqsPerBatchInput } from './genLambdaEndpoint.forSqs.perBatch';
import { perBatch } from './genLambdaEndpoint.forSqs.perBatch';

// mirrors `SCHEMA_ORDER` below; the header is optional there, so it is optional here
type HeadersDeclared = { OrderSource?: string };
type PayloadDeclared = { orderId: string };

// the bags `invoke` receives, derived from the contract so they cannot drift from it
type InvokeInput = Parameters<
  ForSqsPerBatchInput<HeadersDeclared, PayloadDeclared>['invoke']
>[0];
type InvokeContext = Parameters<
  ForSqsPerBatchInput<HeadersDeclared, PayloadDeclared>['invoke']
>[1];

// the per-record pair; `.optional()` inside the header object, never on it (`headers.md`)
const SCHEMA_ORDER = z.object({
  headers: z.object({ OrderSource: z.string().optional() }),
  payload: z.object({ orderId: z.string() }),
});

const asMessageValid = (orderId: string) => ({
  body: JSON.stringify({ orderId }),
  headers: { OrderSource: 'web' },
});

// a body the SCHEMA refuses — never a json parse defect
const MESSAGE_INVALID = { body: JSON.stringify({ orderId: 404 }) };

// reads the named metadata off a thrown HelpfulError
const asMetadata = (error: Error): Record<string, unknown> =>
  (error as { metadata?: Record<string, unknown> }).metadata ?? {};

// runs a handler that should refuse, and captures any answer it produced instead
const getRefusal = async (
  handler: ReturnType<typeof perBatch>,
  messages: { body: string; headers?: Record<string, string> }[],
) => {
  const answers: unknown[] = [];
  const error = await getError(async () => {
    answers.push(
      await runLambdaEndpoint.onReferenced({
        handler,
        struct: { payload: 'ancient' },
        event: asSqsEvent({ messages }),
      }),
    );
  });
  return { message: error.message, metadata: asMetadata(error), answers };
};

describe('genLambdaEndpoint.forSqs.perBatch', () => {
  given('[case1] a batch where every message is valid', () => {
    when('[t0] the handler reports every record as a success', () => {
      const outcome = useThen('it answers sqs', async () => {
        const captured: { input: InvokeInput; context: InvokeContext }[] = [];
        const handler = perBatch({
          schema: { input: SCHEMA_ORDER },
          invoke: async (input, context) => {
            captured.push({ input, context });
            return { successes: input.records };
          },
        });
        const response = await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({
            messages: [asMessageValid('ord-1'), asMessageValid('ord-2')],
          }),
        });
        const call =
          captured[0] ??
          MalfunctionError.throw('invoke never ran', { captured });
        return { response, seen: call.input, context: call.context };
      });

      then('every message reaches the handler', () => {
        expect(outcome.seen.records.map((record) => record.payload)).toEqual([
          { orderId: 'ord-1' },
          { orderId: 'ord-2' },
        ]);
      });

      then('each record IS its envelope peer — a filter, never a copy', () => {
        expect(outcome.seen.records[0]).toBe(outcome.seen.event.records[0]);
        expect(outcome.seen.records[1]).toBe(outcome.seen.event.records[1]);
      });

      then(
        'no message is reported as a failure, so sqs deletes them all',
        () => {
          expect(outcome.response).toEqual({ batchItemFailures: [] });
        },
      );

      then('the lineage rides `context.log.trail`, one per invoke', () => {
        expect(outcome.context.log.trail).toMatchObject({
          exid: expect.any(String),
        });
      });

      then('the input bag carries no `trail` key', () => {
        expect(Object.keys(outcome.seen).sort()).toEqual(['event', 'records']);
      });
    });
  });

  given('[case2] a batch where ONE message fails the schema', () => {
    when('[t0] the handler reports every record it was handed', () => {
      const outcome = useThen('it answers sqs', async () => {
        const captured: InvokeInput[] = [];
        const handler = perBatch({
          schema: { input: SCHEMA_ORDER },
          invoke: async (input) => {
            captured.push(input);
            return { successes: input.records };
          },
        });
        const response = await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({
            messages: [
              asMessageValid('ord-0'),
              MESSAGE_INVALID,
              asMessageValid('ord-2'),
            ],
          }),
        });
        const seen =
          captured[0] ??
          MalfunctionError.throw('invoke never ran', { captured });
        return {
          response,
          payloads: seen.records.map((record) => record.payload),
          envelopeSize: seen.event.records.length,
        };
      });

      then('the refused message never reaches the handler', () => {
        expect(outcome.payloads).toEqual([
          { orderId: 'ord-0' },
          { orderId: 'ord-2' },
        ]);
      });

      then('the envelope still carries every message that arrived', () => {
        expect(outcome.envelopeSize).toEqual(3);
      });

      // .verdict = a schema refusal is a caller fault, so sqs deletes it (human, sdk-aws-lambda#73; F7)
      then(
        'the refused message is acknowledged, so no message is retried',
        () => {
          expect(outcome.response).toEqual({ batchItemFailures: [] });
        },
      );
    });
  });

  given(
    '[case3] one message refused, one the handler could not process',
    () => {
      when('[t0] the handler reports only the record it processed', () => {
        const response = useThen('it answers sqs', async () => {
          const handler = perBatch({
            schema: { input: SCHEMA_ORDER },
            invoke: async (input) => ({ successes: [input.records[0]!] }),
          });
          return await runLambdaEndpoint.onReferenced({
            handler,
            struct: { payload: 'ancient' },
            event: asSqsEvent({
              messages: [
                asMessageValid('ord-0'),
                MESSAGE_INVALID,
                asMessageValid('ord-2'),
              ],
            }),
          });
        });

        // .verdict = a schema refusal is a caller fault, so sqs deletes it (human, sdk-aws-lambda#73; F7)
        then(
          'the unreported record alone is retried — the refused one is acknowledged',
          () => {
            expect(response).toEqual({
              batchItemFailures: [{ itemIdentifier: 'msg-2' }],
            });
          },
        );
      });
    },
  );

  /**
   * .what = the fail-safe guarantee: a record nobody vouches for is retried, never deleted
   */
  given('[case4] a handler that forgets to report its records', () => {
    when('[t0] it answers with no successes', () => {
      const response = useThen('it answers sqs', async () => {
        const handler = perBatch({
          schema: { input: SCHEMA_ORDER },
          invoke: async () => ({ successes: [] }),
        });
        return await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({
            messages: [asMessageValid('ord-0'), asMessageValid('ord-1')],
          }),
        });
      });

      then('every record is retried', () => {
        expect(response).toEqual({
          batchItemFailures: [
            { itemIdentifier: 'msg-0' },
            { itemIdentifier: 'msg-1' },
          ],
        });
      });
    });
  });

  given('[case5] a batch where EVERY message fails the schema', () => {
    when('[t0] the handler runs', () => {
      const outcome = useThen('it answers sqs', async () => {
        const captured: InvokeInput[] = [];
        const handler = perBatch({
          schema: { input: SCHEMA_ORDER },
          invoke: async (input) => {
            captured.push(input);
            return { successes: input.records };
          },
        });
        const response = await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({ messages: [MESSAGE_INVALID, MESSAGE_INVALID] }),
        });
        const seen =
          captured[0] ??
          MalfunctionError.throw('invoke never ran', { captured });
        return { response, recordsSeen: seen.records };
      });

      then('the handler still runs, on an empty record list', () => {
        expect(outcome.recordsSeen).toEqual([]);
      });

      // .verdict = a schema refusal is a caller fault, so sqs deletes it (human, sdk-aws-lambda#73; F7)
      then('every id is acknowledged, so none is retried', () => {
        expect(outcome.response).toEqual({ batchItemFailures: [] });
      });
    });
  });

  given('[case6] an empty batch', () => {
    when('[t0] the handler runs', () => {
      const response = useThen('it answers sqs', async () => {
        const handler = perBatch({
          schema: { input: SCHEMA_ORDER },
          invoke: async () => ({ successes: [] }),
        });
        return await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({ messages: [] }),
        });
      });

      then('it answers with no failures rather than throw', () => {
        expect(response).toEqual({ batchItemFailures: [] });
      });
    });
  });

  /**
   * .what = a throw escapes, so sqs retries the whole batch
   * .why = a partial answer would name no success for the records the handler never reached;
   *        the escape is the same verdict, reached louder
   */
  given('[case7] a handler that throws mid-batch', () => {
    when('[t0] a batch of three arrives and the handler fails', () => {
      const outcome = useThen('the invocation is refused', async () => {
        const reached: string[] = [];
        const handler = perBatch({
          schema: { input: SCHEMA_ORDER },
          invoke: async (input) => {
            reached.push(input.records[0]!.payload.orderId);
            throw new Error('the downstream warehouse api is down');
          },
        });
        const refusal = await getRefusal(handler, [
          asMessageValid('ord-0'),
          asMessageValid('ord-1'),
          asMessageValid('ord-2'),
        ]);
        return { ...refusal, processed: reached.length };
      });

      then('the handler ran before it failed', () => {
        expect(outcome.processed).toEqual(1);
      });

      then('the throw escapes, so all three are retried', () => {
        expect(outcome.answers).toEqual([]);
        expect(outcome.message).toContain(
          'the downstream warehouse api is down',
        );
      });
    });

    /**
     * .what = a ConstraintError the handler throws is forwarded too, never acknowledged
     * .why = 🔴 the throw names no record, and the handler may have served some before it threw.
     *        to acknowledge the batch would delete records of unknown outcome, so the batch
     *        redrives. a handler that refuses one record acknowledges it by name, in `successes`.
     *        (fulcrum F8)
     */
    when('[t1] the handler throws a ConstraintError mid-batch', () => {
      const outcome = useThen('the invocation is refused', async () =>
        getRefusal(
          perBatch({
            schema: { input: SCHEMA_ORDER },
            invoke: async () => {
              throw new ConstraintError('the batch holds a withdrawn order');
            },
          }),
          [asMessageValid('ord-0'), asMessageValid('ord-1')],
        ),
      );

      then('the throw escapes unchanged, so the whole batch redrives', () => {
        expect(outcome.answers).toEqual([]);
        expect(outcome.message).toContain('the batch holds a withdrawn order');
      });
    });

    /**
     * .what = a refused record shares the batch with a handler that throws
     * .why = the refusal is acknowledged only by a successful invoke. a throw fails the invoke,
     *        so the refused record redrives with its batch — the log line's consequence says
     *        "only if this invoke succeeds" for exactly this case
     */
    when('[t2] one message is refused and the handler then throws', () => {
      const outcome = useThen('the invocation is refused', async () => {
        // a spy, never a mock: the real line still prints, and the test reads what it was handed
        const spy = jest.spyOn(console, 'warn');
        const asLines = (): string[] =>
          spy.mock.calls.map((args) =>
            args.map((arg) => JSON.stringify(arg)).join(' '),
          );
        try {
          const refusal = await getRefusal(
            perBatch({
              schema: { input: SCHEMA_ORDER },
              invoke: async () => {
                throw new MalfunctionError(
                  'the downstream warehouse api is down',
                );
              },
            }),
            [asMessageValid('ord-0'), MESSAGE_INVALID],
          );
          return { ...refusal, warned: asLines().join('\n') };
        } finally {
          spy.mockRestore();
        }
      });

      then('the refusal is still logged, with its conditional fate', () => {
        expect(outcome.warned).toContain('sqs.record.refused');
        expect(outcome.warned).toContain('only if this invoke succeeds');
      });

      then('the throw escapes, so the refused record redrives too', () => {
        expect(outcome.answers).toEqual([]);
        expect(outcome.message).toContain(
          'the downstream warehouse api is down',
        );
      });
    });
  });

  given('[case8] `deserialize.payload = false`, across a batch', () => {
    when('[t0] two raw-bytes messages arrive', () => {
      const seen = useThen('invoke receives the raw strings', async () => {
        const payloads: string[] = [];
        const handler = perBatch({
          schema: { input: z.object({ payload: z.string() }) },
          invoke: async (input) => {
            for (const record of input.records) payloads.push(record.payload);
            return { successes: input.records };
          },
          deserialize: { payload: false },
        });
        await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({
            messages: [{ body: 'raw-signed-0' }, { body: 'raw-signed-1' }],
          }),
        });
        return { payloads };
      });

      then('every body is the string, unparsed, in arrival order', () => {
        expect(seen.payloads).toEqual(['raw-signed-0', 'raw-signed-1']);
      });
    });
  });

  /**
   * .what = a claim on a record the handler was not handed is refused, and the refusal retries
   *         the whole batch — a success sqs cannot trust is no success at all
   */
  given('[case9] a handler that claims a success it was not handed', () => {
    when('[t0] the id is not in the batch', () => {
      const caught = useThen('the invoke is refused', async () =>
        getRefusal(
          perBatch({
            schema: { input: SCHEMA_ORDER },
            invoke: async () => ({ successes: [{ id: 'msg-not-in-batch' }] }),
          }),
          [asMessageValid('ord-0')],
        ),
      );

      then('it throws rather than answer', () => {
        expect(caught.answers).toEqual([]);
        expect(caught.message).toContain('not handed');
      });

      then('the error names the id and the fix', () => {
        expect(caught.metadata.idsUnclaimable).toEqual(['msg-not-in-batch']);
        expect(caught.metadata.fix).toContain(
          'successes: recordsThatSucceeded',
        );
      });
    });

    when('[t1] the id is a record the schema refused', () => {
      const caught = useThen('the invoke is refused', async () =>
        getRefusal(
          perBatch({
            schema: { input: SCHEMA_ORDER },
            // `event.records` carries the refused record too — never a valid source of successes
            invoke: async (input) => ({ successes: input.event.records }),
          }),
          [asMessageValid('ord-0'), MESSAGE_INVALID],
        ),
      );

      then('it throws, so the refused record is never deleted', () => {
        expect(caught.answers).toEqual([]);
        expect(caught.metadata.idsUnclaimable).toEqual(['msg-1']);
      });
    });

    when('[t2] the id is empty', () => {
      const caught = useThen('the invoke is refused', async () =>
        getRefusal(
          perBatch({
            schema: { input: SCHEMA_ORDER },
            invoke: async () => ({ successes: [{ id: '' }] }),
          }),
          [asMessageValid('ord-0')],
        ),
      );

      then('the empty id never reaches the wire', () => {
        expect(caught.answers).toEqual([]);
        expect(caught.message).toContain('not handed');
      });
    });
  });

  given('[case10] one success reported twice', () => {
    when('[t0] the handler pushes one record into `successes` twice', () => {
      const response = useThen('it answers sqs', async () => {
        const handler = perBatch({
          schema: { input: SCHEMA_ORDER },
          invoke: async (input) => ({
            successes: [input.records[0]!, input.records[0]!],
          }),
        });
        return await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({
            messages: [asMessageValid('ord-0'), asMessageValid('ord-1')],
          }),
        });
      });

      then('the repeat is harmless, and the unreported peer is retried', () => {
        expect(response).toEqual({
          batchItemFailures: [{ itemIdentifier: 'msg-1' }],
        });
      });
    });
  });

  given(
    '[case11] a handler that answers with a malformed success entry',
    () => {
      when('[t0] the entry is a bare id string rather than a record', () => {
        const caught = useThen('the invoke is refused', async () =>
          getRefusal(
            perBatch({
              schema: { input: SCHEMA_ORDER },
              invoke: async () =>
                ({ successes: ['msg-0'] }) as unknown as {
                  successes: { id: string }[];
                },
            }),
            [asMessageValid('ord-0')],
          ),
        );

        then('it names the slot and the fix', () => {
          expect(caught.message).toContain('`id`');
          expect(caught.metadata.fix).toContain(
            'successes: recordsThatSucceeded',
          );
        });
      });

      when('[t1] the entry is null', () => {
        const caught = useThen('the invoke is refused', async () =>
          getRefusal(
            perBatch({
              schema: { input: SCHEMA_ORDER },
              invoke: async () =>
                ({ successes: [null] }) as unknown as {
                  successes: { id: string }[];
                },
            }),
            [asMessageValid('ord-0')],
          ),
        );

        then('it is a named refusal, never a raw property read', () => {
          expect(caught.message).toContain('`id`');
          expect(caught.message).not.toContain('Cannot read properties');
        });
      });
    },
  );

  given('[case12] the handler.output log, through the composed chain', () => {
    when('[t0] a valid batch runs the whole chain', () => {
      const observed = useThen('the handler answers', async () => {
        // .note = deliberate mutation in a `const` box — the hook fires inside a closure
        const seen = { calls: 0, ran: false, sawWireShape: false };
        const handler = perBatch({
          schema: { input: SCHEMA_ORDER },
          invoke: async (input) => {
            seen.ran = true;
            return { successes: input.records };
          },
          logTranslate: {
            output: (response) => {
              seen.calls += 1;
              seen.sawWireShape =
                typeof response === 'object' &&
                response !== null &&
                'batchItemFailures' in response;
              return response;
            },
          },
        });
        await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({ messages: [asMessageValid('ord-0')] }),
        });
        return seen;
      });

      then('the handler ran, and the output hook ran once', () => {
        expect(observed.ran).toEqual(true);
        expect(observed.calls).toEqual(1);
      });

      then('the hook receives the wire response an operator would read', () => {
        expect(observed.sawWireShape).toEqual(true);
      });
    });
  });

  given('[case13] a message the sdk refuses, observed at the log', () => {
    when('[t0] a batch carries one poison message', () => {
      const observed = useThen('it answers sqs', async () => {
        // a spy, never a mock: the real line still prints, and the test reads what it was handed
        const spy = jest.spyOn(console, 'warn');
        const asLines = (): string[] =>
          spy.mock.calls.map((args) =>
            args.map((arg) => JSON.stringify(arg)).join(' '),
          );
        try {
          const handler = perBatch({
            schema: { input: SCHEMA_ORDER },
            invoke: async (input) => ({ successes: input.records }),
          });
          const response = await runLambdaEndpoint.onReferenced({
            handler,
            struct: { payload: 'ancient' },
            event: asSqsEvent({
              messages: [asMessageValid('ord-0'), MESSAGE_INVALID],
            }),
          });
          return {
            response,
            entry:
              asLines().find((line) => line.includes('sqs.record.refused')) ??
              '',
          };
        } finally {
          spy.mockRestore();
        }
      });

      // .verdict = a schema refusal is a caller fault, so sqs deletes it (human, sdk-aws-lambda#73; F7)
      then('the message was acknowledged, never retried', () => {
        expect(observed.response).toEqual({ batchItemFailures: [] });
      });

      /**
       * .what = the one durable trace of an acknowledged message
       * .why = sqs deletes it, so a silent drop would be a failhide. the line is also the
       *        positive control for the absence above — the refusal was seen, not lost
       */
      then(
        'the log names which message was refused, its class, and why',
        () => {
          expect(observed.entry).toContain('msg-1');
          expect(observed.entry).toContain('ConstraintError');
          expect(observed.entry).toContain('orderId');
        },
      );

      // the operator's alarm reads the warn stream, so the level and the fate are pinned
      then('the line is emitted at warn, and names the fate', () => {
        expect(observed.entry).toContain('"level":"warn"');
        expect(observed.entry).toContain(
          'deleted only if this invoke succeeds; redriven if it fails',
        );
      });
    });
  });

  /**
   * .what = the allowlist's positive control: a schema callback that throws a server fault
   * .why = the validation catch acknowledges caller faults only. a raw throw from a schema's own
   *        `.refine()` is a defect of ours, so that record is retried alone, never deleted
   *        (`rule.forbid.failhide`)
   */
  given('[case14] a schema whose own callback throws a server fault', () => {
    when('[t0] a batch arrives', () => {
      const observed = useThen('it answers sqs', async () => {
        // a spy, never a mock: the real line still prints, and the test reads what it was handed
        // .note = sdk-logs writes every level at or above warn through `console.warn`
        const spy = jest.spyOn(console, 'warn');
        const asLines = (): string[] =>
          spy.mock.calls.map((args) =>
            args.map((arg) => JSON.stringify(arg)).join(' '),
          );
        try {
          const handler = perBatch({
            schema: {
              input: SCHEMA_ORDER.refine((value) => {
                if (value.payload.orderId === 'ord-boom')
                  throw new Error('the refine callback broke');
                return true;
              }),
            },
            invoke: async (input) => ({ successes: input.records }),
          });
          const response = await runLambdaEndpoint.onReferenced({
            handler,
            struct: { payload: 'ancient' },
            event: asSqsEvent({
              messages: [asMessageValid('ord-0'), asMessageValid('ord-boom')],
            }),
          });
          return {
            response,
            entry:
              asLines().find((line) => line.includes('sqs.record.invalid')) ??
              '',
          };
        } finally {
          spy.mockRestore();
        }
      });

      then('the record that met the server fault is retried alone', () => {
        expect(observed.response).toEqual({
          batchItemFailures: [{ itemIdentifier: 'msg-1' }],
        });
      });

      /**
       * .what = the fault of ours is reported loud, with what an on-call engineer needs
       * .why = the record redrives, so a quiet line would hide a schema defect behind retries
       */
      then(
        'an error line names the record, the class, the cause, and the stack',
        () => {
          // the line's metadata is itself a json string, so its keys arrive escaped
          expect(observed.entry).toContain('"level":"error"');
          expect(observed.entry).toContain('msg-1');
          expect(observed.entry).toContain('class');
          expect(observed.entry).toContain('Error: the refine callback broke'); // the stack's head
          expect(observed.entry).toContain('setSqsRecordsValidated'); // a frame of the stack
        },
      );
    });

    /**
     * .what = the third arm: a throw that is not an `Error` at all
     * .why = it names no fault class, so it carries no verdict on its record — it escapes, and
     *        the whole batch redrives, as `perRecord [case10][t4]` does for one record
     */
    when('[t1] the callback throws a value that is not an Error', () => {
      const outcome = useThen('the batch is not answered', async () => {
        const handler = perBatch({
          schema: {
            input: SCHEMA_ORDER.refine((value) => {
              if (value.payload.orderId === 'ord-boom')
                throw { name: 'ConstraintError', message: 'a claim, no class' };
              return true;
            }),
          },
          invoke: async (input) => ({ successes: input.records }),
        });
        const answers: unknown[] = [];
        const error: unknown = await getError(async () => {
          answers.push(
            await runLambdaEndpoint.onReferenced({
              handler,
              struct: { payload: 'ancient' },
              event: asSqsEvent({
                messages: [asMessageValid('ord-0'), asMessageValid('ord-boom')],
              }),
            }),
          );
        });
        return { error, answers };
      });

      then('the throw escapes, so the whole batch redrives', () => {
        expect(outcome.answers).toEqual([]);
        expect(outcome.error).toBeDefined();
      });
    });
  });

  given('[case15] a wire value that is not an sqs event', () => {
    when('[t0] the handler runs', () => {
      const outcome = useThen('the invoke is refused', async () => {
        const handler = perBatch({
          schema: { input: SCHEMA_ORDER },
          invoke: async () => {
            throw new Error('invoke must not run');
          },
        });
        const answers: unknown[] = [];
        const error = await getError(async () => {
          answers.push(
            await runLambdaEndpoint.onReferenced({
              handler,
              struct: { payload: 'ancient' },
              event: { httpMethod: 'POST', body: '{}' } as never,
            }),
          );
        });
        return { message: error.message, answers };
      });

      then('it throws rather than answers', () => {
        expect(outcome.answers).toEqual([]);
      });

      then('the decode refused it, never the handler', () => {
        expect(outcome.message).toContain('not an sqs event shape');
        expect(outcome.message).not.toContain('invoke must not run');
      });
    });
  });

  given('[case16] a handler that answers with no `successes` array', () => {
    when('[t0] the handler returns no answer at all', () => {
      const caught = useThen('the invoke is refused', async () =>
        getRefusal(
          perBatch({
            schema: { input: SCHEMA_ORDER },
            invoke: async () =>
              undefined as unknown as { successes: { id: string }[] },
          }),
          [asMessageValid('ord-0')],
        ),
      );

      then('it throws, so every record is retried', () => {
        expect(caught.answers).toEqual([]);
        expect(caught.message).toContain('answered without');
        expect(caught.message).not.toContain('Cannot read properties');
      });

      then('it names what arrived and the fix', () => {
        expect(caught.metadata.got).toEqual('undefined');
        expect(caught.metadata.fix).toContain('{ successes: [] }');
      });
    });

    when('[t1] the handler answers the retired `{ failures }` shape', () => {
      const caught = useThen('the invoke is refused', async () =>
        getRefusal(
          perBatch({
            schema: { input: SCHEMA_ORDER },
            invoke: async () =>
              ({ failures: [] }) as unknown as { successes: { id: string }[] },
          }),
          [asMessageValid('ord-0')],
        ),
      );

      then('it throws rather than read an empty answer as success', () => {
        expect(caught.answers).toEqual([]);
        expect(caught.metadata.keys).toEqual(['failures']);
      });
    });
  });

  given('[case17] a handler that mutates the envelope it was handed', () => {
    when('[t0] it forges a record id, then claims the forged value', () => {
      const outcome = useThen('the invoke is refused', async () =>
        getRefusal(
          perBatch({
            schema: { input: SCHEMA_ORDER },
            invoke: async ({ event }) => {
              (event.records[0] as { id: string }).id = 'msg-forged';
              return { successes: [{ id: 'msg-forged' }] };
            },
          }),
          [asMessageValid('ord-0')],
        ),
      );

      then('no answer reaches sqs, and the write itself was refused', () => {
        expect(outcome.answers).toEqual([]);
        expect(outcome.message).toContain('read only property');
      });
    });

    when('[t1] it writes to the lifted record bag at depth', () => {
      const outcome = useThen('the invoke is refused', async () =>
        getRefusal(
          perBatch({
            schema: { input: SCHEMA_ORDER },
            invoke: async ({ records }) => {
              (records[0] as { payload: { orderId: string } }).payload.orderId =
                'rewritten';
              return { successes: records };
            },
          }),
          [asMessageValid('ord-0')],
        ),
      );

      then('the lifted bag is frozen at depth too', () => {
        expect(outcome.answers).toEqual([]);
        expect(outcome.message).toContain('read only property');
      });
    });

    when('[t2] the refusal is a compile error too, never only a throw', () => {
      then('the contract types the guarantee, on both routes', () => {
        const declared: ForSqsPerBatchInput<HeadersDeclared, PayloadDeclared> =
          {
            schema: { input: SCHEMA_ORDER },
            invoke: async ({ event, records }) => {
              // @ts-expect-error — through the envelope, at depth two
              event.records[0]!.id = 'msg-forged';

              // @ts-expect-error — through the lifted array, which shares those same objects
              records[0]!.payload.orderId = 'rewritten';

              // the control: a read still compiles, and the paved return accepts frozen records
              return {
                successes: records.filter((record) => !!record.payload),
              };
            },
          };
        expect(typeof declared.invoke).toEqual('function');
      });
    });
  });
});
