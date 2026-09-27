import type { SQSEvent } from 'aws-lambda';
import { MalfunctionError } from 'helpful-errors';
import { getError, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { asSqsEvent } from '../../../__test_assets__/asSqsEvent';
import { runLambdaEndpoint } from '../../runLambdaEndpoint/runLambdaEndpoint';
import type { ForSqsPerRecordInput } from './genLambdaEndpoint.forSqs.perRecord';
import { perRecord } from './genLambdaEndpoint.forSqs.perRecord';
import type { SqsHeadersMerged, SqsHeadersOnwire } from './SqsEventDecoded';

/**
 * .what = a type-level read of whether `T` collapsed to `never`
 * .why = `never` is assignable to every type, so an ordinary assignment cannot detect it. this
 *        wraps in a tuple to defeat distribution, which is what makes the read exact
 */
type IsNever<T> = [T] extends [never] ? true : false;

/**
 * .what = the declared header shape every case below constrains against
 *
 * .why `OrderSource` is OPTIONAL here = this alias must mirror `SCHEMA_ORDER` below, and that
 *        schema declares `z.string().optional()`. a required alias beside an optional schema is a
 *        claim about a shape no handler is given, and `tsc` says so at the `invoke` bind
 *        (`rule.require.shapefit`)
 */
type HeadersDeclared = { OrderSource?: string };

// the declared body shape every case below constrains against
type PayloadDeclared = { orderId: string };

/**
 * .what = the bag `invoke` receives, derived from the CONTRACT rather than restated
 * .why = a hand-written copy of the hand-off shape drifts the moment the contract gains a
 *        slot, and a drifted copy still compiles — so the test would assert a shape no
 *        handler is given (`rule.require.shapefit`)
 */
type InvokeInput = Parameters<
  ForSqsPerRecordInput<HeadersDeclared, PayloadDeclared>['invoke']
>[0];

/**
 * .what = the ambient bag `invoke` receives beside its input, derived the same way
 * .why = the lineage rides HERE and only here, so a case that reads the input bag alone
 *        cannot observe it at all (`domain.terms/trail.md`)
 */
type InvokeContext = Parameters<
  ForSqsPerRecordInput<HeadersDeclared, PayloadDeclared>['invoke']
>[1];

/**
 * .what = the pair every case below declares, unless it declares its own
 * .why = a schema that constrains BOTH slots is what makes a merge observable — a
 *        headers-only or payload-only schema hides half the write-back
 *
 * .why `.optional()` sits INSIDE the object rather than on it = the sdk always hands this
 *        schema a `headers` object — `{}` when a message carries no attributes — so
 *        `z.object({ … }).optional()` is INERT: it fires only on `undefined`, which never
 *        arrives
 *
 * .note = a fixture whose every message carries `OrderSource` stays green under BOTH forms,
 *        so it cannot tell them apart. `[case9]` is the clamp, and it sends a bare message
 */
const SCHEMA_ORDER = z.object({
  headers: z.object({ OrderSource: z.string().optional() }),
  payload: z.object({ orderId: z.string() }),
});

/**
 * .what = one valid message, as this family's wire shape
 * .why = every case starts from a message that PASSES, so a case that fails does so for the
 *        one reason it declares
 */
const MESSAGE_VALID = {
  body: JSON.stringify({ orderId: 'ord-1' }),
  headers: { OrderSource: 'web', 'x-untouched': 'kept' },
};

describe('genLambdaEndpoint.forSqs.perRecord', () => {
  given('[case1] a batch of exactly one valid message', () => {
    when('[t0] the handler runs', () => {
      const captured = useThen('invoke receives the hand-off', async () => {
        const seen: { input: InvokeInput; context: InvokeContext }[] = [];

        const handler = perRecord({
          schema: { input: SCHEMA_ORDER },
          invoke: async (input, context) => {
            seen.push({ input, context });
          },
        });

        await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({ messages: [MESSAGE_VALID] }),
        });

        return seen[0] ?? MalfunctionError.throw('invoke never ran', { seen });
      });

      then('the payload is the parsed, validated body', () => {
        expect(captured.input.payload).toEqual({ orderId: 'ord-1' });
      });

      then('the headers carry the sender bag, keys VERBATIM', () => {
        expect(captured.input.headers).toMatchObject({
          OrderSource: 'web',
          'x-untouched': 'kept',
        });
      });

      /**
       * .what = the clamp on `domain.terms/headers.md`'s projection invariant, for this family
       * .why = `payload` and `headers` are lifted fields, and a lift is only safe while it is
       *        the SAME object as its envelope slot. a defensive copy would pass every
       *        assertion above and break this one
       */
      then('each lifted field IS its slot on the envelope — one object', () => {
        expect(captured.input.payload).toBe(
          captured.input.event.records[0]!.payload,
        );
        expect(captured.input.headers).toBe(
          captured.input.event.records[0]!.headers,
        );
      });

      then('the envelope holds exactly one record', () => {
        expect(captured.input.event.records).toHaveLength(1);
      });

      then(
        'the lineage rides `context.log.trail`, present and never optional',
        () => {
          expect(captured.context.log.trail).toMatchObject({
            exid: expect.any(String),
            stack: expect.any(Array),
          });
        },
      );

      /**
       * .what = the clamp on `domain.terms/trail.md`'s placement invariant — the lineage is
       *         ambient, so it rides `context` and the input bag carries no `trail` key
       * .why = an `input.trail` slot is forbidden on every variant, so this case reads the
       *        absence rather than trusts it
       *
       * .why it reads the runtime bag and not only the type = a slot re-declared on the
       *        contract type alone type-checks every call site and is still wrong, so the
       *        runtime read is the half a compile error cannot cover
       *        (`rule.require.clamp-edge-cases`)
       */
      then(
        'the input bag carries NO `trail` key — it is ambient, not request',
        () => {
          expect(Object.keys(captured.input).sort()).toEqual([
            'event',
            'headers',
            'payload',
          ]);
        },
      );
    });
  });

  /**
   * .what = the refusal this variant exists for
   * .why = `batchSize` is trigger config, invisible at gen time. a silent `records[0]` would
   *        process one message and let sqs DELETE the other nine (`rule.forbid.failhide`)
   */
  given('[case2] a batch of TWO messages', () => {
    when('[t0] the handler runs', () => {
      /**
       * .what = the error's FACTS, read out inside the block that caught it
       * .why = `useThen` hands back a deferred PROXY, and a proxy over an `Error` reads
       *        `.message` as `undefined` and recurses under `JSON.stringify`. so the read
       *        happens here, where the raw error is, and a plain object crosses the boundary
       */
      const caught = useThen('it throws', async () => {
        const handler = perRecord({
          schema: { input: SCHEMA_ORDER },
          invoke: async () => {
            throw new Error('invoke must not run');
          },
        });

        const error = await getError(
          async () =>
            await runLambdaEndpoint.onReferenced({
              handler,
              struct: { payload: 'ancient' },
              event: asSqsEvent({
                messages: [MESSAGE_VALID, MESSAGE_VALID],
              }),
            }),
        );

        const metadata = (error as unknown as { metadata: Record<string, any> })
          .metadata;
        return {
          message: error.message,
          count: metadata.count as number,
          fix: metadata.fix as string,
          ids: metadata.ids as string[],
        };
      });

      then('the message names the cardinality it refused', () => {
        expect(caught.message).toContain(
          'received a batch of other than one message',
        );
      });

      then(
        'the error names the FIX, since the author cannot see the trigger config',
        () => {
          expect(caught.fix).toContain('batchSize');
          expect(caught.fix).toContain('perBatch');
        },
      );

      then('it reports the cardinality it saw, and every id it refused', () => {
        expect(caught.count).toEqual(2);
        expect(caught.ids).toEqual(['msg-0', 'msg-1']);
      });
    });
  });

  given('[case3] an EMPTY batch', () => {
    when('[t0] the handler runs', () => {
      then('zero is refused by the same rule that refuses two', async () => {
        const handler = perRecord({
          schema: { input: SCHEMA_ORDER },
          invoke: async () => {
            throw new Error('invoke must not run');
          },
        });

        const caught = await getError(
          async () =>
            await runLambdaEndpoint.onReferenced({
              handler,
              struct: { payload: 'ancient' },
              event: asSqsEvent({ messages: [] }),
            }),
        );

        expect(caught.message).toContain(
          'received a batch of other than one message',
        );
      });
    });
  });

  /**
   * .what = a poison pill fails the invocation
   * .why = in sqs a successful invocation means delete the message. so a validation failure
   *        swallowed into a success would silently discard a message no handler processed.
   *        the throw is what lets sqs redrive and eventually dead-letter it
   *
   * .why the message carries the claim, never `toBeInstanceOf(Error)` = `getError` substitutes
   *        rather than fails when no throw occurs, and the substitute is measured:
   *
   *          NoErrorThrownError -> HelpfulError -> Error
   *          message: "NoErrorThrownError: no error was thrown"
   *
   *        so `toBeInstanceOf(Error)` and `toBeInstanceOf(HelpfulError)` both pass against it,
   *        and either one reads a swallowed refusal as a refusal — the exact outcome the `.why`
   *        above calls catastrophic. only an assertion the substitute cannot satisfy carries
   *        the claim
   *
   * .why the `invoked` peer cannot carry it either = a swallowed refusal still never calls
   *        `invoke`, so `invoked === false` holds under the defect too
   *        (`rule.require.positive-control-before-absence-claims`)
   *
   * .note = the forms that bite, against the measured chain above:
   *
   *          inert -> toBeInstanceOf(Error) · toBeInstanceOf(HelpfulError) · a bare not.toContain
   *          bites -> toBeInstanceOf(<a domain error class>) · toContain(<a real message>) ·
   *                   toMatchSnapshot()
   */
  given('[case4] a message whose body fails the schema', () => {
    when('[t0] the handler runs', () => {
      const outcome = useThen('it throws, and invoke never ran', async () => {
        let invoked = false;

        const handler = perRecord({
          schema: { input: SCHEMA_ORDER },
          invoke: async () => {
            invoked = true;
          },
        });

        const caught = await getError(
          async () =>
            await runLambdaEndpoint.onReferenced({
              handler,
              struct: { payload: 'ancient' },
              event: asSqsEvent({
                messages: [{ body: JSON.stringify({ orderId: 404 }) }],
              }),
            }),
        );

        return { message: caught.message, invoked };
      });

      then('the invocation fails, so sqs keeps the message', () => {
        // the field zod refused — a string only a REAL validation error carries
        expect(outcome.message).toContain('orderId');
      });

      then('the handler never saw it', () => {
        expect(outcome.invoked).toEqual(false);
      });
    });
  });

  /**
   * .what = the write-back, both arms
   * .why = zod STRIPS undeclared keys, so a REPLACE write-back would delete `x-untouched` from
   *        the bag the sender sent. the merge is what keeps an undeclared attribute readable
   *        (`domain.terms/headers.md` — the same invariant, on this family's axis)
   */
  given('[case5] a schema that declares ONE header of a two-header bag', () => {
    when('[t0] the handler runs', () => {
      const headers = useThen('invoke receives the merged bag', async () => {
        const seen: InvokeInput['headers'][] = [];

        const handler = perRecord({
          schema: {
            input: z.object({
              headers: z.object({ OrderSource: z.string() }),
              payload: z.object({ orderId: z.string() }),
            }),
          },
          invoke: async (input) => {
            seen.push(input.headers);
          },
        });

        await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({ messages: [MESSAGE_VALID] }),
        });

        return seen[0] ?? MalfunctionError.throw('invoke never ran', { seen });
      });

      then('the declared key survives', () => {
        expect(headers.OrderSource).toEqual('web');
      });

      then('the UNDECLARED key survives too — the write-back merges', () => {
        expect(headers['x-untouched']).toEqual('kept');
      });
    });
  });

  /**
   * .defect = LIVE, NOT FIXED — the strict-header hint names api gateway, on a family that is
   *        not api gateway
   *
   *        .the polarity = this case is green while the defect is present. it asserts the wrong
   *           text, so a reader must not take its green as a statement that the message is
   *           correct (`rule.require.deferred-defect-records-lead-with-status`)
   *
   *        .the cause = `getValidationError` fires `HINT_STRICT_HEADERS` on any
   *           `unrecognized_keys` issue at path `headers`, and the hint reads *"api gateway
   *           injects keys you did not declare, so a strict bag refuses every real request"*.
   *           at api gateway that is true and the advice is right. at sqs it is false — every
   *           attribute is the sender's, the transport injects none — so `.strict()` here is a
   *           legitimate choice the hint talks an author out of
   *
   *        .the repair, unapplied = `getValidationError` takes the transport fact from its
   *           caller. left because it reaches a shared file with production and test call sites
   *           across two peer families, so it is not clean to ride along
   *           (`rule.always.fix-forward-under-scouts-honor`) — see `setSqsRecordValidated.ts`
   *
   * .what this case buys = the defect is falsifiable. whoever applies the repair gets a red
   *        test that names the family and the text it must now emit, rather than a silent pass
   *        (`rule.require.clamp-edge-cases`)
   */
  given(
    '[case14] a `.strict()` header schema, and an undeclared attribute',
    () => {
      when('[t0] the message arrives', () => {
        const caught = useThen('the record is refused', async () => {
          const handler = perRecord({
            schema: {
              input: z.object({
                // legitimate on this family — sqs injects no attribute of its own
                headers: z.object({ OrderSource: z.string() }).strict(),
                payload: z.object({ orderId: z.string() }),
              }),
            },
            invoke: async () => {
              ranAnyway.push(true);
            },
          });

          const ranAnyway: boolean[] = [];

          const error = await getError(
            runLambdaEndpoint.onReferenced({
              handler,
              struct: { payload: 'ancient' },
              // `MESSAGE_VALID` carries `x-untouched`, which the strict bag refuses
              event: asSqsEvent({ messages: [MESSAGE_VALID] }),
            }),
          );

          return { message: error.message, invoked: ranAnyway.length };
        });

        /**
         * .what = the refusal itself, which is correct and stays correct after the repair
         */
        then('the record is refused, and the handler never ran', () => {
          expect(caught.message).toContain('unrecognized');
          expect(caught.invoked).toEqual(0);
        });

        /**
         * .what = the defect, pinned. green here means the api-gateway text still ships
         * .note = after the repair this assertion must be inverted, never deleted — an sqs
         *         author owes a hint that names sqs, and a deleted assertion leaves that
         *         unchecked
         */
        then('the hint names api gateway — a live defect, not fixed', () => {
          expect(caught.message).toContain('api gateway injects keys');
        });
      });
    },
  );

  given('[case6] a schema that declares NO headers key', () => {
    when('[t0] the handler runs', () => {
      const headers = useThen(
        'invoke receives the wire bag whole',
        async () => {
          const seen: SqsHeadersOnwire[] = [];

          const handler = perRecord({
            schema: {
              input: z.object({ payload: z.object({ orderId: z.string() }) }),
            },
            invoke: async (input) => {
              seen.push(input.headers);
            },
          });

          await runLambdaEndpoint.onReferenced({
            handler,
            struct: { payload: 'ancient' },
            event: asSqsEvent({ messages: [MESSAGE_VALID] }),
          });

          return (
            seen[0] ?? MalfunctionError.throw('invoke never ran', { seen })
          );
        },
      );

      then(
        'header enforcement is OPT-IN — an absent key constrains naught',
        () => {
          expect(headers).toMatchObject({
            OrderSource: 'web',
            'x-untouched': 'kept',
          });
        },
      );
    });
  });

  /**
   * .what = the raw-bytes opt-out
   * .why = a caller who must verify a signature over the EXACT bytes cannot use a re-serialized
   *        parse. `deserialize: { payload: false }` hands the string through
   */
  given('[case7] `deserialize.payload = false`', () => {
    when('[t0] the handler runs', () => {
      /**
       * .note = the value is wrapped in an object rather than returned bare, because
       *         `useThen`'s deferred proxy over a STRING primitive reads as a char map
       *         (`{ 0: 'r', 1: 'a', … }`). one object crosses the boundary; the string rides
       *         inside it
       */
      const seen = useThen('invoke receives the raw string', async () => {
        const payloads: string[] = [];

        const handler = perRecord({
          schema: { input: z.object({ payload: z.string() }) },
          invoke: async (input) => {
            payloads.push(input.payload);
          },
          deserialize: { payload: false },
        });

        await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({ messages: [{ body: 'raw-signed-bytes' }] }),
        });

        return { payloads };
      });

      then('the body is the string, unparsed', () => {
        expect(seen.payloads).toEqual(['raw-signed-bytes']);
      });
    });
  });

  /**
   * .what = the guard that keeps a NON-sqs trigger out of this family
   * .why = `getIsSqsEvent` refuses a shape that is not a batch of `aws:sqs` records, so a
   *        handler wired to the wrong trigger fails LOUD rather than decode garbage
   */
  given('[case8] a wire value that is not an sqs event', () => {
    when('[t0] the handler runs', () => {
      then('the decode refuses it by shape', async () => {
        const handler = perRecord({
          schema: { input: SCHEMA_ORDER },
          invoke: async () => {
            throw new Error('invoke must not run');
          },
        });

        const caught = await getError(
          async () =>
            await runLambdaEndpoint.onReferenced({
              handler,
              struct: { payload: 'ancient' },
              event: { httpMethod: 'POST', body: '{}' } as unknown as SQSEvent,
            }),
        );

        expect(caught.message).toContain('not an sqs event shape');
      });
    });
  });

  /**
   * .what = the INERT-`.optional()` trap, clamped on BOTH arms
   * .why = the sdk always hands `schema.input` a `headers` object — `{}` for a message with no
   *        attributes — so `z.object({ … }).optional()` can never fire. an author who writes it
   *        believes the header is optional, and every message that omits it fails validation and
   *        redrives to the dead-letter queue
   *
   * .why BOTH arms = a one-arm clamp cannot tell an inert modifier from an effective one.
   *        [t0] proves the outer form REFUSES, [t1] proves the inner form ACCEPTS, and the two
   *        differ by the placement of one call (`rule.require.clamp-edge-cases` — clamp the
   *        CLASS, and prove the clamp bites)
   *
   * .the family is TWO = `genZodInputValidationMiddleware` parses
   *        `{ headers: event.headers, payload: event.payload }`, so the identical trap exists at
   *        api gateway. the shape of the defect is *a modifier that reads as effective and is
   *        inert*, which is the same class the vision struck once already for the
   *        fill-an-absent-key remedy (`rule.require.sweep-the-defect-class`)
   */
  given('[case9] a message that carries NO attributes at all', () => {
    const MESSAGE_BARE = { body: JSON.stringify({ orderId: 'ord-1' }) };

    when('[t0] the schema puts `.optional()` ON the header object', () => {
      then(
        'it is INERT — the declared header stays required, and the message is refused',
        async () => {
          const handler = perRecord({
            schema: {
              input: z.object({
                headers: z.object({ OrderSource: z.string() }).optional(),
                payload: z.object({ orderId: z.string() }),
              }),
            },
            invoke: async () => {
              throw new Error('invoke must not run');
            },
          });

          const caught = await getError(
            async () =>
              await runLambdaEndpoint.onReferenced({
                handler,
                struct: { payload: 'ancient' },
                event: asSqsEvent({ messages: [MESSAGE_BARE] }),
              }),
          );

          expect(caught.message).toContain('headers');
        },
      );
    });

    when('[t1] the schema puts `.optional()` INSIDE it', () => {
      const seen = useThen('the invoke completes', async () => {
        const headers: InvokeInput['headers'][] = [];

        const handler = perRecord({
          schema: {
            input: z.object({
              headers: z.object({ OrderSource: z.string().optional() }),
              payload: z.object({ orderId: z.string() }),
            }),
          },
          invoke: async (input) => {
            headers.push(input.headers);
          },
        });

        await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({ messages: [MESSAGE_BARE] }),
        });

        return { count: headers.length, bag: headers[0] };
      });

      then('the message passes, and the absent header reads undefined', () => {
        expect(seen.count).toEqual(1);
        expect(seen.bag?.OrderSource).toBeUndefined();
      });
    });
  });

  /**
   * .what = what a handler's OWN throw does — the contract that decides whether a message
   *        survives its own processing failure
   *
   * .why = `genSqsEndpointMiddlewares` registers `genInternalServiceErrorMiddleware` with
   *        `asOutputAfter: false`, and its doc states the consequence: the error RETHROWS, the
   *        invocation FAILS, and sqs redrives. a flag is not a run, so this case is what makes
   *        that a measurement (`rule.require.measure-the-value-you-emit`)
   *
   * .the stakes = the opposite outcome is silent and total. were the error swallowed into a
   *        successful invocation — which is exactly what the peer families' constraint-error
   *        middleware does, correctly, for an http caller — sqs would DELETE a message no
   *        handler ever finished. `rule.forbid.failhide`, at this sdk's highest stakes
   */
  given('[case10] a handler that THROWS', () => {
    when('[t0] the message is valid and the handler fails on it', () => {
      const outcome = useThen('the invocation is refused', async () => {
        const handler = perRecord({
          schema: { input: SCHEMA_ORDER },
          invoke: async () => {
            throw new Error('the downstream warehouse api is down');
          },
        });

        const error = await getError(
          async () =>
            await runLambdaEndpoint.onReferenced({
              handler,
              struct: { payload: 'ancient' },
              event: asSqsEvent({ messages: [MESSAGE_VALID] }),
            }),
        );

        return { message: error.message };
      });

      /**
       * .what = the throw ESCAPES, rather than becoming a returned value
       * .why = an sqs invocation that RETURNS is an instruction to delete the message. so the
       *        only way a failed message survives is for the invocation itself to fail
       */
      then('the handler`s own error reaches the caller, unswallowed', () => {
        expect(outcome.message).toContain(
          'the downstream warehouse api is down',
        );
      });
    });
  });

  /**
   * .what = whether `handler.input` actually logs, measured through the REAL composed chain
   *
   * .why it exists = `genSqsEndpointMiddlewares` claims this family gets the `before` axis RIGHT
   *        where its api-gateway peer does not — trail at index 1 produces `context.log` before
   *        the io logger at index 2 reads it. array order is an argument, never a measurement,
   *        so each arm of that claim owes its own run: the peer's `[case16][t1]` pins the
   *        defect, and this case is its positive twin
   *        (`rule.require.retest-the-model-on-every-family`)
   *
   * .note = the observation channel is `logTranslate.input`, which `genIoLoggerMiddleware` calls
   *        ONLY inside its `if (log)` branch — so a spy there reports the BRANCH, never the
   *        log's output
   *
   * .note = `dispatch` is the second axis, and it is what makes `calls` a real observation:
   *        a count of 0 is both "the branch never ran" AND "the handler was never invoked", so a
   *        count alone cannot tell a defect from a broken probe
   *        (`rule.require.positive-control-before-absence-claims`)
   */
  given('[case11] the handler.input log, through the composed chain', () => {
    when('[t0] a valid message runs the whole chain', () => {
      const observed = useThen('the handler answers', async () => {
        // .note = DELIBERATE MUTATION in a `const` box — the middleware CALLS
        //         `logTranslate.input` inside a closure with no return path to this scope
        const seen: { calls: number; dispatch: string } = {
          calls: 0,
          dispatch: 'the handler was NEVER invoked',
        };

        const handler = perRecord({
          schema: { input: SCHEMA_ORDER },
          invoke: async () => {
            seen.dispatch = 'the handler ran';
          },
          logTranslate: {
            input: (event) => {
              seen.calls += 1;
              return event;
            },
          },
        });

        await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({ messages: [MESSAGE_VALID] }),
        });

        // a flat bag of SCALARS — `useThen` hands back a proxy that defers property access
        return seen;
      });

      then('the handler was invoked — so `calls` is a real observation', () => {
        expect(observed.dispatch).toEqual('the handler ran');
      });

      then(
        'the log branch DOES run, where the api-gateway peer`s does not',
        () => {
          expect(observed.calls).toEqual(1);
        },
      );
    });
  });

  /**
   * .what = the `_` ejection route, and the two reads that actually send a handler there
   *
   * .why = `SqsRecordDecoded._` is documented as the home of `receiptHandle`,
   *        `attributes.ApproximateReceiveCount`, `md5OfBody`, and the typed `messageAttributes`
   *        bag. that is a claim about what the hatch CARRIES, and the paved shape deliberately
   *        drops each of them — so if the claim were false, the value would be unreachable with
   *        no error to say so (`rule.require.measure-the-value-you-emit`)
   *
   * .the two real reads, and neither is exotic:
   *        `attributes.ApproximateReceiveCount` — *"is this the 3rd attempt? then do not charge
   *          the card again"*. the one fact a dead-letter-conscious handler needs
   *        `body` — the EXACT wire bytes, for a handler that must verify a signature over them.
   *          `payload` is the parsed object, so it cannot serve this
   */
  given('[case12] a handler that reaches the ejection route', () => {
    when('[t0] a valid message arrives', () => {
      const seen = useThen('the invoke completes', async () => {
        const captured: InvokeInput[] = [];

        const handler = perRecord({
          schema: { input: SCHEMA_ORDER },
          invoke: async (input) => {
            captured.push(input);
          },
        });

        await runLambdaEndpoint.onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asSqsEvent({ messages: [MESSAGE_VALID] }),
        });

        const input =
          captured[0] ?? MalfunctionError.throw('invoke never ran', {});
        const record =
          input.event.records[0] ??
          MalfunctionError.throw('no record reached the handler', {});

        return {
          receiveCount: record._.raw.attributes.ApproximateReceiveCount,
          rawBody: record._.raw.body,
          payloadIsParsed: typeof record.payload,
          rawIsTheVendorRecord: record._.raw === input.event._.raw.Records[0],
        };
      });

      /**
       * .what = the redrive counter, reachable
       * .why = the paved shape carries no attempt count at all, so `_` is the only route to it
       */
      then('the aws system attributes are reachable through `_`', () => {
        expect(seen.receiveCount).toEqual('1');
      });

      /**
       * .what = the EXACT wire bytes survive beside the parsed value
       * .why = a webhook handler verifies a signature over the bytes the sender signed. a
       *        re-serialized `payload` is NOT those bytes — key order and whitespace both move —
       *        so a shape that dropped the string would make signature checks impossible
       */
      then(
        'the untouched body string survives, beside the parsed payload',
        () => {
          expect(seen.rawBody).toEqual(MESSAGE_VALID.body);
          expect(seen.payloadIsParsed).toEqual('object');
        },
      );

      /**
       * .what = the hatch is the WHOLE vendor record, by identity — never a copy of the
       *        fields someone thought to keep
       * .why = an identity assertion cannot go stale. a copy would pass every assertion above
       *        and still drop the one field a future handler needs, with no test to say so
       *        (`rule.require.snapshots-deny-volatile-not-allow-expected`, as an assertion)
       */
      then('`record._.raw` IS the vendor record the event carries', () => {
        expect(seen.rawIsTheVendorRecord).toEqual(true);
      });
    });
  });

  /**
   * .what = the TYPE-level clamp on `SqsHeadersMerged`, read DIRECTLY off the type rather than
   *            through `perRecord`
   *
   * .why it cannot be reached through the factory = with no `headers` key, `THeadersDeclared`
   *        has no inference site, so it falls back to its constraint `SqsHeadersOnwire |
   *        undefined` — a union, which distributes through an intersection and leaves the record
   *        arm alive. so every case above passes under the bare intersection and under the
   *        conditional alike, and none of them reaches this arm
   *        (`rule.require.a-harness-types-as-wide-as-its-contract`)
   *
   * .note = the arm is reachable only where a consumer writes the type by hand, which the
   *        exported `SqsHeadersMerged` lets them do. the hand-off is the silent half: `never` is
   *        assignable to every type, so a handler that forwards the whole bag meets no error and
   *        the lie travels downstream. only an index of it is loud
   *
   * .the twin = `forApiGateway`'s `[case23]` clamps the identical arm on
   *        `ApiGatewayHeadersMerged`. the conditional is one shape across both families, so its
   *        clamp is owed on both (`rule.require.retest-the-model-on-every-family`)
   */
  given('[case13] the merged header type, read off the type directly', () => {
    /**
     * .what = the arm an author reaches when they omit the `headers` key — the ruled opt-out
     * .why = `SqsHeadersDeclared` admits `undefined`, and a bare
     *        `SqsHeadersOnwire & undefined` reduces to `never`, so the opt-out this package
     *        documents would type as a value that cannot exist
     */
    when('[t0] the absent-key arm is named directly', () => {
      then('it is the wire record, never `never`', () => {
        const absentArmIsNever: IsNever<SqsHeadersMerged<undefined>> = false;

        // and the arm carries a real read, which `never` could not
        const probe = (headers: SqsHeadersMerged<undefined>) =>
          headers.OrderSource;

        expect([absentArmIsNever, typeof probe]).toEqual([false, 'function']);
      });
    });

    /**
     * .why this control = the arm the FACTORY actually produces. it is sound under the bare
     *        intersection too, which is precisely why it cannot stand in for `[t0]`
     */
    when('[t1] the arm inference produces is named — the control', () => {
      then('the union distributes and the record arm survives', () => {
        const inferredArmIsNever: IsNever<
          SqsHeadersMerged<SqsHeadersOnwire | undefined>
        > = false;

        expect(inferredArmIsNever).toEqual(false);
      });
    });

    /**
     * .why this control = proves the conditional did not FLATTEN the declared arm. a
     *        conditional that returned the wire record unconditionally satisfies `[t0]` and
     *        `[t1]` both, and silently drops every narrow type an author declared
     *
     * .and the open half is what makes the MERGE observable at the type level: sqs hands over
     *        every attribute the sender set, never only the declared ones
     */
    when('[t2] a DECLARED key is named — the control', () => {
      then('the declared half narrows and the open half survives', () => {
        const read = (headers: SqsHeadersMerged<{ OrderSource: string }>) => {
          // the declared half — narrow, so no absent check is owed
          const source: string = headers.OrderSource;

          // the open half — an attribute no schema names
          const other: string | undefined = headers['x-untouched'];

          return { source, other };
        };

        expect(typeof read).toEqual('function');
      });
    });
  });

  /**
   * .what = one author-config footgun: `deserialize.payload = false` beside a payload schema
   *        that expects an object. the body never gets parsed, so the schema meets a string
   *        and refuses it
   *
   * .why it is a total outage rather than one bad message = the config is per handler, so
   *        every message the queue carries meets the same mismatch. `perRecord` throws, sqs
   *        redrives, and the queue drains to its dead-letter — all of it, on one config line
   *
   * .note = the sender never learns. at api gateway the peer footgun answers a 400 the caller
   *        reads; here the producer's `SendMessage` already succeeded, so the loss is visible
   *        only to whoever watches the dlq (`[case9]`'s stakes note, same shape)
   *
   * .the family = three config values an author sets that can refuse 100% of traffic, and each
   *        owes its own clamp because each is reached by a different key:
   *
   *          `.strict()` on the header bag        -> `[case14]` — api gateway injects keys
   *          `.optional()` on the header object   -> `[case9]`  — inert, so the key stays required
   *          `deserialize.payload = false`        -> this one — the schema meets a string
   *
   * .why `perBatch` gets no twin of this case = its behavior here is the composition of two
   *        facts each already clamped on that variant:
   *
   *          the mismatch refuses every record -> shared: one decode, one `setSqsRecordValidated`
   *          every refusal lands in the answer -> `perBatch`'s `[case5]`, all-fail -> all ids
   *
   *        so no single edit can break that arm while this one stays green, which is the test a
   *        per-variant case has to pass (`rule.prefer.wet-over-dry` — a second instance of one
   *        assertion shape buys a case to maintain and hides no complexity)
   *
   * .note = this is not the argument `[case7]`'s doc makes for `deserialize` itself. that one
   *        is variant-dependent — `perBatch` applies the decode N times — and it earned its own
   *        arm. the schema interaction is downstream of the shared decode, so it did not. the
   *        hazard reaches a `perBatch` author all the same: it is named on that variant's own
   *        `deserialize` config doc, which is where the config is set
   *        (`rule.require.solve-at-cause`)
   *
   * .why the fixture is `MESSAGE_VALID` = it is the body every other case passes with, so the
   *        refusal is attributable to the one config line rather than to the message. a bespoke
   *        body would leave an author unable to tell which of the two was at fault
   *        (`rule.require.positive-control-before-absence-claims`)
   */
  given(
    '[case15] `deserialize.payload = false` beside an object payload schema',
    () => {
      when('[t0] a body that would otherwise PASS arrives', () => {
        const outcome = useThen('the invoke is refused', async () => {
          const ranAnyway: true[] = [];

          const handler = perRecord({
            // the payload half expects an object...
            schema: { input: SCHEMA_ORDER },
            // ...and this says never parse it, so the schema meets the raw string
            deserialize: { payload: false },
            invoke: async () => {
              ranAnyway.push(true);
            },
          });

          const error = await getError(
            async () =>
              await runLambdaEndpoint.onReferenced({
                handler,
                struct: { payload: 'ancient' },
                event: asSqsEvent({ messages: [MESSAGE_VALID] }),
              }),
          );

          return { message: error.message, invoked: ranAnyway.length };
        });

        then('the record is refused, and the handler never ran', () => {
          // the zod summary names the slot, which is the one clue an author gets
          expect(outcome.message).toContain('payload');
          expect(outcome.invoked).toEqual(0);
        });

        /**
         * .what = the CAUSE, named in the message an author actually reads
         * .why = *"expected object, received string"* is a symptom that reads as a bad message.
         *        the fix is a config line the author wrote, and the error is where they meet it
         *        (`rule.require.errors-name-the-fix`)
         */
        then('the refusal names the TYPE mismatch, not merely the slot', () => {
          expect(outcome.message).toContain('string');
        });
      });
    },
  );

  /**
   * .what = a handler that writes to the envelope it was handed — refused at the write
   *
   * .why this case carries no live exploit, and ships anyway = the freeze exists because
   *        somebody reads the envelope after `invoke` returns, and this variant has no such
   *        reader: it returns `void` the moment `invoke` resolves, and its chain carries no
   *        vendor middleware. so its column in `setEventFrozen`'s table is empty. the twin's
   *        is not — `perBatch` builds `idsInBatch` from `decoded.records` after `invoke`, so a
   *        forged id there rewrites the set its own guard checks against, the exploit
   *        `perBatch`'s `[case17]` walks end to end
   *
   * .so what this case protects is the symmetry, which is a real guarantee rather than a
   *        tidiness one = the envelope this variant hands is the same shape its twin hands, and
   *        an author who moves between the two carries their habits with them. a freeze that
   *        holds on one variant and not its peer teaches that the write is safe, right up until
   *        the day the author switches (`rule.forbid.parallel-codepaths`)
   *
   * .note = the absent reader is a property of the chain as it stands, never of the shape. the
   *        moment this variant grows a post-invoke read, the twin's exploit is live here too,
   *        and the freeze is what makes that addition safe to write
   */
  given('[case16] a handler that mutates the envelope it was handed', () => {
    when('[t0] it writes through the envelope', () => {
      const outcome = useThen('the invoke is refused', async () => {
        const completed: true[] = [];

        const handler = perRecord({
          schema: { input: SCHEMA_ORDER },
          invoke: async ({ event }) => {
            (event.records[0] as { id: string }).id = 'msg-forged';
            completed.push(true);
          },
        });

        const error = await getError(
          async () =>
            await runLambdaEndpoint.onReferenced({
              handler,
              struct: { payload: 'ancient' },
              event: asSqsEvent({ messages: [MESSAGE_VALID] }),
            }),
        );

        return { message: error.message, completed: completed.length };
      });

      then('the write is refused, so the handler never finished', () => {
        expect(outcome.message).toContain('read only property');
        expect(outcome.completed).toEqual(0);
      });
    });

    when(
      '[t1] it writes to the lifted payload rather than the envelope',
      () => {
        const outcome = useThen('the invoke is refused', async () => {
          const handler = perRecord({
            schema: { input: SCHEMA_ORDER },
            invoke: async ({ payload }) => {
              // `payload` is `event.records[0].payload` — the projection `[case1]` clamps. the
              // freeze must reach it through both routes, or the lifted slot is a hole
              (payload as { orderId: string }).orderId = 'rewritten';
            },
          });

          const error = await getError(
            async () =>
              await runLambdaEndpoint.onReferenced({
                handler,
                struct: { payload: 'ancient' },
                event: asSqsEvent({ messages: [MESSAGE_VALID] }),
              }),
          );

          return { message: error.message };
        });

        then(
          'the write is refused at depth, never only at the top level',
          () => {
            // `payload.orderId` is three levels down. `Object.freeze` alone is shallow, so a
            // shallow freeze leaves this write silent — which is why `setEventFrozen` walks
            expect(outcome.message).toContain('read only property');
          },
        );
      },
    );

    /**
     * .what = the same refusal, one rung earlier — at compile time
     *
     * .why it is owed separately = `[t0]` and `[t1]` each cast past the type to reach the
     *        runtime throw, so both stay green if the contract's `FrozenDeep` were reverted to
     *        the bare shape. the freeze would still run and the throw would still fire, so the
     *        type half of the guarantee has no clamp among them
     *
     * .why the earlier rung is the one that matters to a consumer = `Object.freeze` raises a
     *        bare `TypeError` that names no cause and no remedy. a type-checked author never
     *        reaches it, because `tsc` refused the write first
     *        (`rule.prefer.prevent-over-correct` — rung 1 beats rung 4)
     */
    when('[t2] the refusal is a compile error too, never only a throw', () => {
      then('the contract types the guarantee, on both routes', () => {
        const declared: ForSqsPerRecordInput<HeadersDeclared, PayloadDeclared> =
          {
            schema: { input: SCHEMA_ORDER },
            invoke: async ({ event, payload, headers }) => {
              // @ts-expect-error — through the envelope, at depth two
              event.records[0]!.id = 'msg-forged';

              // @ts-expect-error — through the lifted payload, the projection of the same slot
              payload.orderId = 'rewritten';

              // @ts-expect-error — and its peer bag
              headers.OrderSource = 'forged';

              /**
               * .why this control = without it, the three directives above would also be
               *        satisfied by a contract that broke the types outright — `never` refuses
               *        a write and a read alike. a read that still compiles is what proves the
               *        refusal is narrow
               */
              const read: string = event.records[0]!.id;
              void read;
            },
          };

        expect(typeof declared.invoke).toEqual('function');
      });
    });
  });
});
