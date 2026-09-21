import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { genContextLogTrail } from 'sdk-logs';
import { genTempDir, getError, given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  asApiGatewayResponseSchema,
  askLambdaEndpoint,
  asLambdaEndpoint,
  asLambdaEndpointErrorEnvelopeAncient,
  asLambdaEndpointErrorEnvelopeContemp,
  asLambdaEndpointOutput,
  asLambdaEvent,
  BadRequestError,
  forApiGateway,
  genApiGatewayEventNormalizationMiddleware,
  genConstraintErrorMiddleware,
  genIoLoggerMiddleware,
  genLambdaEndpoint,
  genTrailMiddleware,
  genZodEventValidationMiddleware,
  genZodOutputValidationMiddleware,
  LambdaEndpointError,
  runLambdaEndpoint,
} from '../src/index';

/**
 * .note = the referenced invoke reaches the PUBLIC barrel now, never a private
 *   `__test_assets__` path. two faults were repaired at once:
 *
 *   1. `invokeHandlerForTest` was an unguarded twin of
 *      `runLambdaEndpoint.onReferenced` — no wire-fidelity strip, no dialect
 *      awareness, no absent-event guard, no callback-arity guard. so this
 *      acceptance suite exercised a code path no consumer can reach
 *   2. an acceptance test that imports a private path is not blackbox
 *      (`rule.require.acceptance.blackbox`: the ACTION must go through the
 *      contract). it read from `../src/index` for every assertion, then invoked
 *      through the back door
 *
 * ⚠️ **the twin was reported to carry zero importers, and it carried nine.** a
 *    grep scoped to `src/` missed both consumers here — the same peer-module
 *    blindness `[case9] [t4]` was added to catch, in the very round that added it.
 *
 * 🔴 .why every payload-format case declares `struct: { payload: 'ancient' }`
 *
 *    these cases hand-build the WIRE payload and assert on what the handler then
 *    receives. `onReferenced` frames CONTEMP by default — it wraps the event as
 *    `{ event, trail }` — so a payload that is already wrapped gets wrapped
 *    twice. the ancient dialect sends the event FLAT, which is what a test that
 *    supplies its own bytes actually means.
 *
 *    ⇒ measured: `[case5]`'s `{ event: { message }, trail: { exid } }` arrived at
 *      the handler as `{ event, trail }` rather than `{ message }`, and zod
 *      rejected it — *"expected string, received undefined"*.
 *
 * ⚠️ **and four of these six cases passed under the double wrap, by luck.** where
 *    the handler expects the WRAPPER shape (`[case9]`, which asserts
 *    `receivedKeys` holds `event` + `trail` + `extra`), the extra wrap is undone
 *    by the trail middleware and the round trip is a no-op. so the defect showed
 *    on two sites and was live on all six.
 *
 *    ⇒ the dialect is declared on every one of them rather than only where it
 *      went red — a case that passes for the wrong reason is a case that will
 *      surprise the next editor.
 */

describe('sdk-aws-lambda', () => {
  given('[case1] public exports', () => {
    when('[t0] imports evaluated', () => {
      then('genLambdaEndpoint should be callable', () => {
        expect(typeof genLambdaEndpoint).toBe('function');
      });

      then('forApiGateway should be callable', () => {
        expect(typeof forApiGateway).toBe('function');
      });

      then('askLambdaEndpoint should be callable', () => {
        expect(typeof askLambdaEndpoint).toBe('function');
      });

      then('LambdaEndpointError should be constructable', () => {
        const error = new LambdaEndpointError('test', {
          endpoint: asLambdaEndpoint({
            service: 'svc',
            access: 'prep',
            function: 'fn',
          }),
          exid: null,
        });
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('BadRequestError should be constructable', () => {
        const error = new BadRequestError('test');
        expect(error).toBeInstanceOf(Error);
      });
    });
  });

  given('[case2] middleware exports', () => {
    when('[t0] imports evaluated', () => {
      then('genTrailMiddleware should be callable', () => {
        expect(typeof genTrailMiddleware).toBe('function');
      });

      then('genZodEventValidationMiddleware should be callable', () => {
        expect(typeof genZodEventValidationMiddleware).toBe('function');
      });

      then('genZodOutputValidationMiddleware should be callable', () => {
        expect(typeof genZodOutputValidationMiddleware).toBe('function');
      });

      then('genIoLoggerMiddleware should be callable', () => {
        expect(typeof genIoLoggerMiddleware).toBe('function');
      });

      then('genConstraintErrorMiddleware should be callable', () => {
        expect(typeof genConstraintErrorMiddleware).toBe('function');
      });

      then(
        'genApiGatewayEventNormalizationMiddleware should be callable',
        () => {
          expect(typeof genApiGatewayEventNormalizationMiddleware).toBe(
            'function',
          );
        },
      );
    });
  });

  given('[case3] genLambdaEndpoint handler', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ message: z.string() }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }) => ({
        message: `Hello, ${event.name}!`,
      }),
    });

    const mockContext = {
      functionName: 'test',
      awsRequestId: 'req-123',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123:function:test',
      memoryLimitInMB: '128',
      logGroupName: '/aws/lambda/test',
      logStreamName: 'stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
      callbackWaitsForEmptyEventLoop: true,
    } as Context;

    when('[t0] invoked with valid input', () => {
      then('it should return result', async () => {
        const result = await handler({ name: 'World' }, mockContext);
        expect(result.message).toBe('Hello, World!');
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] invoked with invalid input', () => {
      then('it returns error response (not throw)', async () => {
        // BadRequestError = lambda succeeds, returns error response object
        const result = await handler(
          { name: 123 } as unknown as { name: string },
          mockContext,
        );
        expect(result).toMatchObject({ errorType: 'BadRequestError' });
        expect(
          (result as unknown as { errorMessage: string }).errorMessage,
        ).toContain('validation failed');
        expect(result).toMatchSnapshot();
      });
    });

    when('[t2] invoked with null input', () => {
      then('it returns error response for null', async () => {
        // BadRequestError = lambda succeeds, returns error response object
        const result = await handler(
          null as unknown as { name: string },
          mockContext,
        );
        expect(result).toMatchObject({ errorType: 'BadRequestError' });
        expect(result).toMatchSnapshot();
      });
    });

    when('[t3] output validation fails', () => {
      const badOutputHandler = genLambdaEndpoint({
        schema: {
          input: z.object({ name: z.string() }),
          output: z.object({ message: z.string(), count: z.number() }),
        },
        invoke: async ({ event }) => ({
          message: `Hello, ${event.name}!`,
          // count field absent - triggers output validation error
        }),
      });

      then('it throws UnexpectedCodePathError with validation details', async () => {
        const error = await getError(
          async () => badOutputHandler({ name: 'test' }, mockContext),
        );
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('output validation failed');
        expect(error.message).toMatchSnapshot();
      });
    });
  });

  given('[case4] forApiGateway handler', () => {
    const schema = {
      input: z.object({ data: z.string() }),
      output: asApiGatewayResponseSchema({
        body: z.object({ success: z.boolean() }),
      }),
    };

    const handler = forApiGateway({
      schema,
      invoke: async () => ({ body: { success: true } }),
    });

    const mockContext = {
      functionName: 'test',
      awsRequestId: 'req-123',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123:function:test',
      memoryLimitInMB: '128',
      logGroupName: '/aws/lambda/test',
      logStreamName: 'stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
      callbackWaitsForEmptyEventLoop: true,
    } as Context;

    const mockEvent = {
      httpMethod: 'POST',
      path: '/test',
      body: JSON.stringify({ data: 'test' }),
      headers: { 'Content-Type': 'application/json' },
      queryStringParameters: null,
      pathParameters: null,
      requestContext: { requestId: 'req-123' },
    } as unknown as APIGatewayProxyEvent;

    when('[t0] invoked with valid request', () => {
      then('it should return 200 with correct body and headers', async () => {
        const result = await handler(mockEvent, mockContext);
        expect(result.statusCode).toBe(200);
        // note: X-Content-Type-Options applies to all responses
        // note: X-Frame-Options only applies to HTML (iframe protection) - not relevant for JSON APIs
        expect(result.headers?.['X-Content-Type-Options']).toBe('nosniff');
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] invoked with invalid request body', () => {
      const invalidEvent = {
        ...mockEvent,
        body: JSON.stringify({ data: 123 }), // invalid type
      } as APIGatewayProxyEvent;

      then('it should return 400 with error details', async () => {
        const result = await handler(invalidEvent, mockContext);
        expect(result.statusCode).toBe(400);
        expect(result).toMatchSnapshot();
      });
    });

    when('[t2] invoked with malformed JSON body', () => {
      const malformedEvent = {
        ...mockEvent,
        body: '{ invalid json }',
      } as APIGatewayProxyEvent;

      then('it should return 400 with parse error', async () => {
        const result = await handler(malformedEvent, mockContext);
        expect(result.statusCode).toBe(400);
        expect(result).toMatchSnapshot();
      });
    });

    when('[t3] invoked with null body', () => {
      const nullBodyEvent = {
        ...mockEvent,
        body: null,
      } as APIGatewayProxyEvent;

      then('it should return 400 for null body', async () => {
        const result = await handler(nullBodyEvent, mockContext);
        expect(result.statusCode).toBe(400);
        expect(result).toMatchSnapshot();
      });
    });

    when('[t4] invoked with empty object body', () => {
      const emptyBodyEvent = {
        ...mockEvent,
        body: JSON.stringify({}),
      } as APIGatewayProxyEvent;

      then('it should return 400 for empty body', async () => {
        const result = await handler(emptyBodyEvent, mockContext);
        expect(result.statusCode).toBe(400);
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case5] payload format compatibility - wrapped format', () => {
    const schema = {
      input: z.object({ message: z.string() }),
      output: z.object({ echo: z.string(), exid: z.string() }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }, { log }) => ({
        echo: event.message,
        exid:
          log.trail?.exid ??
          'no-exid',
      }),
    });

    when('[t0] invoked with wrapped format { event, trail }', () => {
      // note: the raw payload sent to lambda is { event, trail }
      // invokeHandlerForTest wraps it again, so we use event: wrappedPayload
      const wrappedPayload = {
        event: { message: 'hello from wrapped' },
        trail: { exid: 'exid:test-wrapped-123' },
      };

      const result = useThen('handler completes', async () =>
        asLambdaEndpointOutput(
          await runLambdaEndpoint.onReferenced({
            handler,
            event: wrappedPayload,
            struct: { payload: 'ancient' },
          }),
        ),
      );

      then('handler receives unwrapped event', () => {
        expect(result.echo).toBe('hello from wrapped');
      });

      then('exid is extracted from trail', () => {
        expect(result.exid).toBe('exid:test-wrapped-123');
      });

      then('result matches snapshot', () => {
        expect(typeof result.echo).toBe('string');
        expect(typeof result.exid).toBe('string');
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] invoked with wrapped format without exid', () => {
      const wrappedPayload = {
        event: { message: 'hello no exid' },
        trail: {},
      };

      const result = useThen('handler completes', async () =>
        asLambdaEndpointOutput(
          await runLambdaEndpoint.onReferenced({
            handler,
            event: wrappedPayload,
            struct: { payload: 'ancient' },
          }),
        ),
      );

      then('handler receives unwrapped event', () => {
        expect(result.echo).toBe('hello no exid');
      });

      then('exid is generated', () => {
        expect(result.exid).toMatch(/^exid:/);
      });

      then('result structure matches snapshot', () => {
        expect(typeof result.echo).toBe('string');
        expect(result.exid.startsWith('exid:')).toBe(true);
        expect(result).toMatchSnapshot({
          exid: expect.stringMatching(/^exid:/),
        });
      });
    });
  });

  given('[case6] payload format compatibility - raw format (legacy)', () => {
    const schema = {
      input: z.object({ message: z.string() }),
      output: z.object({ echo: z.string(), exid: z.string() }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }, { log }) => ({
        echo: event.message,
        exid:
          log.trail?.exid ??
          'no-exid',
      }),
    });

    when('[t0] invoked with raw payload (ancient caller)', () => {
      const rawPayload = { message: 'hello from legacy' };

      const result = useThen('handler completes', async () =>
        asLambdaEndpointOutput(
          await runLambdaEndpoint.onReferenced({
            handler,
            event: rawPayload,
            struct: { payload: 'ancient' },
          }),
        ),
      );

      then('handler receives the raw payload', () => {
        expect(result.echo).toBe('hello from legacy');
      });

      then('exid is generated', () => {
        expect(result.exid).toMatch(/^exid:/);
      });

      then('result structure matches snapshot', () => {
        expect(typeof result.echo).toBe('string');
        expect(result.exid.startsWith('exid:')).toBe(true);
        expect(result).toMatchSnapshot({
          exid: expect.stringMatching(/^exid:/),
        });
      });
    });
  });

  given('[case7] payload format compatibility - user data collision', () => {
    const schema = {
      input: z.object({ trail: z.string(), destination: z.string() }),
      output: z.object({
        receivedTrail: z.string(),
        receivedDestination: z.string(),
        exidGenerated: z.boolean(),
      }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }, { log }) => ({
        receivedTrail: event.trail,
        receivedDestination: event.destination,
        exidGenerated:
          log.trail?.exid?.startsWith('exid:') ?? false,
      }),
    });

    when('[t0] user event has trail as string (not our trail object)', () => {
      const userPayload = {
        trail: 'mountain path',
        destination: 'summit',
      };

      const result = useThen('handler completes', async () =>
        asLambdaEndpointOutput(
          await runLambdaEndpoint.onReferenced({
            handler,
            event: userPayload,
            struct: { payload: 'ancient' },
          }),
        ),
      );

      then('user trail data is preserved', () => {
        expect(result.receivedTrail).toBe('mountain path');
      });

      then('user destination data is preserved', () => {
        expect(result.receivedDestination).toBe('summit');
      });

      then('exid is generated (not extracted from user trail)', () => {
        expect(result.exidGenerated).toBe(true);
      });

      then('result matches snapshot', () => {
        expect(result.receivedTrail).toBe('mountain path');
        expect(result.receivedDestination).toBe('summit');
        expect(result.exidGenerated).toBe(true);
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case8] payload format compatibility - SQS-style events', () => {
    const schema = {
      input: z.object({
        Records: z.array(
          z.object({
            messageId: z.string(),
            body: z.string(),
          }),
        ),
      }),
      output: z.object({
        processedCount: z.number(),
        exidGenerated: z.boolean(),
      }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }, { log }) => ({
        processedCount: event.Records.length,
        exidGenerated:
          log.trail?.exid?.startsWith('exid:') ?? false,
      }),
    });

    when('[t0] invoked with SQS event structure', () => {
      const sqsPayload = {
        Records: [
          { messageId: 'msg-1', body: '{"data": 1}' },
          { messageId: 'msg-2', body: '{"data": 2}' },
        ],
      };

      const result = useThen('handler completes', async () =>
        asLambdaEndpointOutput(
          await runLambdaEndpoint.onReferenced({
            handler,
            event: sqsPayload,
            struct: { payload: 'ancient' },
          }),
        ),
      );

      then('all records are processed', () => {
        expect(result.processedCount).toBe(2);
      });

      then('exid is generated', () => {
        expect(result.exidGenerated).toBe(true);
      });

      then('result matches snapshot', () => {
        expect(result.processedCount).toBe(2);
        expect(result.exidGenerated).toBe(true);
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case9] payload format - extra keys beyond event and trail', () => {
    const schema = {
      input: z.object({
        event: z.object({ message: z.string() }),
        trail: z.object({ exid: z.string() }),
        extra: z.string(),
      }),
      output: z.object({
        receivedKeys: z.array(z.string()),
        exidGenerated: z.boolean(),
      }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }, { log }) => ({
        receivedKeys: Object.keys(event),
        exidGenerated:
          log.trail?.exid?.startsWith('exid:') ?? false,
      }),
    });

    when('[t0] payload has event, trail, and extra keys', () => {
      const payloadWithExtra = {
        event: { message: 'hello' },
        trail: { exid: 'exid:should-not-extract' },
        extra: 'field',
      };

      const result = useThen('handler completes', async () =>
        asLambdaEndpointOutput(
          await runLambdaEndpoint.onReferenced({
            handler,
            event: payloadWithExtra,
            struct: { payload: 'ancient' },
          }),
        ),
      );

      then('handler receives full payload (not unwrapped)', () => {
        expect(result.receivedKeys).toContain('event');
        expect(result.receivedKeys).toContain('trail');
        expect(result.receivedKeys).toContain('extra');
      });

      then('exid is generated (not extracted)', () => {
        expect(result.exidGenerated).toBe(true);
      });

      then('result matches snapshot', () => {
        expect(result.receivedKeys).toContain('event');
        expect(result.receivedKeys).toContain('trail');
        expect(result.receivedKeys).toContain('extra');
        expect(result.exidGenerated).toBe(true);
        expect(result).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = case=11 at the ACCEPTANCE grain — `asLambdaEvent` composed with
   *         `runLambdaEndpoint`, both reached from the public barrel
   * .why = ledger row 5. `asLambdaEvent` is a demoed critipath with excellent unit
   *        coverage (`asLambdaEvent.test.ts` clamps wire fidelity for all five
   *        sources) and, until now, **no blackbox reference anywhere**.
   *
   * 🔴 .a unit test cannot make this claim, and that is why the row stayed open
   *
   * the unit suite proves each factory emits the shape aws emits. it says naught
   * about whether that shape SURVIVES the operation a consumer will feed it to —
   * and `onReferenced` json-strips both directions, so a factory field that cannot
   * cross the wire would be silently dropped between the two.
   *
   * ⇒ so the acceptance claim is a COMPOSITION claim: the two public operations
   *   agree on a shape. that is exactly the class of defect
   *   `rule.require.acceptance.blackbox` exists to catch, and it is invisible to
   *   either operation's own tests.
   *
   * .note = raised at i013–i015 r010 `enroll-impl-behavior-intent`, three rounds in
   *   a row, as the last row on the ledger that no credential blocks.
   *
   * 🔴 .renumbered `[case10]` → `[case19]`
   *
   * this block's own docblock already named its subject as *"case=11 at the
   * ACCEPTANCE grain"*, yet it borrowed the vision's `[case10]` handle (the
   * serialized local-lookup cell) — a number an audit could not resolve to
   * this block's real subject. `[case19]` is a free feature-wide number
   * (`rule.require.experience-catalog-evolution`).
   */
  given('[case19] an sqs event, built by the factory and run through the endpoint', () => {
    const task = { jobUuid: 'job-abc', kind: 'notify' as const };

    // a CONSUMER-shaped handler — it reads `Records`, which is what an sqs source
    // delivers. this is the endpoint kind the sqs source selects
    // (`define.lambda-event-source`), never an ask-endpoint.
    const handler = async (event: {
      Records: { body: string; messageId: string }[];
    }): Promise<{ bodies: unknown[]; messageIds: string[]; count: number }> => ({
      bodies: event.Records.map((record) => JSON.parse(record.body)),
      messageIds: event.Records.map((record) => record.messageId),
      count: event.Records.length,
    });

    when('[t0] the factory-built event crosses the referenced boundary', () => {
      const result = useThen('the handler completes', async () =>
        asLambdaEndpointOutput(
          await runLambdaEndpoint.onReferenced({
            handler,
            // the ancient dialect, because an sqs envelope IS the event — a
            // consumer handler is never handed a `{ event, trail }` wrapper by aws
            //
            // ✅ bite-probed: flip this to `'contemp'` and all three assertions of
            //    [t0] go red — the wrapper hides `Records` from the handler. that is
            //    the exact defect that bit nine migrated blackbox sites at i013, and
            //    it is why this clamp is on the COMPOSITION rather than the factory.
            struct: { payload: 'ancient' },
            event: asLambdaEvent.fromSqs({
              messages: [JSON.stringify(task)],
            }),
          }),
        ),
      );

      then('the payload survives the round trip intact', () => {
        expect(result.bodies).toEqual([task]);
      });

      // ⇒ the composition claim, stated as an assertion rather than as prose:
      //   every field the factory emits must be json-representable, or the strip
      //   would drop it before the handler sees it.
      then('the factory emits a wire-crossable envelope', () => {
        expect(result.count).toEqual(1);
        expect(result.messageIds).toHaveLength(1);
        expect(typeof result.messageIds[0]).toEqual('string');
      });

      // the factory's messageId is index-derived (`asExampleUuid`), never
      // random, so the whole journey output is deterministic and snap-safe
      then('the journey output matches snapshot', () => {
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] the factory builds a batch', () => {
      const result = useThen('the handler completes', async () =>
        asLambdaEndpointOutput(
          await runLambdaEndpoint.onReferenced({
            handler,
            struct: { payload: 'ancient' },
            event: asLambdaEvent.fromSqs({
              messages: [
                JSON.stringify(task),
                JSON.stringify({ ...task, kind: 'digest' }),
              ],
            }),
          }),
        ),
      );

      then('every record reaches the handler, in order', () => {
        expect(result.count).toEqual(2);
        expect(result.bodies).toEqual([task, { ...task, kind: 'digest' }]);
      });

      // aws gives each record a distinct messageId; a factory that reused one
      // would let a de-dupe bug pass unnoticed in every consumer that tests here.
      then('each record carries a distinct messageId', () => {
        expect(new Set(result.messageIds).size).toEqual(2);
      });

      then('the journey output matches snapshot', () => {
        expect(result).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the api-gateway factory, composed through the PUBLIC referenced boundary
   * .why = `[case19]` proves the composition claim for `fromSqs` — and sqs is the
   *        source that never had a defect. `fromApiGateway` is the source F10 and
   *        `case=11` exist FOR: the incumbent fixture omits `requestContext` and
   *        `Accept`, so a handler answers 500 before any schema runs
   *        (`ehmpathy/sdk-aws-lambda#18`).
   *
   * 🔴 **so the one shape with a shipped defect was the one shape with no
   *    composition proof, and the shape with no history had two.** the coverage
   *    was inverted against the risk.
   *
   * ⚠️ .why the unit test did not already make this claim
   *
   * `asLambdaEvent.test.ts [case11]` exercises the same factory and calls
   * `(handler as any)(event, asLambdaContext())` DIRECTLY — so it skips
   * `onReferenced` and, with it, the json strip. a factory field that survives a
   * direct call and dies in the strip passes there and fails here.
   *
   * 🟡 **and `[case4]` is not this claim either.** it hand-builds its own
   *    `mockEvent`, predates the factory, and never routes through the public
   *    operation — it clamps `forApiGateway`, never the composition.
   *
   * .note = raised at i020 r010 `enroll-impl-behavior-intent`, item 1.
   *
   * 🔴 .renumbered `[case12]` → `[case20]`
   *
   * this is the same case=11 composition claim as `[case19]` above, for the
   * `fromApiGateway` source — it borrowed the catalog's `[case12]` handle
   * (the discovered bad-import cell), which an audit could not resolve to
   * this block's real subject. `[case20]` is a free feature-wide number
   * (`rule.require.experience-catalog-evolution`).
   */
  /**
   * .what = reads the wire body as a string, and refuses an absent one
   * .why = `ApiGatewayResponse.body` is OPTIONAL — a handler may answer with a status
   *   alone — so the wire type is `string | undefined`. every assertion in `[case20]`
   *   is about a response that carries one, so an absent body is a defect to surface
   *   rather than a case to coalesce away (`rule.forbid.failhide`).
   */
  const asWireBody = (response: { body?: string }): string =>
    response.body ??
    MalfunctionError.throw('the response carries no body', { response });

  given('[case20] an api-gateway event, built by the factory and RUN', () => {
    const handler = forApiGateway({
      schema: {
        input: z.object({ slug: z.string().min(1) }),
        output: asApiGatewayResponseSchema({
          body: z.object({ slug: z.string(), found: z.boolean() }),
        }),
      },
      invoke: async ({ event }) => ({
        body: { slug: event.slug, found: true },
      }),
    });

    when('[t0] the factory-built event crosses the referenced boundary', () => {
      const result = useThen('the handler completes', async () =>
        asLambdaEndpointOutput(
          await runLambdaEndpoint.onReferenced({
            handler,
            // ancient, because an api-gateway envelope IS the event — aws never
            // hands an http handler a `{ event, trail }` wrapper. the same reason
            // `[case19]` declares it for sqs.
            struct: { payload: 'ancient' },
            event: asLambdaEvent.fromApiGateway({
              body: { slug: 'surf-lesson' },
              httpMethod: 'POST',
            }),
          }),
        ),
      );

      // 🔴 the defect this whole family exists to prevent. a fixture that omits
      //    `requestContext` derefs undefined inside the normalization middleware,
      //    and the handler answers 500 before the schema is reached.
      //
      // ✅ bite-probed: make `asLambdaEvent.fromApiGateway` return `undefined`
      //    for `requestContext` and **3 of this case's 6 assertions go red** —
      //    this one on a 500, and both of `[t0]`'s body reads with it. ⇒ the
      //    clamp exercises the exact `#18` defect rather than merely standing
      //    beside it (`rule.require.clamp-edge-cases`).
      then('the schema RUNS — the response is not a 500', () => {
        expect(result.statusCode).toEqual(200);
      });

      // ⇒ the composition claim: every field the factory emits must survive the
      //   json strip, or the handler sees a different event than the unit test did.
      then('the body survives the strip and reaches the handler', () => {
        expect(JSON.parse(asWireBody(result))).toEqual({
          slug: 'surf-lesson',
          found: true,
        });
      });

      // the `Accept` header is what middy's serializer matches on. absent it, the
      // body is handed back as an OBJECT and every `JSON.parse(result.body)` in
      // every consumer fails — the second half of `#18`.
      then('body is a STRING, so a consumer can parse it', () => {
        expect(typeof result.body).toEqual('string');
      });

      then('the journey output matches snapshot', () => {
        expect({
          statusCode: result.statusCode,
          body: JSON.parse(asWireBody(result)),
        }).toMatchSnapshot();
      });
    });

    when('[t1] the body fails the schema', () => {
      const result = useThen('the handler completes', async () =>
        asLambdaEndpointOutput(
          await runLambdaEndpoint.onReferenced({
            handler,
            struct: { payload: 'ancient' },
            event: asLambdaEvent.fromApiGateway({
              body: { slug: '' },
              httpMethod: 'POST',
            }),
          }),
        ),
      );

      // 🟡 a 400 rather than a 500 is the whole tell. a 500 here would mean the
      //    fixture broke the handler; a 400 means the handler ran and judged.
      then('it answers 400 — the handler ran and rejected', () => {
        expect(result.statusCode).toEqual(400);
      });

      // masked to statusCode + errorType — no exid is pinned on this call, so
      // the raw error message would carry a freshly-generated one and permadiff
      then('the negative-path journey output matches snapshot', () => {
        const errorBody = JSON.parse(asWireBody(result)) as {
          errorType?: string;
        };
        expect({
          statusCode: result.statusCode,
          errorType: errorBody.errorType,
        }).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the hint-preservation guarantee, exercised through the PUBLIC barrel
   * .why = every guard that runs AHEAD of the delegation in
   *        `runLambdaEndpoint.onSerialized` keeps its `hint`, because none of
   *        them meets the `.catch(asWireFunctionErrorPayload)` that flattens a
   *        handler's own throw into the three fields aws puts on the wire.
   *
   * 🟡 **the two blocks trip two DIFFERENT guards, and that is the design.**
   *    `[t0]` reaches `assertHandlerIsRunnable`'s arity check; `[t1]` reaches
   *    `getOneHandlerFromServerlessYml`'s absent-export check, one step earlier.
   *    ⇒ the claim under clamp is the CLASS — *"a guard ahead of the delegation
   *    keeps its structured hint"* — and a clamp on one guard would pin the
   *    instance, which is the defect the extraction was made to close.
   *
   * 🔴 .why an integration test could not make this claim
   *
   * `runLambdaEndpoint.onSerialized.integration.test.ts` clamps it well — and it
   * imports `onSerialized` from `'./runLambdaEndpoint.onSerialized'`, an INTERNAL
   * path. so the clamp holds the operation and says naught about what
   * `src/index` hands a consumer.
   *
   * ⇒ a barrel that wrapped, re-ordered, or re-caught on its way out would leave
   *   every one of those assertions green while the shipped surface lost the
   *   field. that is a **composition** claim — the barrel and the operation agree
   *   on an error shape — and it is invisible to either one's own tests
   *   (`rule.require.acceptance.blackbox`).
   *
   * 🔴 **and the drive has already been bitten by this exact class, twice.**
   *   `[case9] [t4]` was added because a `src/`-scoped grep could not see nine
   *   `blackbox/` consumers; `[case19]` because `asLambdaEvent` had unit coverage
   *   and no blackbox reference. both were a guard that could not see past its
   *   own scope, and an internal import is the same blind spot with a shorter
   *   radius.
   *
   * .note = raised at i015+ r010 `enroll-impl-behavior-intent`, as the one
   *   actionable item left on a review whose other two are the wisher's.
   */
  /**
   * 🔴 **F19 at the CONTRACT grain — closed by F22.**
   *
   * the silent-mismatch hole was first clamped at i024, in
   * `isLambdaEndpointErrorEnvelope.test.ts`. the review's charge was that a UNIT
   * clamp is the wrong grain for it:
   *
   * > *"a contract-facing hazard like this wants regression-visible coverage,
   * > not just a unit clamp"* (`rule.require.test-coverage-by-grain`)
   *
   * ✅ **the hole is now shut at the boundary, not merely policed.** F22 stamps
   * the codec version onto the contemp serde tag and splits the narrow into a
   * dialect-fixed pair — `asLambdaEndpointErrorEnvelopeContemp` reads the tag,
   * `asLambdaEndpointErrorEnvelopeAncient` reads the flat shape. a caller can no
   * longer misdeclare a dialect as a type parameter, because there is no type
   * parameter: the dialect is the function they pick. hand the ancient narrow a
   * contemp value and it THROWS — it inspects the real shape, never a caller's
   * erased annotation.
   *
   * ⚠️ this case once asserted the KNOWN LIMIT (a silent `undefined`, F19 branch
   * B). F22 turned that limit into a loud throw, so the case now proves the
   * CLOSURE at the grain a migrant meets it: a real run output, through the
   * published barrel (F22 resolves F19 + F20).
   */
  given('[case13] a caller who MISDECLARES the dialect on the narrow', () => {
    const handler = genLambdaEndpoint({
      schema: {
        input: z.object({ uuid: z.string().uuid() }),
        output: z.object({ uuid: z.string() }),
      },
      invoke: async ({ event }) => ({ uuid: event.uuid }),
    });

    when(
      '[t0] the run rejects, and the caller picks the WRONG dialect narrow',
      () => {
        // a real run, through the barrel, on the contemp default
        const envelope = useThen('the endpoint returns an envelope', async () =>
          runLambdaEndpoint.onReferenced({
            event: { uuid: 'not-a-uuid' },
            handler,
          }),
        );

        then('the CORRECT narrow reads the message — the F9 guarantee', () => {
          expect(
            asLambdaEndpointErrorEnvelopeContemp(envelope).error.class,
          ).toEqual('ConstraintError');
        });

        then('the WRONG narrow THROWS loudly — F22 shut the failhide', () => {
          // 🔴 the hole F19 named, now closed at the boundary. the ancient
          //    narrow inspects the real shape — a contemp value carries no flat
          //    `errorType`, so it is refused with a ConstraintError rather than
          //    handed back as a silent `undefined`.
          //
          //    ⇒ `rule.forbid.failhide` satisfied: the mismatch fails LOUD, at
          //      the grain a consumer meets it (F22, resolves F19 + F20).
          expect(() =>
            asLambdaEndpointErrorEnvelopeAncient(envelope),
          ).toThrow();
        });

        then(
          'and the ENVELOPE itself is intact — the narrow refused, the run did not',
          () => {
            // 🟡 the half that keeps this honest. the throw above comes from the
            //    NARROW, which refuses a shape it does not recognize — not from
            //    the run, which kept every byte. the contemp envelope is intact.
            expect(envelope).toMatchObject({
              error: { class: 'ConstraintError' },
            });

            // masked to class alone — no exid is pinned on this call, so the
            // raw envelope's message would carry a freshly-generated one
            expect({
              class: asLambdaEndpointErrorEnvelopeContemp(envelope).error
                .class,
              ancientNarrowThrows: (() => {
                try {
                  asLambdaEndpointErrorEnvelopeAncient(envelope);
                  return false;
                } catch {
                  return true;
                }
              })(),
            }).toMatchSnapshot();
          },
        );
      },
    );
  });

  given('[case11] a handler this util cannot run, met at the LOCAL locus', () => {
    /**
     * .what = provisions a temp repo with a serverless.yml and a real handler file
     * .why = the local locus reads a serverless.yml off disk, so a hermetic test
     *        must supply one (`rule.require.hermetic-tests`)
     *
     * .note = this is the `genLocalRepo` shape from
     *   `runLambdaEndpoint.onSerialized.integration.test.ts`. it is a SECOND copy
     *   rather than a lift — two usages is the wet side of
     *   `rule.prefer.wet-over-dry`, and a lift into `src/__test_assets__` would
     *   hand a blackbox suite an internal it does not otherwise need.
     */
    const genLocalRepo = (input: {
      service: string;
      function: string;
      handlerSource: string;
    }): string => {
      const dir = genTempDir({ slug: 'sdk-contract-local-locus' });
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'temp' }));
      writeFileSync(
        join(dir, 'serverless.yml'),
        [
          `service: ${input.service}`,
          'functions:',
          `  ${input.function}:`,
          `    handler: handler.${input.function}`,
        ].join('\n'),
      );
      writeFileSync(join(dir, 'handler.js'), input.handlerSource);
      return dir;
    };

    const CONTEXT = {
      ...genContextLogTrail({ trail: null, env: null }),
      env: { access: 'test' as const },
    };

    when('[t0] the serverless.yml points at a CALLBACK-style handler', () => {
      // 🔴 the migrant's shape. `getOneHandlerFromServerlessYml` checks
      //    `typeof handler === 'function'` and never arity, so a callback handler
      //    passes the lookup and is refused by the arity guard one step later.
      //
      // ⚠️ .why the error is WRAPPED in a plain object rather than returned bare
      //
      //  `useThen` hands back a proxy whose target is filled by
      //  `Object.assign(drawer, toolbox)` (`test-fns/useThen.js`), and
      //  `Object.assign` copies own ENUMERABLE properties only. an `Error` keeps
      //  `message`, `stack`, and `metadata` off that list, so a bare
      //  `useThen(…, () => getError(…))` yields a plain `{}`:
      //
      //  | assertion | on the bare proxy |
      //  |---|---|
      //  | `toBeInstanceOf(ConstraintError)` | ✕ `Received constructor: Object` |
      //  | `metadata.hint` | ✕ `undefined` |
      //
      //  ⇒ measured — all five assertions of this block went red that way. the
      //    wrap puts the error at `caught.error`, a plain-object key that
      //    `Object.assign` does copy, so the reference survives whole.
      const caught = useThen('the run is refused', async () => ({
        error: await getError(
          runLambdaEndpoint.onSerialized(
            {
              which: { service: 'svc-example', function: 'goSurf' },
              event: { ocean: 'pacific' },
              at: 'local',
              from: genLocalRepo({
                service: 'svc-example',
                function: 'goSurf',
                handlerSource:
                  'exports.goSurf = function (event, context, callback) { callback(null, {}); };',
              }),
            },
            CONTEXT,
          ),
        ),
      }));

      // 🟡 these two have NO teeth, and they are kept for exactly that reason —
      //    they are what a reader would naturally reach for, and the probe below
      //    shows both survive the defect. to omit them would leave the next
      //    author free to re-derive them and believe the clamp was doubled.
      then('it is a ConstraintError, so the caller is named as the fixer', () => {
        expect(caught.error).toBeInstanceOf(ConstraintError);
        expect(caught.error.message).toContain('callback-style');
      });

      // 🔴 the assertions with TEETH, and the probe says they are the only ones.
      //
      //  the wash keeps `stackTrace`, and `helpful-errors` serializes metadata
      //  into `.message` — so the hint TEXT rides along either way. what dies
      //  under the wash is the STRUCTURED field, which is the author's one
      //  chance to see the fix without a trace read.
      //
      //  ✅ **bite-probed** (`rule.require.clamp-edge-cases`): comment out
      //     `assertHandlerIsRunnable` in `runLambdaEndpoint.onSerialized.ts` so
      //     only the referenced twin's guard fires — inside the delegation, and
      //     therefore behind the wash:
      //
      //     | assertion | under the defect |
      //     |---|---|
      //     | `toBeInstanceOf(ConstraintError)` | ✅ still green — the hydration re-classes it |
      //     | `message` contains `'callback-style'` | ✅ still green — the text rides in `stackTrace` |
      //     | **`metadata.hint` present** | 🔴 **red** — `{ endpoint, exid, stackTrace }` |
      //     | **`metadata.stackTrace` absent** | 🔴 **red** — the wash's own fingerprint |
      //
      //  ⇒ 56 passed / 2 failed under the probe, 58 / 0 on revert. so a clamp
      //    built only from the two natural assertions would have been GREEN on
      //    the very defect this block exists to bar.
      then('the hint survives as a STRUCTURED field, unwashed', () => {
        const metadata = (
          caught.error as unknown as { metadata?: { hint?: unknown } }
        ).metadata;
        expect(metadata).toHaveProperty('hint');
        expect(String(metadata?.hint)).toContain('answer with a promise');
      });

      // the wash's own fingerprint. it casts into `{ errorMessage, errorType,
      // stackTrace }` — so a `stackTrace` key here means the guard fired INSIDE
      // the delegation, which is the arrangement this clamp exists to bar.
      then('the error never passed through the wire-error cast', () => {
        const metadata = (
          caught.error as unknown as { metadata?: Record<string, unknown> }
        ).metadata;
        expect(metadata).not.toHaveProperty('stackTrace');

        // masked to class + presence booleans — no exid is pinned on this
        // call, so the raw hint/message would carry a freshly-generated one
        expect({
          class: caught.error.constructor.name,
          messageNamesCallbackStyle:
            caught.error.message.includes('callback-style'),
          hintPresent: Boolean(
            (caught.error as unknown as { metadata?: { hint?: unknown } })
              .metadata?.hint,
          ),
          stackTraceAbsent: !(
            'stackTrace' in
            ((caught.error as unknown as { metadata?: object }).metadata ??
              {})
          ),
        }).toMatchSnapshot();
      });
    });

    when('[t1] the serverless.yml names an export that is absent', () => {
      // 🔴 a DIFFERENT guard, one step earlier — `getOneHandlerFromServerlessYml`
      //    rather than `assertHandlerIsRunnable`. it is here deliberately: the
      //    guarantee under clamp is not *"this one guard keeps its hint"* but
      //    *"every guard AHEAD of the delegation does"*, and a clamp on a single
      //    guard is a clamp on the instance rather than the class — the defect
      //    this whole arrangement was extracted to close.
      const caught = useThen('the run is refused', async () => ({
        error: await getError(
          runLambdaEndpoint.onSerialized(
            {
              which: { service: 'svc-example', function: 'goSurf' },
              event: { ocean: 'pacific' },
              at: 'local',
              from: genLocalRepo({
                service: 'svc-example',
                function: 'goSurf',
                handlerSource: 'exports.paddleOut = async () => ({});',
              }),
            },
            CONTEXT,
          ),
        ),
      }));

      // ✅ and this block stayed GREEN under `[t0]`'s probe, correctly — this
      //    guard runs in the lookup, ahead of the delegation either way. ⇒ the
      //    probe is not vacuous across the block: it reaches the one guard it
      //    disabled and leaves the peer alone (`rule.forbid.failhide`).
      then('the error names the absent export, never a bare TypeError', () => {
        expect(caught.error).toBeInstanceOf(ConstraintError);
        expect(caught.error.message).toContain('exports no such function');
      });

      then('its hint survives as a structured field too', () => {
        const metadata = (
          caught.error as unknown as { metadata?: Record<string, unknown> }
        ).metadata;
        expect(metadata).toHaveProperty('hint');
        expect(metadata).not.toHaveProperty('stackTrace');

        expect({
          class: caught.error.constructor.name,
          messageNamesAbsentExport: caught.error.message.includes(
            'exports no such function',
          ),
          hintPresent: Boolean(metadata?.hint),
          stackTraceAbsent: !('stackTrace' in (metadata ?? {})),
        }).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the other three factories, composed through the PUBLIC boundary
   * .why = 🔴 **three of the five sources had no handler that ever consumed
   *        them** — `fromSns`, `fromKinesis`, `fromS3` were exercised only as
   *        shape assertions and snapshots.
   *
   *        `[case19]` and `[case20]` already compose `fromSqs` and
   *        `fromApiGateway`; these three had no composition clamp at all.
   *
   * ## ⚠️ what this does NOT buy — corrected by a probe, against the charge
   *
   * r010 argued the gap is that a shape test cannot see `case=11`'s failure mode.
   * **a bite-probe disproved that half.** `fromKinesis` was broken to skip its
   * base64 encode:
   *
   * | the suite | verdict |
   * |---|---|
   * | `[case21][t1]`, this block | 🔴 3 red |
   * | `asLambdaEvent.test.ts` — shape + snapshot | 🔴 **2 red, also** |
   *
   * ⇒ **a whole-object snapshot catches any change to an emitted field**, so the
   *   shape suite is not blind the way the charge implied.
   *
   * ## ✅ what it DOES buy, stated narrowly
   *
   * a snapshot clamps **change**, never **correctness on the day it was written**
   * — a field authored wrong is snapshotted wrong, and both stay green together.
   * what the round trip adds is the three properties no snapshot asserts:
   *
   * - every emitted field is **json-crossable** — it survives `asWireStripped`,
   *   so a `Date` or a class instance cannot be written in unnoticed
   * - the **dialect** is right — `[case19]`'s own probe shows a `'contemp'` frame
   *   hides `Records` from the handler, and a snapshot of the event cannot see it
   * - a **consumer can actually read** the payload out of the envelope, at the
   *   path aws puts it
   *
   * 🔴 **and the honest bound: these handlers encode no independent knowledge of
   *    the aws contract.** they were written from the same premises that wrote the
   *    factories, so they cannot catch a shape that is wrong in both. only
   *    `sdk-aws-lambda#13`'s schemas, or a real deployed source, could.
   *
   * .note = raised at peer review i033 r010, the first lane in 33 rounds to reach
   *   it — nine rubric lanes had overflowed since i023. ⇒ the ROUND a defect
   *   surfaces is evidence about the INSTRUMENT. the charge's conclusion holds and
   *   its stated reason did not survive the probe.
   *
   * 🔴 .renumbered `[case14]` → `[case21]`
   *
   * the same case=11 composition claim as `[case19]`/`[case20]` above, for
   * the sns/kinesis/s3 sources — it borrowed the catalog's `[case14]` handle
   * (the discovered F6 escape-hatch cell). `[case21]` is a free feature-wide
   * number (`rule.require.experience-catalog-evolution`).
   */
  given('[case21] the sns, kinesis, and s3 factories', () => {
    // each handler READS the payload out of its own envelope shape, so a
    // factory that emitted a wire-hostile or misplaced field fails here rather
    // than merely differs from a snapshot
    when('[t0] an sns event crosses the referenced boundary', () => {
      const result = useThen('the handler completes', async () =>
        asLambdaEndpointOutput(
          await runLambdaEndpoint.onReferenced({
            struct: { payload: 'ancient' },
            handler: async (event: {
              Records: { Sns: { Message: string; MessageId: string } }[];
            }) => ({
              messages: event.Records.map((r) => JSON.parse(r.Sns.Message)),
              ids: event.Records.map((r) => r.Sns.MessageId),
            }),
            event: asLambdaEvent.fromSns({
              messages: [JSON.stringify({ notice: 'swell inbound' })],
            }),
          }),
        ),
      );

      then('the payload reaches the handler at Records[].Sns.Message', () => {
        expect(result.messages).toEqual([{ notice: 'swell inbound' }]);
      });

      then('every field the factory emits survives the wire strip', () => {
        expect(typeof result.ids[0]).toEqual('string');
      });

      // the factory's MessageId is index-derived (`asExampleUuid`), so the
      // whole journey output is deterministic and snap-safe
      then('the journey output matches snapshot', () => {
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] a kinesis event crosses the referenced boundary', () => {
      const result = useThen('the handler completes', async () =>
        asLambdaEndpointOutput(
          await runLambdaEndpoint.onReferenced({
            struct: { payload: 'ancient' },
            handler: async (event: {
              Records: { kinesis: { data: string; sequenceNumber: string } }[];
            }) => ({
              // the handler decodes, exactly as a real kinesis consumer must
              data: event.Records.map((r) =>
                JSON.parse(
                  Buffer.from(r.kinesis.data, 'base64').toString('utf8'),
                ),
              ),
              sequences: event.Records.map((r) => r.kinesis.sequenceNumber),
            }),
            event: asLambdaEvent.fromKinesis({
              records: [JSON.stringify({ datum: 42 })],
            }),
          }),
        ),
      );

      // 🔴 this is the assertion a shape test cannot make: it proves the base64
      //    the factory writes is base64 the CONSUMER can decode, rather than
      //    merely a string that looks like it
      then('the base64 the factory wrote is decodable by the handler', () => {
        expect(result.data).toEqual([{ datum: 42 }]);
      });

      then('the sequence number survives as a string', () => {
        expect(typeof result.sequences[0]).toEqual('string');
      });

      then('the journey output matches snapshot', () => {
        expect(result).toMatchSnapshot();
      });
    });

    when('[t2] an s3 event crosses the referenced boundary', () => {
      const result = useThen('the handler completes', async () =>
        asLambdaEndpointOutput(
          await runLambdaEndpoint.onReferenced({
            struct: { payload: 'ancient' },
            handler: async (event: {
              Records: {
                s3: { bucket: { name: string }; object: { key: string } };
              }[];
            }) => ({
              refs: event.Records.map((r) => ({
                bucket: r.s3.bucket.name,
                key: r.s3.object.key,
              })),
            }),
            event: asLambdaEvent.fromS3({
              objects: [{ bucket: 'surf-photos', key: 'pipeline/a.jpg' }],
            }),
          }),
        ),
      );

      // s3 is the one source that carries a REFERENCE rather than a payload, so
      // what a consumer needs is the bucket and key — nested two deep, which is
      // exactly where an envelope shape goes wrong unnoticed
      then('the bucket and key reach the handler where aws puts them', () => {
        expect(result.refs).toEqual([
          { bucket: 'surf-photos', key: 'pipeline/a.jpg' },
        ]);
      });

      then('the journey output matches snapshot', () => {
        expect(result).toMatchSnapshot();
      });
    });
  });

  /**
   * 🔴 a handler behind this org's OWN decorator convention, through the public
   *    barrel — the arrangement 252 call sites across 23 repos already use.
   *
   * `rule.require.hook-wrapper-pattern` composes a handler as
   * `export const h = withLogTrail(_h)`, and every such wrapper in the population
   * relays with a rest parameter:
   *
   *     const wrapped = (...args: Parameters<T>) => logic(...args);
   *
   * ⚠️ **that resets `Function.prototype.length` to `0`**, which is what F21 is
   *    about. the fulcrum records the HOLE it opens; this block records the other
   *    half — that the convention itself composes, which is the part a migrant
   *    depends on and no acceptance test had asserted.
   *
   * 🟡 **and the distinction is why this is not a frozen defect.** the shape F21
   *    warns about is a *callback* handler behind such a wrapper, and a test that
   *    asserted THAT slips past the guard would clamp a known limit as a
   *    guarantee (`rule.forbid.test-intent-violations`). this asserts the
   *    opposite and legitimate case: a *promise* handler behind the same wrapper
   *    runs correctly, errors and all.
   *
   * ⇒ so the wrapper's arity erasure is documented as a hazard in one place and
   *   clamped as a supported convention in another, and neither promises the
   *   third case.
   */
  given('[case15] a handler behind a spread-relay wrapper', () => {
    /**
     * .what = the `rule.require.hook-wrapper-pattern` shape, verbatim
     * .why = a bespoke wrapper would prove only that THIS file's closure works.
     *        the relay below is byte-for-byte the one `withRetry`, `withTimeout`,
     *        `withBottleneck`, and `withLogTrail` each use.
     */
    const withDecorator =
      <TArgs extends unknown[], TOut>(logic: (...args: TArgs) => TOut) =>
      (...args: TArgs): TOut =>
        logic(...args);

    when('[t0] the wrapped handler answers with a value', () => {
      const result = useThen('the run succeeds', async () =>
        runLambdaEndpoint.onReferenced({
          event: { spot: 'pipeline' },
          handler: withDecorator(
            genLambdaEndpoint({
              schema: {
                input: z.object({ spot: z.string() }),
                output: z.object({ swell: z.string() }),
              },
              invoke: async ({ event }) => ({ swell: `${event.spot}:6ft` }),
            }),
          ),
        }),
      );

      then('the wrapper is transparent — the output arrives whole', () => {
        // 🔴 the teeth. `assertHandlerIsRunnable` reads `.length`, which this
        //    wrapper reports as 0 — so a guard that refused on any value but
        //    `>= 3` would reject the org's own convention outright, and this
        //    assertion is what would go red if it ever did.
        expect(asLambdaEndpointOutput(result)).toEqual({
          swell: 'pipeline:6ft',
        });
      });

      then('the journey output matches snapshot', () => {
        expect(asLambdaEndpointOutput(result)).toMatchSnapshot();
      });
    });

    when('[t1] the wrapped handler rejects its input', () => {
      const result = useThen('the run answers an envelope', async () =>
        runLambdaEndpoint.onReferenced({
          event: { spot: 42 } as unknown as { spot: string },
          handler: withDecorator(
            genLambdaEndpoint({
              schema: {
                input: z.object({ spot: z.string() }),
                output: z.object({ swell: z.string() }),
              },
              invoke: async ({ event }) => ({ swell: `${event.spot}:6ft` }),
            }),
          ),
        }),
      );

      // the error path matters more than the happy one here: the guard, the
      // dialect switch, and the envelope narrow all sit downstream of the
      // wrapper, so this is what proves the relay is transparent END TO END
      // rather than only on the success arm.
      then('the constraint envelope survives the wrapper intact', () => {
        expect(asLambdaEndpointErrorEnvelopeContemp(result).error.class).toEqual(
          'ConstraintError',
        );
      });

      // masked to class alone — no exid is pinned on this call, so the raw
      // message would carry a freshly-generated one and permadiff
      then('the journey error class matches snapshot', () => {
        expect({
          class: asLambdaEndpointErrorEnvelopeContemp(result).error.class,
        }).toMatchSnapshot();
      });
    });
  });
});
