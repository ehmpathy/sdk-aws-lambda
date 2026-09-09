import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { asParsedResponseBody } from '../../../__test_assets__/asParsedResponseBody';
import { asPayloadSnapshot } from '../../../__test_assets__/asPayloadSnapshot';
import { genLambdaEndpoint } from '../genLambdaEndpoint.forAskEndpoint/genLambdaEndpoint.forAskEndpoint';
import { asApiGatewayResponseSchema } from './asApiGatewayResponseSchema';
import { forApiGateway } from './genLambdaEndpoint.forApiGateway';

describe('genLambdaEndpoint.forApiGateway', () => {
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

  const createV1Event = (body: object): APIGatewayProxyEvent =>
    ({
      httpMethod: 'POST',
      path: '/users',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      queryStringParameters: null,
      pathParameters: null,
      requestContext: {
        requestId: 'req-123',
      },
    }) as unknown as APIGatewayProxyEvent;

  given('[case1] valid request', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: asApiGatewayResponseSchema({
        body: z.object({ id: z.string(), name: z.string() }),
      }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns response', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async ({ event }) => ({
            body: {
              id: 'user-123',
              name: event.name,
            },
          }),
        });

        return handler(createV1Event({ name: 'Alice' }), createMockContext());
      });

      then('it should return 200 with JSON body', () => {
        expect(result.statusCode).toBe(200);
        expect(asParsedResponseBody({ response: result })).toEqual({
          id: 'user-123',
          name: 'Alice',
        });
      });

      then('it should include security headers', () => {
        // note: @middy/http-security-headers applies different headers based on Content-Type
        // - X-Content-Type-Options, Strict-Transport-Security, etc are always applied
        // - X-Frame-Options, X-XSS-Protection are HTML-only (only for text/html responses)
        // since we return JSON, we check headers that are always applied
        expect(result.headers?.['X-Content-Type-Options']).toBe('nosniff');
        expect(result.headers?.['Strict-Transport-Security']).toContain(
          'max-age=',
        );
        expect(result.headers?.['Referrer-Policy']).toBe('no-referrer');
      });

      then('result matches snapshot', () => {
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });
    });
  });

  given('[case2] invalid request body', () => {
    const schema = {
      input: z.object({ email: z.string().email() }),
      output: asApiGatewayResponseSchema({
        body: z.object({ success: z.boolean() }),
      }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns error', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({ body: { success: true } }),
        });

        return handler(
          createV1Event({ email: 'not-an-email' }),
          createMockContext(),
        );
      });

      then('it should return 400 status', () => {
        expect(result.statusCode).toBe(400);
      });

      then('body contains validation error', () => {
        const body = asParsedResponseBody({ response: result });
        expect(body.errorMessage).toContain('validation failed');
        expect(body.errorType).toBe('BadRequestError');
      });

      /**
       * .what = the wish's *"leaves the lambda invocation a SUCCESS"* line, asserted DIRECTLY
       * .why = in lambda that distinction IS whether the handler's promise resolves or rejects:
       *        a rejection becomes a `FunctionError`, which cloudwatch counts and the caller
       *        retries (invariant.badrequesterror-not-lambda-error). the peer `then`s prove
       *        resolution incidentally while they NAME only status and body, so a regression to
       *        `throw` would surface as an opaque rejection rather than as this guarantee
       */
      then('the invocation SUCCEEDS, never a FunctionError', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({ body: { success: true } }),
        });

        await expect(
          handler(
            createV1Event({ email: 'not-an-email' }),
            createMockContext(),
          ),
        ).resolves.toMatchObject({ statusCode: 400 });
      });

      then('result matches snapshot', () => {
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });
    });
  });

  given('[case3] cors configured', () => {
    const schema = {
      input: z.object({ data: z.string() }),
      output: asApiGatewayResponseSchema({
        body: z.object({ result: z.string() }),
      }),
    };

    when('[t0] handler invoked', () => {
      then('it should include cors headers', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({ body: { result: 'ok' } }),
          cors: {
            origins: ['https://example.com'],
            headers: 'content-type,authorization',
            credentials: true,
          },
        });

        const event = createV1Event({ data: 'test' });
        // add Origin header to trigger cors
        (event.headers as Record<string, string>)['Origin'] =
          'https://example.com';

        const result = await handler(event, createMockContext());

        expect(result.headers?.['Access-Control-Allow-Origin']).toBe(
          'https://example.com',
        );
        expect(result.headers?.['Access-Control-Allow-Credentials']).toBe(
          'true',
        );

        // the whole payload, so a header nobody named is still visible in the diff
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });
    });
  });

  given('[case4] handler error', () => {
    const schema = {
      input: z.object({ value: z.number() }),
      output: asApiGatewayResponseSchema({
        body: z.object({ result: z.number() }),
      }),
    };

    when('[t0] handler throws', () => {
      then('it should return 500 with generic error body', async () => {
        // note: 500 responses include a generic error message and correlation id
        // but no internal details to avoid info leaks
        const handler = forApiGateway({
          schema,
          invoke: async () => {
            throw new Error('Database connection failed');
          },
        });

        const result = await handler(
          createV1Event({ value: 42 }),
          createMockContext(),
        );

        expect(result.statusCode).toBe(500);
        expect(result.body).toBeDefined();
        const body = asParsedResponseBody({ response: result });
        expect(body.errorMessage).toBe('internal server error');
        expect(body.errorType).toBe('InternalServiceError');
        expect(body.correlationId).toMatch(/^exid:/);
        // verify no internal details leaked
        expect(body.stackTrace).toBeUndefined();
        expect(result.body).not.toContain('Database connection');

        // the whole payload; the exid is MASKED rather than reduced to a boolean, so the
        // snapshot still shows that a correlationId reached the caller
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });

      /**
       * .what = the api-gateway family's SERVER-fault settle state, asserted directly
       * .why = this family answers the wire for BOTH faults, so a server fault must settle
       *        FULFILLED too — http demands a response, and a hung request is worse than a 500.
       *        that is why `genInternalServiceErrorMiddleware` takes a function here rather than
       *        the `false` its peer family passes. the settle state is a guarantee at FOUR
       *        points across the two families; the ask-endpoint pair is asserted in its own suite
       */
      then('the invocation is a SUCCESS even on a SERVER fault', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => {
            throw new Error('Database connection failed');
          },
        });

        await expect(
          handler(createV1Event({ value: 42 }), createMockContext()),
        ).resolves.toMatchObject({ statusCode: 500 });
      });
    });
  });

  given('[case5] access to the reconciled request', () => {
    const schema = {
      input: z.object({ action: z.string() }),
      output: asApiGatewayResponseSchema({
        body: z.object({ method: z.string(), path: z.string() }),
      }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns response', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async ({ rawEvent }) => ({
            body: {
              method: rawEvent.httpMethod,
              path: rawEvent.path,
            },
          }),
        });

        return handler(createV1Event({ action: 'test' }), createMockContext());
      });

      then('it should have access to rawEvent', () => {
        expect(result.statusCode).toBe(200);
        const body = asParsedResponseBody({ response: result });
        expect(body.method).toBe('POST');
        expect(body.path).toBe('/users');
      });

      then('result matches snapshot', () => {
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });
    });
  });

  given('[case6] deserialize body disabled', () => {
    const schema = {
      input: z.string(),
      output: asApiGatewayResponseSchema({
        body: z.object({ received: z.string() }),
      }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns response', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async ({ event }) => ({
            body: {
              received: event,
            },
          }),
          deserialize: { body: false },
        });

        return handler(
          createV1Event({ signature: 'webhook-data' }),
          createMockContext(),
        );
      });

      then('it should receive raw body string', () => {
        expect(result.statusCode).toBe(200);
        const body = asParsedResponseBody({ response: result });
        expect(body.received).toBe('{"signature":"webhook-data"}');
      });

      then('result matches snapshot', () => {
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });
    });
  });

  given('[case7] introspection request in prep env', () => {
    const schema = {
      input: z.object({ customerId: z.string() }),
      output: asApiGatewayResponseSchema({
        body: z.object({ name: z.string(), balance: z.number() }),
      }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns schema', async () => {
        const handler = forApiGateway(
          {
            schema,
            invoke: async () => ({ body: { name: 'test', balance: 100 } }),
          },
          { env: { access: 'prep' } },
        );

        return handler(
          createV1Event({ introspect: 'schema' }),
          createMockContext(),
        );
      });

      then('response status is 200', () => {
        expect(result.statusCode).toBe(200);
      });

      then('response contains input schema', () => {
        const body = asParsedResponseBody({ response: result });
        expect(body.input.type).toBe('object');
        expect(body.input.properties.customerId).toBeDefined();
      });

      then('response reports the whole response envelope', () => {
        const body = asParsedResponseBody({ response: result });
        expect(body.output.type).toBe('object');
        expect(body.output.properties.status).toBeDefined();
        expect(body.output.properties.headers).toBeDefined();
        expect(body.output.properties.body).toBeDefined();
      });

      then('the reported envelope keeps the body contract reachable', () => {
        const body = asParsedResponseBody({ response: result });
        expect(body.output.properties.body.properties.name).toBeDefined();
        expect(body.output.properties.body.properties.balance).toBeDefined();
      });

      then('response matches snapshot', () => {
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });
    });
  });

  given('[case8] introspection request in prod env', () => {
    const schema = {
      input: z.object({ id: z.string() }),
      output: asApiGatewayResponseSchema({
        body: z.object({ value: z.number() }),
      }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns error', async () => {
        const handler = forApiGateway(
          {
            schema,
            invoke: async () => ({ body: { value: 42 } }),
          },
          { env: { access: 'prod' } },
        );

        return handler(
          createV1Event({ introspect: 'schema' }),
          createMockContext(),
        );
      });

      then('returns 400 status', () => {
        expect(result.statusCode).toBe(400);
      });

      then('body indicates prep environment required', () => {
        const body = asParsedResponseBody({ response: result });
        expect(body.errorMessage).toContain('prep');
        expect(body.errorType).toBe('BadRequestError');
      });

      then('result matches snapshot', () => {
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });
    });
  });

  given('[case9] introspection request without env config', () => {
    const schema = {
      input: z.object({ id: z.string() }),
      output: asApiGatewayResponseSchema({
        body: z.object({ value: z.number() }),
      }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns error', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({ body: { value: 42 } }),
          // no env provided
        });

        return handler(
          createV1Event({ introspect: 'schema' }),
          createMockContext(),
        );
      });

      then('returns 400 status', () => {
        expect(result.statusCode).toBe(400);
      });

      then('body indicates env is required', () => {
        const body = asParsedResponseBody({ response: result });
        expect(body.errorMessage).toContain('env');
        expect(body.errorType).toBe('BadRequestError');
      });

      then('result matches snapshot', () => {
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });
    });
  });

  given('[case10] normal request with env config', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: asApiGatewayResponseSchema({
        body: z.object({ message: z.string() }),
      }),
    };

    when('[t0] handler invoked with normal payload', () => {
      const result = useThen('handler returns response', async () => {
        const handler = forApiGateway(
          {
            schema,
            invoke: async ({ event }) => ({
              body: { message: `Hello, ${event.name}!` },
            }),
          },
          { env: { access: 'prep' } },
        );

        return handler(createV1Event({ name: 'Bob' }), createMockContext());
      });

      then('passes through to handler as normal', () => {
        expect(result.statusCode).toBe(200);
        const body = asParsedResponseBody({ response: result });
        expect(body).toEqual({ message: 'Hello, Bob!' });
      });

      then('result matches snapshot', () => {
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the three wire shapes the fixed 200+json contract could not express
   * .why = a twilio webhook answers 204-no-body or twiml xml; a short-url answers 308+Location.
   *        each asserts the WIRE payload the chain emits, never only the handler's return
   */
  given('[case11] a handler that answers 204 with no body', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: asApiGatewayResponseSchema({ body: z.undefined() }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen(
        'handler returns a status-only response',
        async () => {
          const handler = forApiGateway({
            schema,
            invoke: async () => ({ status: 204 }),
          });

          return handler(createV1Event({ name: 'Kai' }), createMockContext());
        },
      );

      then('the wire carries 204', () => {
        expect(result.statusCode).toBe(204);
      });

      then('the wire carries no body', () => {
        expect(result.body).toBeUndefined();
      });

      then(
        'the wire carries no Content-Type — no bytes exist to describe',
        () => {
          expect(result.headers?.['Content-Type']).toBeUndefined();
          expect(result.headers?.['content-type']).toBeUndefined();
        },
      );

      then('result matches snapshot', () => {
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });
    });
  });

  given('[case12] a handler that answers 308 with a Location header', () => {
    const schema = {
      input: z.object({ slug: z.string() }),
      output: asApiGatewayResponseSchema({ body: z.undefined() }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns a redirect', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({
            status: 308,
            headers: { Location: 'https://ehmpath.com/surf/pipeline' },
          }),
        });

        return handler(
          createV1Event({ slug: 'pipeline' }),
          createMockContext(),
        );
      });

      then('the wire carries 308', () => {
        expect(result.statusCode).toBe(308);
      });

      then('the wire carries the Location header verbatim', () => {
        expect(result.headers?.Location).toBe(
          'https://ehmpath.com/surf/pipeline',
        );
      });

      then('result matches snapshot', () => {
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });
    });
  });

  given('[case13] a handler that answers an xml body', () => {
    const twiml = '<Response><Say>cowabunga</Say></Response>';
    const schema = {
      input: z.object({ From: z.string() }),
      output: asApiGatewayResponseSchema({ body: z.string() }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns xml', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({
            headers: { 'Content-Type': 'text/xml' },
            body: twiml,
          }),
        });

        return handler(
          createV1Event({ From: '+15551234567' }),
          createMockContext(),
        );
      });

      then('the wire carries 200, the defaulted status', () => {
        expect(result.statusCode).toBe(200);
      });

      then('the wire carries the xml bytes verbatim, never json-quoted', () => {
        expect(result.body).toBe(twiml);
      });

      then('the wire keeps the declared Content-Type', () => {
        expect(result.headers?.['Content-Type']).toBe('text/xml');
      });

      then('result matches snapshot', () => {
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = proves an empty response is refused at BOTH grains — compile and run
   * .why = `{}` reaches middy's normalizeHttpResponse, which applies `statusCode ??= 500`.
   *        the wire would say server-fault while the handler said success — a silent 500.
   *        `PickAny` closes it at compile time, and the assure closes it for a caller who
   *        arrives untyped
   *
   * .note = the compile half is carried by `@ts-expect-error`, which INVERTS: if `{}` ever
   *         became assignable, tsc fails on the unused directive. so `test:types` is the
   *         enforcement, and no type-test dependency is owed
   */
  given('[case14] a handler that returns an empty response', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: asApiGatewayResponseSchema({ body: z.undefined() }),
    };

    when('[t0] the empty return is declared', () => {
      then('the compiler refuses it — PickAny demands at least one key', () => {
        forApiGateway({
          schema,
          // @ts-expect-error — `{}` satisfies no key of PickAny<{ status, headers, body }>
          invoke: async () => ({}),
        });
      });
    });

    when('[t1] an untyped caller returns a non-response anyway', () => {
      then('the sdk fails loud rather than emit a silent 500', async () => {
        const handler = forApiGateway({
          schema,
          // .as = an untyped caller (plain js, an `any` boundary) can still reach this
          invoke: async () => 'not a response' as unknown as { status: number },
        });

        const result = await handler(
          createV1Event({ name: 'Kai' }),
          createMockContext(),
        );

        // the assure throws, so the error seam answers — never a 200 with junk
        expect(result.statusCode).toBe(500);
      });
    });
  });

  /**
   * .what = proves the aws-NATIVE wire shape is refused loudly rather than silently mangled
   * .why = the likeliest way a consumer breaks on upgrade. `status` is the one field whose name
   *        changed, so `{ statusCode: 404, body: JSON.stringify(x) }` — the wish's own `.ground`
   *        shape — satisfies the cardinality check via `'body' in input`, loses its 404 to
   *        `status ?? 200`, and has its body stringified a SECOND time. a 500 is the correct
   *        answer, not a 400: the handler author is at fault, not the http caller
   *        (invariant.badrequesterror-not-lambda-error)
   *
   * ⚠️ .measured = THE TYPE DOES NOT CATCH THIS. a tsc probe of four shapes:
   *
   *               { statusCode: 404 }             -> ⛔ TS2322, refused
   *               { header: {…} }                 -> ⛔ TS2322, refused
   *               { statusCode: 404, body: 'x' }  -> ✅ COMPILES CLEAN
   *               { status: 204 }                 -> ✅ compiles (the positive control)
   *
   *             `PickAny` refuses a response with NO valid key; once ANY valid key is present
   *             the excess keys go unchecked, because object-literal freshness is lost through
   *             the inferred `Promise<…>` return. so `isApiGatewayResponse.assure` is the ONLY
   *             guard here, for typed and untyped callers alike
   *             (rule.require.measure-the-value-you-emit)
   */
  given('[case15] a handler that returns the aws-native wire shape', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.any(),
    };

    when('[t0] it returns { statusCode, body } — the pre-upgrade habit', () => {
      const result = useThen('the handler answers', async () => {
        const handler = forApiGateway({
          schema,
          // .as = the legacy shape. ⚠️ the cast is cosmetic — see `.measured` above: the
          //       compiler does NOT refuse this shape, so the runtime assure is the guard
          invoke: async () =>
            ({
              statusCode: 404,
              body: JSON.stringify({ errorMessage: 'surfer not found' }),
            }) as unknown as { status: number },
        });

        return handler(createV1Event({ name: 'Kai' }), createMockContext());
      });

      then('the sdk refuses it loudly — a 500, never a false 200', () => {
        expect(result.statusCode).toBe(500);
        expect(result.statusCode).not.toBe(200);
      });

      then('the caller never receives the double-encoded body', () => {
        expect(result.body).not.toContain('surfer not found');
      });

      then('result matches snapshot', () => {
        expect(asPayloadSnapshot({ payload: result })).toMatchSnapshot();
      });
    });

    when('[t1] each deferred wire key is handed over on its own', () => {
      // the whole family shares one cause, so each member is checked, not just statusCode
      const keysOfWire = [
        'statusCode',
        'multiValueHeaders',
        'isBase64Encoded',
        'cookies',
      ];

      keysOfWire.map((key) =>
        then(`\`${key}\` is refused rather than dropped`, async () => {
          const handler = forApiGateway({
            schema,
            invoke: async () =>
              ({ [key]: 'whatever', body: { ok: true } }) as unknown as {
                status: number;
              },
          });

          const result = await handler(
            createV1Event({ name: 'Kai' }),
            createMockContext(),
          );

          expect(result.statusCode).toBe(500);
        }),
      );
    });
  });

  /**
   * .what = whether `handler.input` actually logs, measured through the REAL composed chain
   * .why = `genIoLoggerMiddleware`'s `before` reads `request.context.log`, which
   *        `genTrailMiddleware`'s `before` SETS — and `before` hooks run in ARRAY order, so at
   *        index 3 the ioLogger runs five entries ahead of trail at 8 and finds `undefined`.
   *        its guard is `if (log)`, so it returns silently (rule.require.measure-the-value-you-emit)
   *
   * .note = the observation channel is `logTranslate.input`, which the middleware calls ONLY
   *         inside that branch — so a spy there reports the branch rather than the log's output
   *
   * .note = `[t0]` is the POSITIVE CONTROL, and is what makes `[t1]`'s absence a defect rather
   *         than a broken probe: same middleware, same option, opposite array position
   *         (rule.require.positive-control-before-absence-claims)
   */
  given('[case16] the handler.input log, through the composed chain', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.any(),
    };

    when('[t0] the ask-endpoint family runs — the positive control', () => {
      const translated = useThen('the handler answers', async () => {
        const seen: unknown[] = [];

        const handler = genLambdaEndpoint({
          schema: { input: schema.input, output: z.any() },
          invoke: async () => ({ ok: true }),
          logTranslate: {
            input: (event) => {
              seen.push(event);
              return event;
            },
          },
        });

        await handler({ name: 'Kai' }, createMockContext());

        // a COUNT, never the array: `useThen` hands back a proxy that defers property access,
        // so `.length` reads `undefined` through it — on the control as well as the subject
        return { count: seen.length };
      });

      then('the log branch DOES run — so the probe can observe it', () => {
        expect(translated.count).toBe(1);
      });
    });

    when('[t1] the api-gateway family runs — the same option', () => {
      const translated = useThen('the handler answers', async () => {
        const seen: unknown[] = [];

        const handler = forApiGateway({
          schema,
          invoke: async () => ({ body: { ok: true } }),
          logTranslate: {
            input: (event) => {
              seen.push(event);
              return event;
            },
          },
        });

        await handler(createV1Event({ name: 'Kai' }), createMockContext());
        return { count: seen.length };
      });

      // ⚠️ the DEFECT, measured: pinned as an absence so the repair goes RED the moment it
      //    lands — a defect left deliberately in place must not be left UNMEASURED
      //    (rule.require.clamp-edge-cases)
      then(
        '⚠️ DEFECT: the log branch never runs — no handler.input, ever',
        () => {
          expect(translated.count).toBe(0);
        },
      );
    });
  });
});
