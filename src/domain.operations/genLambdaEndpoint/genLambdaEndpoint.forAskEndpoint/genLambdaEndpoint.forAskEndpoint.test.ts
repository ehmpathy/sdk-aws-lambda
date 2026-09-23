import type { Context } from 'aws-lambda';
import { DomainEntity, DomainLiteral, withImmute } from 'domain-objects';
import { getError } from 'helpful-errors';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { getIsConstraintError } from '../middleware/getIsConstraintError';
import { genLambdaEndpoint } from './genLambdaEndpoint.forAskEndpoint';

describe('genLambdaEndpoint', () => {
  const createMockContext = (): Context =>
    ({
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',
      memoryLimitInMB: '128',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/test',
      logStreamName: 'test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
      callbackWaitsForEmptyEventLoop: true,
    }) as Context;

  given('[case1] valid input and output', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ salute: z.string() }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns salute', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async ({ event }) => {
            return { salute: `Hello, ${event.name}!` };
          },
        });

        return handler({ name: 'Alice' }, createMockContext());
      });

      then('it should return validated output', () => {
        expect(result).toEqual({ salute: 'Hello, Alice!' });
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case2] invalid input', () => {
    const schema = {
      input: z.object({ name: z.string(), age: z.number() }),
      output: z.object({ result: z.boolean() }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns error response', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async () => ({ result: true }),
        });

        // BadRequestError = lambda succeeds, returns error response object
        return handler(
          { name: 'Bob', age: 'not a number' } as unknown as {
            name: string;
            age: number;
          },
          createMockContext(),
        );
      });

      then('it should return BadRequestError type', () => {
        expect(result).toMatchObject({
          errorType: 'BadRequestError',
        });
      });

      then('error message indicates validation failure', () => {
        expect(
          (result as unknown as { errorMessage: string }).errorMessage,
        ).toContain('validation failed');
      });

      /**
       * .what = this family's CALLER-fault settle state, asserted directly
       * .why = a caller fault must not emit a cloudwatch error nor signal a retry, and in
       *        lambda that distinction IS the promise's settle state
       *        (invariant.badrequesterror-not-lambda-error). the `then`s above read an
       *        already-awaited `result`, so they prove this incidentally while they name only
       *        the errorType and the message
       *
       * .note = third of the four settle-state points; the api-gateway pair lives in that
       *         family's suite (rule.require.sweep-the-defect-class)
       */
      then('the invocation SUCCEEDS — settles FULFILLED', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async () => ({ result: true }),
        });

        await expect(
          handler(
            { name: 'Bob', age: 'not a number' } as unknown as {
              name: string;
              age: number;
            },
            createMockContext(),
          ),
        ).resolves.toMatchObject({ errorType: 'BadRequestError' });
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case3] invalid output', () => {
    const schema = {
      input: z.object({ id: z.string() }),
      output: z.object({ data: z.string() }),
    };

    when('[t0] handler returns wrong shape', () => {
      then('it should throw MalfunctionError', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async () => ({ data: 123 }) as unknown as { data: string },
        });

        const error = await getError(
          handler({ id: 'test' }, createMockContext()),
        );

        expect(error.message).toContain('output validation failed');
        const errorWithMeta = error as Error & {
          metadata?: Record<string, unknown>;
        };
        expect({
          message: errorWithMeta.message,
          metadata: errorWithMeta.metadata,
        }).toMatchSnapshot();
      });

      /**
       * ⚠️ .what = this family's SERVER-fault settle state — the INVERSE of its api-gateway
       *            peer, and the last of the four points
       * .why = this family DECLINES to answer a server fault. that is what
       *        `genInternalServiceErrorMiddleware({ asOutputAfter: false })` means: rethrow, so
       *        the invocation FAILS, cloudwatch records a `FunctionError`, and the caller may
       *        retry. no http caller waits on this family, so a failed invocation is the RIGHT
       *        contract where a 500 payload would be wrong
       *
       * .note = this is the settle state whose silent regression costs the most. if the
       *         off-state were ever read as "absent" and a payload returned instead, every
       *         server fault would become a SUCCESS: cloudwatch would no longer record them, no
       *         alarm would fire, and no retry would happen — a total observability outage,
       *         invisible to any test that asserts only the response value
       *
       *         the assertion above proves a rejection incidentally, by way of `getError`. this
       *         one NAMES it, so a regression fails against the guarantee rather than against a
       *         message string
       */
      then('the invocation FAILS — settles REJECTED', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async () => ({ data: 123 }) as unknown as { data: string },
        });

        await expect(
          handler({ id: 'test' }, createMockContext()),
        ).rejects.toThrow();
      });
    });
  });

  given('[case4] trail context propagation', () => {
    const schema = {
      input: z.object({ value: z.number() }),
      output: z.object({ doubled: z.number() }),
    };

    when('[t0] event includes trail', () => {
      then('it should propagate trail to context', async () => {
        let capturedLog: unknown;
        const handler = genLambdaEndpoint({
          schema,
          invoke: async ({ event }, context) => {
            capturedLog = context.log;
            return { doubled: event.value * 2 };
          },
        });

        await handler(
          { value: 5, trail: { exid: 'test-exid-123' } },
          createMockContext(),
        );

        expect(capturedLog).toBeDefined();
        expect(typeof (capturedLog as { debug: unknown }).debug).toBe(
          'function',
        );
      });
    });
  });

  given('[case5] logTranslate for redaction', () => {
    const schema = {
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      output: z.object({ success: z.boolean() }),
    };

    when('[t0] handler invoked with sensitive data', () => {
      const result = useThen('handler processes request', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async () => ({ success: true }),
          logTranslate: {
            input: (event) => ({
              ...(event as object),
              password: '[REDACTED]',
            }),
          },
        });

        return handler(
          { username: 'alice', password: 'secret123' },
          createMockContext(),
        );
      });

      then('it should return success', () => {
        expect(result).toEqual({ success: true });
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case6] schema with transforms', () => {
    const schema = {
      input: z.object({
        email: z.string().transform((val) => val.toLowerCase()),
      }),
      output: z.object({
        email: z.string(),
      }),
    };

    when('[t0] handler invoked', () => {
      let capturedEmail: string | undefined;

      const result = useThen('handler applies transform', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async ({ event }) => {
            capturedEmail = event.email;
            return { email: event.email };
          },
        });

        return handler({ email: 'ALICE@EXAMPLE.COM' }, createMockContext());
      });

      then('input is lowercased before handler', () => {
        expect(capturedEmail).toBe('alice@example.com');
      });

      then('output reflects transformed email', () => {
        expect(result.email).toBe('alice@example.com');
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case7] introspection request in prep env', () => {
    const schema = {
      input: z.object({ customerId: z.string() }),
      output: z.object({ name: z.string(), balance: z.number() }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns schema', async () => {
        const handler = genLambdaEndpoint(
          {
            schema,
            invoke: async () => ({ name: 'test', balance: 100 }),
          },
          { env: { access: 'prep' } },
        );

        return handler({ introspect: 'schema' } as any, createMockContext());
      });

      then('response contains input schema', () => {
        const response = result as unknown as {
          input: { type: string; properties: Record<string, unknown> };
        };
        expect(response.input.type).toBe('object');
        expect(response.input.properties.customerId).toBeDefined();
      });

      then('response contains output schema', () => {
        const response = result as unknown as {
          output: { type: string; properties: Record<string, unknown> };
        };
        expect(response.output.type).toBe('object');
        expect(response.output.properties.name).toBeDefined();
        expect(response.output.properties.balance).toBeDefined();
      });

      then('response matches snapshot', () => {
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case8] introspection request in prod env', () => {
    const schema = {
      input: z.object({ id: z.string() }),
      output: z.object({ value: z.number() }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns error response', async () => {
        const handler = genLambdaEndpoint(
          {
            schema,
            invoke: async () => ({ value: 42 }),
          },
          { env: { access: 'prod' } },
        );

        return handler({ introspect: 'schema' } as any, createMockContext());
      });

      then('returns BadRequestError type', () => {
        expect(result).toMatchObject({ errorType: 'BadRequestError' });
      });

      then('error message mentions prep environment', () => {
        expect(
          (result as unknown as { errorMessage: string }).errorMessage,
        ).toContain('prep');
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case9] introspection request without env config', () => {
    const schema = {
      input: z.object({ id: z.string() }),
      output: z.object({ value: z.number() }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns error response', async () => {
        const handler = genLambdaEndpoint({
          schema,
          invoke: async () => ({ value: 42 }),
          // no env provided
        });

        return handler({ introspect: 'schema' } as any, createMockContext());
      });

      then('returns BadRequestError type', () => {
        expect(result).toMatchObject({ errorType: 'BadRequestError' });
      });

      then('error message mentions env', () => {
        expect(
          (result as unknown as { errorMessage: string }).errorMessage,
        ).toContain('env');
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case10] normal request with env config', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ salute: z.string() }),
    };

    when('[t0] handler invoked with normal payload', () => {
      const result = useThen('handler processes request', async () => {
        const handler = genLambdaEndpoint(
          {
            schema,
            invoke: async ({ event }) => ({ salute: `Hello, ${event.name}!` }),
          },
          { env: { access: 'prep' } },
        );

        return handler({ name: 'Bob' }, createMockContext());
      });

      then('passes through to handler as normal', () => {
        expect(result).toEqual({ salute: 'Hello, Bob!' });
      });

      then('result matches snapshot', () => {
        expect(result).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the branch's HEADLINE guarantee, proven through the REAL exported handler
   * .why = every other proof of it sits at a narrower grain, and neither grain can catch a
   *        chain-order regression:
   *          - `genZodEventValidationMiddleware.test.ts` hand-builds a fake middy `request` and
   *            calls `.before()` directly, so it bypasses chain construction entirely
   *          - the introspection cases never reach `invoke`'s business path at all
   *        ⇒ so until now the claim "`invoke` receives the instance" was proven for the
   *        MIDDLEWARE and assumed for the HANDLER — a union of two halves that is not the claim
   *        (rule.require.sweep-the-defect-class)
   *
   * ⚠️ .why the wired grain is the one that matters = this family's own chain carries a
   *        documented, fragile order, and the peer family's builder states outright that a break
   *        on either axis "no-ops SILENTLY: no throw, no log, no type error". a reorder that
   *        preserved every extant assertion could still strip the coerced instance before
   *        `invoke` reads it, and no suite would have gone red
   *
   * .note = the assertion runs INSIDE `invoke`, never on the returned value. the return crosses
   *         output validation and `JSON.stringify` afterwards, so a `toBeInstanceOf` on the
   *         result would grade the wrong border and pass on a plain object
   *
   * ⚠️ .PROVEN by revert, against the exact silent regression the builder warns of — drop the
   *    write-back at `genZodEventValidationMiddleware.ts:32` (`request.event = inputAfter`), so
   *    validation still RUNS and its coerced result is discarded:
   *
   *      🔴 4 red — every `[t0]` instance row, plus the plain-peer row
   *      🟢 `[t1]` stayed GREEN — the refusal still fires, so a suite that clamped only the
   *         REFUSAL would have reported this regression as no regression at all
   *
   *    ⇒ that green is the half worth the note: it is the precise shape of "no throw, no log,
   *      no type error" (rule.require.clamp-edge-cases)
   */
  given(
    '[case11] a domain object in the schema, through the wired handler',
    () => {
      // .as = the same two-dobj fixture the middleware spec uses — a literal nested in an entity,
      //       so the depth-0 and the `.nested` route are both reachable from one input
      interface SurfSpot {
        name: string;
        breakType: string;
      }
      class SurfSpot extends DomainLiteral<SurfSpot> implements SurfSpot {
        public static schema = z.object({
          name: z.string(),
          breakType: z.string(),
        });
      }

      interface Surfer {
        uuid: string;
        handle: string;
        home: SurfSpot;
      }
      class Surfer extends DomainEntity<Surfer> implements Surfer {
        public static primary = ['uuid'] as const;
        public static unique = ['handle'] as const;
        public static nested = { home: SurfSpot };
        public static schema = z.object({
          uuid: z.string(),
          handle: z.string(),
          home: SurfSpot.contract(),
        });
      }

      const schema = {
        input: z.object({
          surfer: Surfer.contract(), // depth 0
          crew: z.array(Surfer.contract()), // depth 1, inside an array
          signup: z
            .object({ spot: SurfSpot.contract(), note: z.string() })
            .nullable(), // depth 1, under a PLAIN wrapper
        }),
        output: z.null(),
      };

      const payload = {
        surfer: {
          uuid: 'u-1',
          handle: 'kai',
          home: { name: 'pipeline', breakType: 'reef' },
        },
        crew: [
          {
            uuid: 'u-2',
            handle: 'moana',
            home: { name: 'trestles', breakType: 'point' },
          },
        ],
        signup: {
          spot: { name: 'mavericks', breakType: 'reef' },
          note: 'dawn',
        },
      };

      when('[t0] the handler is invoked with the wire shape', () => {
        const seen = useThen('the handler answers', async () => {
          const captured: {
            surfer?: unknown;
            home?: unknown;
            crewFirst?: unknown;
            signupSpot?: unknown;
            note?: unknown;
          } = {};

          const handler = genLambdaEndpoint({
            schema,
            invoke: async ({ event }) => {
              // ⚠️ captured INSIDE invoke, deliberately — see the `.note` above
              captured.surfer = event.surfer;
              captured.home = event.surfer.home;
              captured.crewFirst = event.crew[0];
              captured.signupSpot = event.signup?.spot;
              captured.note = event.signup?.note;
              return null;
            },
          });

          await handler(payload, createMockContext());
          return captured;
        });

        then('the depth-0 position arrives as a real instance', () => {
          expect(seen.surfer).toBeInstanceOf(Surfer);
        });

        then('the nested literal arrives as a real instance too', () => {
          expect(seen.home).toBeInstanceOf(SurfSpot);
        });

        then('every element of the array arrives as an instance', () => {
          expect(seen.crewFirst).toBeInstanceOf(Surfer);
        });

        then('a dobj under a PLAIN wrapper arrives as an instance', () => {
          expect(seen.signupSpot).toBeInstanceOf(SurfSpot);
        });

        then('and the plain peer beside it stays plain', () => {
          expect(seen.note).toEqual('dawn');
        });

        /**
         * ⚠️ .why a SNAPSHOT beside all five rows above = every one is a `toBeInstanceOf` or a
         *    single-key `toEqual`, and NEITHER SHAPE CAN SEE AN EXTRA KEY. a coerce that
         *    attached a field of its own to the value handed to `invoke` leaves all five GREEN
         *
         * ⇒ the peer family's `[case18]` carries the identical row for the identical reason,
         *   and the OUTPUT-border version of this question already has a suite of its own
         *   (`local.dobjWire.acceptance.test.ts`, which exists because `withImmute` attaches an
         *   own `clone`). this is that question at the INPUT border of THIS family
         *   (rule.require.sweep-the-defect-class — a cause that names no family has two)
         */
        then(
          'and the whole coerced input a handler receives is snapped',
          () => {
            expect(
              JSON.parse(
                JSON.stringify({
                  surfer: seen.surfer,
                  crewFirst: seen.crewFirst,
                  signupSpot: seen.signupSpot,
                  note: seen.note,
                }),
              ),
            ).toMatchSnapshot();
          },
        );
      });

      when('[t1] a value its domain object refuses is sent', () => {
        const outcome = useThen('the handler answers', async () => {
          /**
           * .note = DELIBERATE MUTATION. `invoke` is a closure the chain calls, so the only way
           *         to observe whether it ran is to have it write outward. a `const` cannot
           *         carry that signal, and there is no return value to read — the point of this
           *         case is that `invoke` is NEVER reached (rule.require.immutable-vars)
           *
           * ⚠️ .why it is a POSITIVE CONTROL too = if the chain silently dropped its call to
           *         `invoke` altogether, `reached === false` would pass for the wrong reason.
           *         the peer `[t0]` asserts the happy path DOES reach it, so the pair is what
           *         makes this assertion mean what it says
           */
          let reached = false;

          const handler = genLambdaEndpoint({
            schema,
            invoke: async () => {
              reached = true;
              return null;
            },
          });

          // ⚠️ .why this payload travels through a JSON round-trip = the compiler now REFUSES a
          //    malformed literal here, and that refusal is itself a result of this round's type
          //    repair: `genLambdaEndpoint` takes the WIRE face, so `home: {}` fails to satisfy
          //    `SurfSpot`. but aws never type-checks an invocation — it hands us whatever bytes
          //    a caller sent. so the test must reproduce that delivery rather than dodge the
          //    compiler with a cast: `JSON.parse` returns `any`, which is what a real lambda
          //    boundary yields, and the runtime value is byte-identical to the literal
          //    (rule.forbid.as-cast — no cast is written; the untyped boundary is REAL here)
          const payloadMalformed = JSON.parse(
            JSON.stringify({
              ...payload,
              surfer: { uuid: 'u-1', handle: 'kai', home: {} },
            }),
          );

          const settled = await handler(payloadMalformed, createMockContext());

          return { reached, settled };
        });

        // the wish asks that a dobj which fails its own validation fails LOUD at the border and
        // never reaches `invoke` half-built. proven here through the wired chain rather than
        // through a hand-built request
        then('it is refused at the border', () => {
          expect(outcome.settled).toMatchObject({
            errorType: 'BadRequestError',
          });
        });

        then('and invoke is never reached at all', () => {
          expect(outcome.reached).toEqual(false);
        });

        /**
         * 🔴 .what this row FOUND, and it is the reason the row exists = this `[t1]` asserted
         *    `Boolean(await getError(...)) === true` and was GREEN — while THE CHAIN NEVER
         *    THREW AT ALL. `getError` hands back a `NoErrorThrownError` INSTANCE when the
         *    promise resolves, and an instance is truthy, so the assertion could not fail on
         *    either branch. the first snapshot of that value read, verbatim:
         *
         *      `"NoErrorThrownError: no error was thrown"`
         *
         * ⇒ and the contradiction was on the page the whole time: `[case2]` of THIS file
         *   documents the family's contract outright — *"BadRequestError = lambda succeeds,
         *   returns error response object"* — and asserts `.resolves.toMatchObject(...)`. a
         *   caller fault in this family CANNOT throw, so `thrown === true` was never a claim
         *   this case could have proven (invariant.badrequesterror-not-lambda-error)
         *
         * ⚠️ .what was and was NOT proven before the repair = the `reached === false` row was
         *    always real, so "invoke is never reached" held. the REFUSAL half — the wish's own
         *    `.acceptance` line about failing LOUD — was proven by a tautology. half a case,
         *    reported as a whole one (rule.forbid.failhide, at test grain)
         *
         * ⇒ so this row now reads the SETTLED payload, which is the value a caller actually
         *   meets, and snaps it whole: the `errorType` above grades the verdict, and these
         *   bytes grade the diagnostic — it must name `surfer.home`, the path that failed
         *
         * ⚠️ .PROVEN BY REVERT (rule.require.clamp-edge-cases — a clamp unseen to fail is a guess):
         *
         *      revert                                  | result
         *      ----------------------------------------|----------------------------------------
         *      drop the `surfer: { … home: {} }`        | 🔴 56 passed, 3 failed — the `errorType`
         *      override, so the payload is VALID        |    row, this snapshot row, and the
         *                                               |    `useThen` row that feeds them
         *      restore it                               | 🟢 59 passed, 0 failed
         *
         * ⇒ the OLD assertion (`Boolean(await getError(...)) === true`) was run against that
         *   same valid payload and stayed GREEN. so the revert does not merely prove this
         *   clamp bites — it measures the exact gap the repair closed
         */
        then('and the payload it answers with names the path, loudly', () => {
          expect(outcome.settled).toMatchSnapshot();
        });
      });
    },
  );

  given(
    '[case12] a nullable/optional domain object at the OUTPUT border',
    () => {
      /**
       * ⚠️ .why this case exists = a SWEEP MISS, found by a peer and correct. the input border
       *    already clamps this exact shape — `genZodEventValidationMiddleware.test.ts [case12]`,
       *    `X.contract().nullable()` / `.optional()` applied DIRECTLY to the dobj position. i
       *    swept that axis and never the output one, so the mirror had zero coverage anywhere
       *    (rule.require.sweep-the-defect-class — a cause that names no border has two)
       *
       * .why it is the mainstream shape = `getOneById` returns the row or `null`. a consumer
       *      reaches for `X.contract().nullable()` at `schema.output` the first time they write
       *      a lookup, which is sooner than they reach for most of what this file clamps
       *
       * ⚠️ .why it was NOT covered by the input twin = the two borders run different code. the
       *    input side goes through `getValidatedInput` and throws a `ConstraintError`; the
       *    output side goes through `getValidatedOutput` and throws a `MalfunctionError`. and
       *    `X.contract()` binds `TOutput` to the INSTANCE type, so the output border is the one
       *    where the null arm has to survive a type the input border never meets
       *
       * ⚠️ .PROVEN BY REVERT (rule.require.clamp-edge-cases):
       *
       *      revert                                  | result
       *      ----------------------------------------|----------------------------------------
       *      `.nullable()` -> bare `.contract()`      | 🔴 3 red — every row of `[t1]`. the
       *                                               |    MESSAGE is the useful half:
       *                                               |    `MalfunctionError: output validation
       *                                               |    failed: lesson: Invalid input:
       *                                               |    expected object, received null`
       *                                               |    ⇒ a 500 on the most ordinary lookup
       *                                               |    there is
       *
       *    ⇒ `[t0]` stays green under that revert, which is the half worth the note: a suite
       *      that clamped only the PRESENT arm would have reported the absent arm as covered
       *
       * ⚠️ .the count was WRITTEN as 2 and MEASURED as 3, and the gap is a fact about the
       *    harness rather than about the subject: `useThen` registers a `then` row of ITS OWN
       *    ("the handler answers"), so a `when` with N assertions has N+1 rows and a throw
       *    inside the shared body reds every one. ⇒ a red count derived from a read of the
       *    assertions undercounts by exactly one per `useThen`
       *    (rule.require.measure-the-value-you-emit)
       */
      interface SurfLesson {
        uuid: string;
        spot: string;
      }
      class SurfLesson extends DomainEntity<SurfLesson> implements SurfLesson {
        public static primary = ['uuid'] as const;
        public static schema = z.object({
          uuid: z.string(),
          spot: z.string(),
        });
      }

      const schema = {
        input: z.object({ uuid: z.string() }),
        output: z.object({
          lesson: SurfLesson.contract().nullable(),
          coach: SurfLesson.contract().optional(),
        }),
      };

      when(
        '[t0] the handler hands back a real instance at both positions',
        () => {
          const outcome = useThen('the handler answers', async () => {
            const handler = genLambdaEndpoint({
              schema,
              // ⚠️ .why `withImmute` and NOT a bare `new SurfLesson(...)` = MEASURED, and it is
              //    the UNEVEN compiler demand caught in the act. `.nullable()` makes
              //    this position a union, so tsc cannot unify `TOutput` from the return and
              //    falls back to the SCHEMA's output type — which `ContractOf` declares as
              //    `WithImmute<Instance>`. a bare instance then reds with `Property 'clone' is
              //    missing`. the non-nullable peers in `refTrophyHandlers.ts` unify, so they
              //    take a bare `new X(...)` and never meet this
              invoke: async ({ event }) => ({
                lesson: withImmute(
                  new SurfLesson({ uuid: event.uuid, spot: 'pipeline' }),
                ),
                coach: withImmute(
                  new SurfLesson({ uuid: 'c-1', spot: 'trestles' }),
                ),
              }),
            });

            return await handler({ uuid: 'l-1' }, createMockContext());
          });

          then(
            'the NULLABLE position keeps its prototype through validation',
            () => {
              expect(outcome.lesson).toBeInstanceOf(SurfLesson);
            },
          );

          then('the OPTIONAL position keeps its prototype too', () => {
            expect(outcome.coach).toBeInstanceOf(SurfLesson);
          });

          /**
           * ⚠️ .why a snapshot beside the two prototype rows = this is the ask family's OUTPUT
           *    border, so it is the exact place `local.dobjWire.acceptance.test.ts` measured a
           *    leak risk: `withImmute` attaches an own `clone`, and a `toBeInstanceOf` is blind
           *    to it. that suite proved the bytes stay clean for ONE deployed fixture; this
           *    pins them for the nullable/optional pair, which that fixture does not carry
           */
          then('and the bytes a caller receives carry the fields alone', () => {
            expect(JSON.parse(JSON.stringify(outcome))).toMatchSnapshot();
          });
        },
      );

      when('[t1] the lookup found naught, so the position is null', () => {
        const outcome = useThen('the handler answers', async () => {
          const handler = genLambdaEndpoint({
            schema,
            invoke: async () => ({ lesson: null }),
          });

          return await handler({ uuid: 'l-absent' }, createMockContext());
        });

        // ⚠️ this is the row the gap was about. `X.contract()` coerces through the class
        //    constructor, so the open question was whether a `null` short-circuits at the zod
        //    wrapper or falls INTO `new SurfLesson(null)` — which at the OUTPUT border would
        //    surface as a `MalfunctionError` and a 500 on the most ordinary lookup there is
        then(
          'the null passes through, rather than into the constructor',
          () => {
            expect(outcome.lesson).toEqual(null);
          },
        );

        then('and the absent OPTIONAL position stays absent', () => {
          expect(outcome.coach).toEqual(undefined);
        });

        /**
         * .why = the absent arm's bytes are what a `getOneById` miss actually puts on the wire,
         *        and they carry a distinction the two rows above cannot show: `lesson` is
         *        PRESENT as null while `coach` is OMITTED entirely. a `toEqual(undefined)` reads
         *        the same for an omitted key and for a key set to `undefined`; the serialized
         *        form is where the two part
         */
        then('and the bytes show null PRESENT beside the absent key', () => {
          expect(JSON.parse(JSON.stringify(outcome))).toMatchSnapshot();
        });
      });
    },
  );

  given(
    '[case13] a bare `.transform()` throw on the INPUT side — F35, at THIS family',
    () => {
      /**
       * ⛔ .status = RULED 2026-09-21 — NOT A DEFECT, and NO REPAIR IS OWED. this case pins
       *    CORRECT behavior, never a deferred fault. it was written as a defect record and
       *    the fulcrum it served is now closed
       *
       *    .why it is correct = a bare guard `throw` and a genuine null-deref inside a
       *      transform are INDISTINGUISHABLE — same plain `Error`, same `inst._zod.parse`
       *      frame, no property parts them. so a server fault is the only honest read, and
       *      at THIS family that read costs more (see `.why a failed invocation is worse`
       *      below) — which raises the stakes of a WRONG read, never of this one
       *
       *    ⇒ and a consumer who MEANS a caller fault has two zod-native forms, both clamped
       *      below: `[t2]` `.refine()`, and `[t3]` `ctx.addIssue` + `z.NEVER`
       *
       *    ⚠️ .to re-open, one claim must fall = that the two throws produce no
       *      distinguishable observable state. `[t0]` and `[t3]` clamp it from both sides
       *
       * .what = the F35 consequence AT THIS FAMILY, and it is materially worse than the one
       *      the fulcrum stated. F35 recorded its `.the consequence` section scoped to
       *      `forApiGateway` — *"a consumer ... receives a 500 where a 400 is the honest
       *      answer"*. this family hands the SAME middleware `asOutputAfter: false`
       *      (`genLambdaEndpoint.forAskEndpoint.ts:141`), and `false` RETHROWS
       *      (`genInternalServiceErrorMiddleware.ts:79`) — so the INVOCATION FAILS
       *
       * ⚠️ .why a failed invocation is worse than a 500 body = it is a real lambda
       *    `FunctionError`. it raises the cloudwatch error rate AND it signals a retry — and
       *    a caller's bad value does not improve on a retry. that is the whole triple
       *    `invariant.badrequesterror-not-lambda-error` exists to prevent; a 500 body on a
       *    SETTLED invocation trips only the first third of it
       *
       * .why the class escapes = `getIsConstraintError` matches `ConstraintError` and
       *      `BadRequestError` by instance, by name, and by prototype chain
       *      (`getIsConstraintError.ts:11-34`). a bare `Error` raised inside a consumer's own
       *      `.transform()` matches none of the three, so it falls past the caller-fault
       *      middleware to the server-fault one
       *
       * ⚠️ .why a test rather than a widened fulcrum alone = the fulcrum's consequence was
       *    READ off one family's middleware list. this case RUNS it
       *    (rule.require.measure-the-value-you-emit)
       *
       * ⚠️ .PROVEN BY REVERT (rule.require.clamp-edge-cases):
       *
       *      revert                                  | result
       *      ----------------------------------------|----------------------------------------
       *      `asOutputAfter: false` -> a function     | 🔴 4 red — 2 of this case's 3 rows,
       *        at `forAskEndpoint.ts:141`             |    plus BOTH of `[case3]`'s. the peer
       *                                               |    pair is correct rather than noise:
       *                                               |    it is the same guarantee, measured
       *                                               |    on a server fault instead
       *
       *    ⇒ the row `the class is a bare Error…` stays GREEN under that revert, and that is
       *      the half worth the note: this case carries TWO independent claims — the CLASS
       *      (`getIsConstraintError` refuses it) and the SETTLE STATE (the invocation
       *      rejects) — and the revert separates them cleanly. a repair to either one alone
       *      reds only its own row
       *
       * ⇒ caught by a peer at `enroll-impl-behavior-intent`, i011, and the peer is correct.
       *   F35's own stated cause names no family, so a sweep bounded to one was bounded to an
       *   axis the cause never mentioned (rule.require.sweep-the-defect-class, the second trap)
       */
      const schema = {
        input: z.object({
          spot: z.string().transform((raw) => {
            // a consumer's OWN guard on a caller's value — the shape F35 is about
            if (raw !== 'pipeline') throw new Error('unknown surf spot');
            return raw;
          }),
        }),
        output: z.object({ booked: z.boolean() }),
      };

      /**
       * ⚠️ .why every row below awaits DIRECTLY rather than through `useThen` = MEASURED, and
       *    it is a fact about the harness rather than about the subject. `useThen` hands back
       *    a proxy, and a proxy over an `Error` loses both halves that matter here:
       *    `instanceof Error` reads `false`, and `.name` / `.message` read `undefined`, since
       *    those are NON-ENUMERABLE own properties. a snapshot of the proxy then renders
       *    `{ originalError: [Error: …] }` — the own-enumerable view — which reads as though
       *    the handler answered with an object rather than threw
       *    (rule.require.measure-the-value-you-emit). `[case3]` awaits directly for the same
       *    reason, and this is the second instance of that harness fact on this file
       */
      when('[t0] the caller sends a value the consumer guard refuses', () => {
        /**
         * ⚠️ .why ONE invocation, shared = the three rows below grade ONE refusal — its
         *         class, its settle-state, and its message. three separate calls read as
         *         one verdict while they are three, so a divergence between them would
         *         render as agreement (rule.forbid.redundant-expensive-operations)
         *
         * .note = a promise awaited N times still runs its executor ONCE, so this keeps
         *         the one-run guarantee. `getError` settles the rejection at creation, so
         *         no unhandled-rejection warn fires while the rows queue. this is the
         *         house form — `genZodEventValidationMiddleware.test.ts` `[case11][t0]`
         *         carries the same shape for the same reason
         */
        const refusal = getError(
          genLambdaEndpoint({
            schema,
            invoke: async () => ({ booked: true }),
          })({ spot: 'trestles' }, createMockContext()),
        );

        then(
          'the invocation REJECTS — it does not answer with a body',
          async () => {
            const thrown = await refusal;

            expect(thrown).toBeInstanceOf(Error);
            expect(thrown.message).toContain('unknown surf spot');
          },
        );

        then(
          '⚠️ the class is a bare Error, so no caller-fault arm can see it',
          async () => {
            // the exact predicate `genInternalServiceErrorMiddleware` consults
            expect(getIsConstraintError({ error: await refusal })).toEqual(
              false,
            );
          },
        );

        then(
          'so it reaches aws as a SERVER fault — CORRECT, per F35',
          async () => {
            const thrown = await refusal;

            expect({
              settlesAs: 'REJECTED — a real lambda FunctionError',
              errorName: thrown.name,
              errorMessage: thrown.message,
              readAsCallerFault: getIsConstraintError({ error: thrown }),
              // middy sets `e.originalError = request.error` when an onError middleware
              // throws (`@middy/core/index.js:146`); here the two are one object, so the
              // property is self-referential
              ownEnumerableKeys: Object.keys(thrown),
            }).toMatchSnapshot();
          },
        );
      });

      when(
        '[t1] a POSITIVE CONTROL — the same family, a zod-class rejection',
        () => {
          /**
           * .why this control is owed = without it, `[t0]`'s reject reads as a property of
           *      THIS FAMILY ("ask endpoints fail loud on bad input") rather than of the
           *      ERROR CLASS. this row shows the family answers a caller fault gracefully
           *      whenever the class is one `getIsConstraintError` knows
           *      (rule.require.positive-control-before-absence-claims)
           */
          then('the invocation SETTLES with a caller-fault body', async () => {
            const handler = genLambdaEndpoint({
              schema,
              invoke: async () => ({ booked: true }),
            });

            const answer = await handler(
              { spot: 42 } as unknown as { spot: string },
              createMockContext(),
            );

            expect(answer).toMatchObject({ errorType: 'BadRequestError' });
          });
        },
      );

      when('[t2] ONE escape hatch a consumer has today — `.refine()`', () => {
        /**
         * .why this row exists = `.refine()` is the SIMPLER of two ways a consumer writes a
         *      custom input guard where a caller fault still reports as a caller fault. so
         *      this row IS the record of that hatch — it is stated nowhere else a consumer
         *      reaches
         *
         * ⚠️ .and it is the WEAKER of the two = `.refine()` cannot RESHAPE, so it serves a
         *    consumer who only rejects. `[t3]` carries the one that guards AND reshapes
         *
         * ⛔ .and NO SIGNAL IS OWED — ruled 2026-09-21, and the reason is a proof = a dream
         *    once asked for a hint that names this hatch when a throw arrives from a
         *    transform frame. that dream is REJECTED, because a bare guard `throw` and a
         *    genuine null-deref BOTH arrive from one (`[t0]` measures the first; the probe
         *    that settled it measured the second). so the hint would steer a consumer with a
         *    real defect to disguise it as a caller fault — `rule.forbid.failhide`
         *
         *    ⇒ the SAME indistinguishability makes F35's server-fault default correct and
         *      every signal-rung unbuildable. F35 is ruled NO REPAIR OWED
         *
         * ⚠️ .the half worth the clamp = the consumer's OWN message survives verbatim. a
         *    workaround that reported `invalid_type` would technically be a 400 and would
         *    still lose the diagnosis, so `hint` alone is not what makes this hatch usable
         */
        const refinedSchema = {
          input: z.object({
            spot: z
              .string()
              .refine((raw) => raw === 'pipeline', 'unknown surf spot'),
          }),
          output: z.object({ booked: z.boolean() }),
        };

        then('it settles as a CALLER fault, message intact', async () => {
          const handler = genLambdaEndpoint({
            schema: refinedSchema,
            invoke: async () => ({ booked: true }),
          });

          const answer = await handler(
            { spot: 'trestles' },
            createMockContext(),
          );

          expect(answer).toMatchObject({
            errorType: 'BadRequestError',
            details: {
              issues: [
                {
                  path: 'spot',
                  message: 'unknown surf spot',
                  code: 'custom',
                },
              ],
            },
          });
        });
      });

      when(
        '[t3] the STRONGER hatch — `.transform()` + `ctx.addIssue()`',
        () => {
          /**
           * .why this row is owed beside `[t2]` = `.refine()` cannot RESHAPE, so it is no
           *      substitute for a consumer whose transform genuinely converts — which is the
           *      headline usecase of this whole sdk. `ctx.addIssue` + `z.NEVER` guards AND
           *      reshapes in one pass, and it lands the same caller fault
           *
           * 🔴 .this is what RE-GRADES F35 = that fulcrum read a bare-throw server fault as
           *    sdk behavior owed a repair, on the premise *"this repo declares no such
           *    vocabulary"*. zod declares it. this row is the proof it reaches our chain end
           *    to end, with no edit to `getValidatedInput` ⇒ the gap is DISCOVERABILITY,
           *    never behavior
           *
           * .note = it is the SAME mechanism `X.contract()` uses internally to report a
           *    constructor refusal as a zod issue, so the sdk's headline feature already
           *    rides this exact path. a consumer may too, and no record said so until now
           */
          const guardedInput = z.object({
            spot: z.string().transform((raw, ctx) => {
              if (raw !== 'pipeline') {
                ctx.addIssue({ code: 'custom', message: 'unknown surf spot' });
                return z.NEVER;
              }
              return raw.toUpperCase(); // the RESHAPE `.refine()` cannot do
            }),
          });

          then(
            'a bad value settles as a CALLER fault, message intact',
            async () => {
              const handler = genLambdaEndpoint({
                schema: {
                  input: guardedInput,
                  output: z.object({ spot: z.string() }),
                },
                invoke: async ({ event }) => ({ spot: event.spot }),
              });

              const answer = await handler(
                { spot: 'trestles' } as never,
                createMockContext(),
              );

              expect(answer).toMatchObject({
                errorType: 'BadRequestError',
                details: {
                  issues: [
                    {
                      path: 'spot',
                      message: 'unknown surf spot',
                      code: 'custom',
                    },
                  ],
                },
              });
            },
          );

          then('a good value reaches invoke RESHAPED', async () => {
            const handler = genLambdaEndpoint({
              schema: {
                input: guardedInput,
                output: z.object({ spot: z.string() }),
              },
              invoke: async ({ event }) => ({ spot: event.spot }),
            });

            const answer = await handler(
              { spot: 'pipeline' } as never,
              createMockContext(),
            );

            // 👍 the guard AND the reshape both landed — the half `[t2]` cannot reach
            expect(answer).toEqual({ spot: 'PIPELINE' });
          });
        },
      );
    },
  );

  given(
    '[case14] a `.pipe()` type-shift at the OUTPUT border, at HANDLER grain',
    () => {
      /**
       * ⚠️ .status = the defect is LIVE and NOT REPAIRED — tracked at
       *    `.dream/v2026_09_18.fix.published-face-contradicts-the-wire-for-a-pipe.md`, which is
       *    its one record. a consumer meets NO signal for it: the readme carried a caution for
       *    a while and the section was cut, since a readme states how to use the sdk and a
       *    defect written into one is a defect documented rather than repaired
       *
       * .what = that defect, demonstrated where a consumer meets it. it was
       *      clamped only at `getJsonSchemaFromZod.test.ts` — the schema renderer, three layers
       *      below a handler — so the suite proved the PUBLISHED FACE alone and never that the
       *      face disagrees with the bytes this sdk actually emits
       *
       * ⚠️ .why one case rather than two = the two halves are only a defect TOGETHER. a
       *    published face is fine until a wire value contradicts it, and a wire value is fine
       *    until something published a different type. so both rows read ONE handler, and the
       *    snapshot carries the pair side by side — which is the artifact a reader needs and
       *    the unit clamp cannot produce
       *
       * 🔴 .AND THE HANDLER-GRAIN RUN FOUND A THIRD FACET THE UNIT CLAMP COULD NOT SEE — the
       *    `invoke` CONTRACT is wrong too, not merely the published face. `TOutput` binds to
       *    the pipe's OUTPUT side (`number`), while `getValidatedOutput` parses the return
       *    through the pipe's INPUT side (`string`). so the compiler and the runtime demand
       *    OPPOSITE types from one function, and a consumer cannot satisfy both
       *    - it surfaced as a red `tsc`, never as a read — `[t0]`'s cast is what the compiler
       *      refused, and `[t1]` measures what befalls an author who obeys the compiler
       *      instead (rule.require.measure-the-value-you-emit)
       *
       * ⇒ raised as a nitpick by a peer at `enroll-impl-behavior-intent`, i011, beside the F35
       *   blocker, on the grounds that it is *"the same shape of gap: a live defect that ships
       *   in the readme with only unit-grain proof"*. correct — and the grain it asked for is
       *   what surfaced the third facet, which is the argument for the nitpick in one line
       */
      const schema = {
        input: z.object({ uuid: z.string() }),
        // the pipe's INPUT is a string; its OUTPUT is a number
        output: z.object({ waveHeight: z.string().pipe(z.coerce.number()) }),
      };

      when('[t0] the handler obeys the RUNTIME — it returns a string', () => {
        /**
         * ⚠️ .why ONE handler, built here = the case's whole claim is that the published
         *    face and the wire value CONTRADICT EACH OTHER. two handlers would be two
         *    subjects, and a reader could then answer "they were configured differently"
         *    — so the contradiction must be read off ONE construction to carry its claim
         *
         * .note = the two INVOCATIONS below are each legitimate and distinct: one sends
         *         `introspect` to read the published face, one sends a wire payload to
         *         read the emitted value. it is the SUBJECT that must be singular, never
         *         the call count
         */
        const handler = genLambdaEndpoint(
          {
            schema,
            /**
             * .as = the compiler demands a `number` here and the runtime demands a
             *       `string`. the cast is no convenience — it IS the defect, and it is
             *       the only way to express the arm a consumer must actually write
             * .removal = delete it the day `TOutput` binds to the schema's INPUT side
             */
            invoke: async () =>
              ({ waveHeight: '6' }) as unknown as { waveHeight: number },
          },
          { env: { access: 'prep' } },
        );

        then('the published face contradicts the wire', async () => {
          const published = (await handler(
            { introspect: 'schema' } as never,
            createMockContext(),
          )) as unknown as {
            output: { properties: { waveHeight: { type: string } } };
          };

          const onTheWire = await handler({ uuid: 'l-1' }, createMockContext());

          expect({
            publishedType: published.output.properties.waveHeight.type,
            wireValue: onTheWire.waveHeight,
            wireType: typeof onTheWire.waveHeight,
          }).toMatchSnapshot();
        });
      });

      when('[t1] the handler obeys the COMPILER — it returns a number', () => {
        then(
          'the invocation FAILS — so the declared type is unusable',
          async () => {
            const handler = genLambdaEndpoint(
              {
                schema,
                // exactly what `TOutput` declares, with no cast anywhere
                invoke: async () => ({ waveHeight: 6 }),
              },
              { env: { access: 'prep' } },
            );

            const thrown = await getError(
              handler({ uuid: 'l-1' }, createMockContext()),
            );

            expect({
              settlesAs: 'REJECTED',
              errorName: thrown.name,
              errorMessage: thrown.message,
            }).toMatchSnapshot();
          },
        );
      });
    },
  );
});
