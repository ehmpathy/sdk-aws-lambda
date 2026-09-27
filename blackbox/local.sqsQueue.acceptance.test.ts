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
describe('the sqs queue input', () => {
  const SCHEMA_ORDER = {
    input: z.object({
      /**
       * 🔴 .why `.optional()` sits INSIDE = the sdk always hands this schema a `headers`
       *        object — `{}` for a message with no attributes — so the outer form
       *        (`z.object({ … }).optional()`) is INERT and the declared key stays REQUIRED
       *
       * ⚠️ .the failure the outer form produces = every attribute-less message fails validation,
       *        so `records` reaches the handler EMPTY while the response reports each id as a
       *        failure. `[case3]` sends such a batch; the arm clamp is `perRecord`'s `[case9]`
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
       * .what = the union of the two failure SOURCES, in one snapshot
       * .why = `msg-1` is the handler's own report and `msg-2` is the sdk's schema refusal.
       *        a suite that proved only one source would leave the other free to regress
       */
      then('both failure sources reach the response', () => {
        expect(observed.response).toMatchSnapshot();
      });

      then('the refused message never reached the handler', () => {
        expect(observed.handoff).toMatchSnapshot();
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
});
