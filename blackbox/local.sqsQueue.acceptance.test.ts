import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { asSqsEvent } from '../src/__test_assets__/asSqsEvent';
import { genLambdaEndpoint, runLambdaEndpoint } from '../src/index';

/**
 * .what = drives BOTH sqs cardinality leaves through the surface a consumer imports
 * .why = every unit case of this family reaches its leaf by a deep path
 *        (`…/genLambdaEndpoint.forSqs/genLambdaEndpoint.forSqs.perRecord`), which is a path no
 *        consumer can write. so 63 green unit cases prove the OPERATION and say not one word
 *        about whether `genLambdaEndpoint.forSqs.perRecord` — the only reachable name — works
 *
 * ⚠️ .note = `local.sdkContract.acceptance.test.ts` already clamps the family's SHAPE: the leaves
 *        are reachable, the key set is exactly two, and no member sits bare beside the family.
 *        it invokes neither. ⇒ that suite proves the names EXIST; this one proves they RUN
 *        (`rule.require.acceptance.blackbox` — the action goes through the contract)
 */
/**
 * .what = runs a step and records each warn line the sdk emits within it, while the real line
 *         still reaches the console
 * .why = the refusal line is the one trace a deleted message leaves, so the suite reads it. the
 *        spy only observes: it calls through to the real `console.warn` and fakes no behavior
 *        (a spy, never a mock — `rule.forbid.acceptance.mocks`)
 */
const withWarnLines = async <T>(
  step: () => Promise<T>,
): Promise<{ result: T; lines: unknown[] }> => {
  const spy = jest.spyOn(console, 'warn');
  try {
    const result = await step();
    return { result, lines: spy.mock.calls.map((args) => args[0]) };
  } finally {
    spy.mockRestore();
  }
};

/**
 * .what = the first warn line that names a message, with its volatile fields masked
 * .why = the local log outlet hands `console.warn` `{ level, timestamp, message, metadata, trail }`,
 *        where `metadata` is a json string. the timestamp and the generated trail exid move each
 *        run; every other field is the operator's contract, so it stays whole for the snapshot
 *        (`rule.require.snapshots-deny-volatile-not-allow-expected`)
 */
const asWarnLineMasked = (input: {
  lines: unknown[];
  message: string;
}): Record<string, unknown> | null => {
  const found = input.lines.find(
    (line): line is Record<string, unknown> =>
      typeof line === 'object' &&
      line !== null &&
      (line as { message?: unknown }).message === input.message,
  );
  if (!found) return null;
  const trail = found.trail as { exid?: string } | undefined;
  return {
    ...found,
    timestamp: '<timestamp>',
    metadata:
      typeof found.metadata === 'string'
        ? JSON.parse(found.metadata)
        : found.metadata,
    ...(trail ? { trail: { ...trail, exid: '<exid>' } } : {}),
  };
};

/**
 * .what = how one invoke settled, with a rejection's class and headline kept
 * .why = a bare `{ failed: true }` passes on any rejection, a harness bug included. the class
 *        and the headline prove the rejection is the fault the case threw, so sqs redrives on it
 */
const asInvokeSettled = async (
  invoke: Promise<unknown>,
): Promise<{
  failed: boolean;
  cause: { class: string; headline: string } | null;
}> =>
  invoke.then(
    () => ({ failed: false, cause: null }),
    (error: unknown) => ({
      failed: true,
      cause: {
        class: error instanceof Error ? error.constructor.name : typeof error,
        headline:
          (error instanceof Error ? error.message : String(error)).split(
            '\n',
          )[0] ?? '',
      },
    }),
  );

describe('the sqs queue input', () => {
  const SCHEMA_ORDER = {
    input: z.object({
      /**
       * 🔴 .why `.optional()` sits INSIDE = the sdk always hands this schema a `headers`
       *        object — `{}` for a message with no attributes — so the outer form
       *        (`z.object({ … }).optional()`) is INERT and the declared key stays REQUIRED
       *
       * ⚠️ .the failure the outer form produces = every attribute-less message fails validation,
       *        so `records` reaches the handler EMPTY and each message is refused, acknowledged,
       *        and deleted. `[case3]` sends such a batch; the arm clamp is `perRecord`'s `[case9]`
       */
      headers: z.object({ OrderSource: z.string().optional() }),
      payload: z.object({ orderId: z.string() }),
    }),
  };

  given('[case1] a consumer reaches perRecord through the family object', () => {
    /**
     * .what = the shape the readme's own sqs example publishes
     * .why = a consumer copies the readme. if the readme's four-slot destructure does not
     *        compile and run from `src/index`, the doc is the defect
     */
    const handler = genLambdaEndpoint.forSqs.perRecord({
      schema: SCHEMA_ORDER,
      invoke: async ({ payload, headers, event }, { log }) => {
        seen.push({
          orderId: payload.orderId,
          source: headers.OrderSource,
          recordCount: event.records.length,
          exidPresent: typeof log.trail?.exid === 'string',
        });
      },
    });

    const seen: {
      orderId: string;
      source: string | undefined;
      recordCount: number;
      exidPresent: boolean;
    }[] = [];

    when('[t0] one message arrives on the queue', () => {
      const observed = useThen('the invoke completes', async () => {
        await runLambdaEndpoint.onReferenced({ handler, struct: { payload: 'ancient' },
          event: asSqsEvent({
            messages: [
              {
                body: JSON.stringify({ orderId: 'ord-1' }),
                headers: { OrderSource: 'web' },
              },
            ],
          }),
        });
        return seen;
      });

      then('the handler read all four slots', () => {
        expect(observed).toMatchSnapshot();
      });
    });
  });

  given('[case2] a batch reaches a perRecord handler', () => {
    /**
     * .what = the cardinality refusal, proven at the CONSUMER's grain
     * .why = this is the family's loudest guarantee — a silent `records[0]` under
     *        `batchSize: 10` drops nine messages and sqs deletes all ten. a unit test proves
     *        the operation refuses; this proves the refusal survives the export
     */
    const handler = genLambdaEndpoint.forSqs.perRecord({
      schema: SCHEMA_ORDER,
      invoke: async () => {
        ranAnyway.push(true);
      },
    });

    const ranAnyway: boolean[] = [];

    when('[t0] two messages arrive in one invoke', () => {
      const caught = useThen('the invoke is refused', async () => {
        const error = await runLambdaEndpoint.onReferenced({ handler, struct: { payload: 'ancient' },
          event: asSqsEvent({
            messages: [
              { body: JSON.stringify({ orderId: 'ord-1' }) },
              { body: JSON.stringify({ orderId: 'ord-2' }) },
            ],
          }),
        }).catch((thrown: Error) => thrown);

        return {
          threw: error instanceof Error,
          message: error instanceof Error ? error.message : null,
          invoked: ranAnyway.length,
        };
      });

      then('it throws rather than drop the second message', () => {
        expect(caught.threw).toBe(true);
      });

      then('the handler never ran', () => {
        expect(caught.invoked).toBe(0);
      });

      then('the message names the leaf to reach for instead', () => {
        expect(caught.message).toContain('perRecord');
      });
    });
  });

  given('[case3] a consumer reaches perBatch through the family object', () => {
    /**
     * .what = the partial-failure contract, end to end through the export
     * .why = `batchItemFailures` is what sqs reads to decide which messages to redrive. a
     *        handler that returns the wrong SHAPE here redrives all ten or none, and no type
     *        error fires — aws reads the value at runtime
     */
    const handler = genLambdaEndpoint.forSqs.perBatch({
      schema: SCHEMA_ORDER,
      invoke: async ({ records, event }, { log }) => {
        seen.push({
          reached: records.map((record) => record.payload.orderId),
          arrived: event.records.length,
          exidPresent: typeof log.trail?.exid === 'string',
        });
        // the handler returns the records it processed; every other record is retried
        return {
          successes: records.filter(
            (record) => record.payload.orderId !== 'ord-poison',
          ),
        };
      },
    });

    const seen: {
      reached: string[];
      arrived: number;
      exidPresent: boolean;
    }[] = [];

    when('[t0] a batch of three arrives, one poison and one unparseable', () => {
      const observed = useThen('the invoke completes', async () => {
        const response = await runLambdaEndpoint.onReferenced({ handler, struct: { payload: 'ancient' },
          event: asSqsEvent({
            messages: [
              { body: JSON.stringify({ orderId: 'ord-ok' }) },
              { body: JSON.stringify({ orderId: 'ord-poison' }) },
              { body: JSON.stringify({ orderId: 404 }) },
            ],
          }),
        });
        return { response, handoff: seen[0] };
      });

      /**
       * .what = the two dispositions a batch can give a message it did not serve, side by side
       * .why = `msg-1` is the handler's own non-report, so sqs retries it. `msg-2` is the sdk's
       *        schema refusal, a caller fault, so it is acknowledged and never retried
       *        (`invariant.constraint-errors-never-redrive-sqs`). a suite that proved only one
       *        would leave the other free to regress
       */
      // .verdict = a schema refusal is a caller fault, so sqs deletes it (human, sdk-aws-lambda#73; F7)
      then(
        "the handler's unreported record is retried; the schema refusal is acknowledged",
        () => {
          expect(observed.response).toEqual({
            batchItemFailures: [{ itemIdentifier: 'msg-1' }],
          });
        },
      );

      then('sqs reads only msg-1 to retry; the refused msg-2 is absent, so deleted', () => {
        expect(observed.response).toMatchSnapshot();
      });

      then('the refused message never reached the handler', () => {
        expect(observed.handoff).toMatchSnapshot();
      });
    });

    /**
     * .what = the other response variants a queue can read off one batch
     * .why = each variant is a distinct instruction to sqs, so each is pinned: all served, all
     *        refused, and a batch whose every record the handler leaves unreported
     */
    when('[t1] every message is served', () => {
      const response = useThen('the invoke completes', async () =>
        runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({
            messages: [
              { body: JSON.stringify({ orderId: 'ord-a' }) },
              { body: JSON.stringify({ orderId: 'ord-b' }) },
            ],
          }),
        }),
      );

      then('no message is retried', () => {
        expect(response).toEqual({ batchItemFailures: [] });
        expect(response).toMatchSnapshot();
      });
    });

    when('[t2] every message fails the schema', () => {
      const outcome = useThen('the invoke completes', async () =>
        withWarnLines(async () =>
          runLambdaEndpoint.onReferenced({
            handler,
            struct: { payload: 'ancient' },
            event: asSqsEvent({
              messages: [
                { body: JSON.stringify({ orderId: 404 }) },
                { body: JSON.stringify({ orderId: 405 }) },
              ],
            }),
          }),
        ),
      );

      then('every refusal is acknowledged, so none is retried', () => {
        expect(outcome.result).toEqual({ batchItemFailures: [] });
        expect(outcome.result).toMatchSnapshot();
      });

      then('each refusal leaves one warn line', () => {
        const refusals = outcome.lines.filter(
          (line) =>
            (line as { message?: unknown } | null)?.message ===
            'sqs.record.refused',
        );
        expect(refusals).toHaveLength(2);
      });
    });

    when('[t3] the handler serves none of the messages', () => {
      const response = useThen('the invoke completes', async () =>
        runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({
            messages: [
              { body: JSON.stringify({ orderId: 'ord-poison' }) },
              { body: JSON.stringify({ orderId: 'ord-poison' }) },
            ],
          }),
        }),
      );

      then('every message is retried', () => {
        expect(response).toEqual({
          batchItemFailures: [
            { itemIdentifier: 'msg-0' },
            { itemIdentifier: 'msg-1' },
          ],
        });
        expect(response).toMatchSnapshot();
      });
    });
  });

  given('[case4] a queue message carries a capitalized attribute name', () => {
    /**
     * 🔴 .what = the ONE behavior an api-gateway reader would guess wrong
     * .why = this sdk lowercases header keys at api gateway, because rfc 9110 §5.1 makes http
     *        field names case-insensitive. sqs `messageAttributes` names are case-SENSITIVE, so
     *        the fold does NOT travel — an axis, never an exception
     *        (`domain.terms/headers.md`)
     *
     * ⇒ the case is here rather than in a unit suite because the guess it refutes is a guess
     *        about the PACKAGE's convention, which is what a blackbox reader forms
     */
    const handler = genLambdaEndpoint.forSqs.perRecord({
      schema: {
        input: z.object({
          headers: z.object({ OrderSource: z.string() }).optional(),
          payload: z.object({ orderId: z.string() }),
        }),
      },
      invoke: async ({ headers }) => {
        seen.push(headers);
      },
    });

    const seen: Record<string, string | undefined>[] = [];

    when('[t0] the message arrives', () => {
      const observed = useThen('the invoke completes', async () => {
        await runLambdaEndpoint.onReferenced({ handler, struct: { payload: 'ancient' },
          event: asSqsEvent({
            messages: [
              {
                body: JSON.stringify({ orderId: 'ord-1' }),
                headers: { OrderSource: 'web', 'x-untouched': 'kept' },
              },
            ],
          }),
        });
        return seen[0];
      });

      then('every attribute name survives with its case intact', () => {
        expect(observed).toMatchSnapshot();
      });
    });
  });

  given('[case5] a perBatch handler answers the WRONG shape', () => {
    /**
     * .what = a consumer who returns aws's wire shape instead of `{ successes }`
     * .why = an answer the sdk cannot read must throw, so sqs retries every record — never read
     *        as an empty answer. the cast below is what a js consumer or an `any` call site
     *        reaches the runtime with
     */
    const handler = genLambdaEndpoint.forSqs.perBatch({
      schema: SCHEMA_ORDER,
      invoke: (async () =>
        // the wire shape, which is the sdk's to render and never the handler's to write
        ({ batchItemFailures: [] })) as unknown as Parameters<
        typeof genLambdaEndpoint.forSqs.perBatch
      >[0]['invoke'],
    });

    when('[t0] the batch arrives', () => {
      const caught = useThen('the invoke is refused', async () => {
        const error = await runLambdaEndpoint.onReferenced({ handler, struct: { payload: 'ancient' },
          event: asSqsEvent({
            messages: [{ body: JSON.stringify({ orderId: 'ord-1' }) }],
          }),
        }).catch((thrown: Error) => thrown);

        return {
          message: error instanceof Error ? error.message : null,
          fix:
            error instanceof Error
              ? ((error as { metadata?: { fix?: string } }).metadata?.fix ??
                null)
              : null,
        };
      });

      then('the error names the slot rather than an sdk internal', () => {
        expect(caught.message).toContain('successes');
        expect(caught.message).not.toContain('Cannot read properties');
      });

      then('and it names the fix', () => {
        expect(caught.fix).toContain('{ successes: recordsThatSucceeded }');
      });
    });
  });

  given('[case6] a perRecord handler meets a message it must refuse', () => {
    /**
     * .what = the perRecord acknowledgement, proven through the export a consumer imports
     * .why = perRecord acknowledges by a SUCCESSFUL invoke, where perBatch omits an id — a
     *        different mechanism, so `[case3]` cannot stand in for it. a caller fault on sqs is
     *        deleted once, never retried (`invariant.constraint-errors-never-redrive-sqs`)
     */
    const handler = genLambdaEndpoint.forSqs.perRecord({
      schema: SCHEMA_ORDER,
      invoke: async ({ payload }) => {
        reached.push(payload.orderId);
        if (payload.orderId === 'ord-withdrawn')
          throw new ConstraintError('order withdrawn', {
            orderId: payload.orderId,
          });
      },
    });

    const reached: string[] = [];

    when('[t0] the message fails the schema', () => {
      const outcome = useThen('the invoke settles', async () => {
        const reachedBefore = reached.length;
        const { result: settled, lines } = await withWarnLines(async () =>
          runLambdaEndpoint
            .onReferenced({
              handler,
              struct: { payload: 'ancient' },
              event: asSqsEvent({
                messages: [{ body: JSON.stringify({ orderId: 404 }) }],
              }),
            })
            .then(() => ({ failed: false }))
            .catch(() => ({ failed: true })),
        );
        return {
          settled,
          handlerRuns: reached.length - reachedBefore,
          entry: asWarnLineMasked({ lines, message: 'sqs.record.refused' }),
        };
      });

      // the control: a schema that let the bad body through would also succeed
      then('the handler never ran — the schema refused it', () => {
        expect(outcome.handlerRuns).toEqual(0);
      });

      then('the invoke succeeds, so sqs deletes the message', () => {
        expect(outcome.settled).toEqual({ failed: false });
      });

      then('the operator reads one warn line that names the schema refusal', () => {
        const metadata = outcome.entry?.metadata as Record<string, unknown>;
        expect(outcome.entry?.level).toEqual('warn');
        expect(metadata.id).toEqual('msg-0');
        expect(metadata.class).toEqual('ConstraintError');
        expect({
          settled: outcome.settled,
          entry: outcome.entry,
        }).toMatchSnapshot();
      });
    });

    when('[t1] the handler throws a ConstraintError', () => {
      const outcome = useThen('the invoke settles', async () => {
        const { result: settled, lines } = await withWarnLines(async () =>
          runLambdaEndpoint
            .onReferenced({
              handler,
              struct: { payload: 'ancient' },
              event: asSqsEvent({
                messages: [
                  { body: JSON.stringify({ orderId: 'ord-withdrawn' }) },
                ],
              }),
            })
            .then(() => ({ failed: false }))
            .catch(() => ({ failed: true })),
        );
        return {
          settled,
          entry: asWarnLineMasked({ lines, message: 'sqs.record.refused' }),
        };
      });

      then('the handler ran, and the invoke still succeeds', () => {
        expect(reached).toContain('ord-withdrawn');
        expect(outcome.settled).toEqual({ failed: false });
      });

      then('the operator reads one warn line that names the refusal', () => {
        const metadata = outcome.entry?.metadata as Record<string, unknown>;
        expect(outcome.entry?.level).toEqual('warn');
        expect(metadata.class).toEqual('ConstraintError');
        expect(String(metadata.errorMessage)).toContain('order withdrawn');
        expect(outcome).toMatchSnapshot();
      });
    });
  });

  given('[case7] a fault that must redrive, through the export', () => {
    /**
     * .what = the redrive arms, beside `[case3]` and `[case6]`'s delete arms
     * .why = a regression to "acknowledge every throw" would pass a suite that pins only
     *        deletes. a server fault, and a perBatch handler throw of any class, must fail
     *        the invoke so sqs redrives (`invariant.constraint-errors-never-redrive-sqs`)
     */
    when('[t0] a perRecord handler throws a MalfunctionError', () => {
      const outcome = useThen('the invoke settles', async () =>
        asInvokeSettled(
          runLambdaEndpoint.onReferenced({
            handler: genLambdaEndpoint.forSqs.perRecord({
              schema: SCHEMA_ORDER,
              invoke: async () => {
                throw new MalfunctionError('the upstream is down');
              },
            }),
            struct: { payload: 'ancient' },
            event: asSqsEvent({
              messages: [{ body: JSON.stringify({ orderId: 'ord-0' }) }],
            }),
          }),
        ),
      );

      then('the invoke fails on the handler fault, so sqs redrives the message', () => {
        expect(outcome.failed).toEqual(true);
        expect(outcome.cause?.class).toEqual('MalfunctionError');
        expect(outcome.cause?.headline).toContain('the upstream is down');
        expect(outcome).toMatchSnapshot();
      });
    });

    when('[t1] a perBatch handler throws a ConstraintError', () => {
      const outcome = useThen('the invoke settles', async () =>
        asInvokeSettled(
          runLambdaEndpoint.onReferenced({
            handler: genLambdaEndpoint.forSqs.perBatch({
              schema: SCHEMA_ORDER,
              invoke: async () => {
                throw new ConstraintError('the batch is refused');
              },
            }),
            struct: { payload: 'ancient' },
            event: asSqsEvent({
              messages: [
                { body: JSON.stringify({ orderId: 'ord-0' }) },
                { body: JSON.stringify({ orderId: 'ord-1' }) },
              ],
            }),
          }),
        ),
      );

      // the throw names no record, so it is forwarded whatever its class
      then('the invoke fails on the forwarded throw, so sqs redrives the whole batch', () => {
        expect(outcome.failed).toEqual(true);
        expect(outcome.cause?.class).toEqual('ConstraintError');
        expect(outcome.cause?.headline).toContain('the batch is refused');
        expect(outcome).toMatchSnapshot();
      });
    });

    /**
     * .what = a refused record rides a batch whose handler throws
     * .why = the acknowledgement rides the invoke, so the refused record redrives with its
     *        batch — the one case the refusal line's "only if this invoke succeeds" names
     */
    when('[t2] one message is refused and the perBatch handler throws', () => {
      const outcome = useThen('the invoke settles', async () => {
        const { result: settled, lines } = await withWarnLines(async () =>
          asInvokeSettled(
            runLambdaEndpoint.onReferenced({
              handler: genLambdaEndpoint.forSqs.perBatch({
                schema: SCHEMA_ORDER,
                invoke: async () => {
                  throw new MalfunctionError('the upstream is down');
                },
              }),
              struct: { payload: 'ancient' },
              event: asSqsEvent({
                messages: [
                  { body: JSON.stringify({ orderId: 'ord-0' }) },
                  { body: JSON.stringify({ orderId: 404 }) },
                ],
              }),
            }),
          ),
        );
        return {
          settled,
          entry: asWarnLineMasked({ lines, message: 'sqs.record.refused' }),
        };
      });

      then('the refusal is logged with its conditional fate', () => {
        const metadata = outcome.entry?.metadata as Record<string, unknown>;
        expect(metadata.id).toEqual('msg-1');
        expect(String(metadata.consequence)).toContain(
          'only if this invoke succeeds',
        );
      });

      then('the invoke fails on the handler fault, so the refused record redrives too', () => {
        expect(outcome.settled.failed).toEqual(true);
        expect(outcome.settled.cause?.class).toEqual('MalfunctionError');
        expect(outcome).toMatchSnapshot();
      });
    });
  });

  given('[case8] a perBatch schema whose own callback throws a fault of ours', () => {
    /**
     * .what = the `sqs.record.invalid` line, read at the live outlet through the export
     * .why = it is the one trace of a schema defect of ours, and the record redrives on it. its
     *        peer `sqs.record.refused` is pinned here at the same grain, so both operator lines
     *        are reviewable as a diff
     */
    when('[t0] a batch arrives with one record that breaks the schema', () => {
      const outcome = useThen('the invoke settles', async () => {
        const { result: response, lines } = await withWarnLines(async () =>
          runLambdaEndpoint.onReferenced({
            handler: genLambdaEndpoint.forSqs.perBatch({
              schema: {
                input: SCHEMA_ORDER.input.refine((value) => {
                  if (value.payload.orderId === 'ord-boom')
                    throw new Error('the refine callback broke');
                  return true;
                }),
              },
              invoke: async ({ records }) => ({ successes: records }),
            }),
            struct: { payload: 'ancient' },
            event: asSqsEvent({
              messages: [
                { body: JSON.stringify({ orderId: 'ord-0' }) },
                { body: JSON.stringify({ orderId: 'ord-boom' }) },
              ],
            }),
          }),
        );
        const entry = asWarnLineMasked({ lines, message: 'sqs.record.invalid' });
        const metadata = (entry?.metadata ?? {}) as Record<string, unknown>;
        const entryMasked: Record<string, unknown> | null = entry && {
          ...entry,
          // the stack's frames carry this machine's paths, so it is masked as its unit peer masks it
          metadata: { ...metadata, stack: '<stack>' },
        };
        return { response, entry: entryMasked };
      });

      then('the record that met the fault of ours is retried alone', () => {
        expect(outcome.response).toEqual({
          batchItemFailures: [{ itemIdentifier: 'msg-1' }],
        });
      });

      then('the operator reads one error line that names the record and the cause', () => {
        expect(outcome.entry?.level).toEqual('error');
        const metadata = outcome.entry?.metadata as Record<string, unknown>;
        expect(metadata.id).toEqual('msg-1');
        expect(metadata.errorMessage).toEqual('the refine callback broke');
        expect(outcome.entry).toMatchSnapshot();
      });
    });
  });
});
