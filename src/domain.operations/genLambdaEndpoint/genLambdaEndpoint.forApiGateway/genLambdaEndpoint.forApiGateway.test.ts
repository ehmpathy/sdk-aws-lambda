import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DomainEntity, DomainLiteral, withImmute } from 'domain-objects';
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

  /**
   * .what = crosses the two grains that never met — a BODY-LESS response envelope, driven
   *         through a real `{ introspect: 'schema' }` request
   * .why = each half was covered and the CROSSING was not, so the defect was invisible to a
   *        green suite. `[case7]`–`[case9]` are the only introspection cases and each declares a
   *        real `z.object` body; `[case11]` / `[case12]` / `[case14]` are the only body-less
   *        cases and none of them sends an introspect payload. the deployed acceptance suite
   *        never reaches this family at all
   *        (rule.require.sweep-the-defect-class — the axis this suite had not swept)
   *
   * ⚠️ .measured, by probe, BEFORE the repair = `z.undefined()` threw
   *              `Undefined cannot be represented in JSON Schema`, and the throw was
   *              POSITION-INDEPENDENT: it fired the same at the schema root, under a bare
   *              `.optional()`, and buried inside the envelope's `body` slot. so a handler that
   *              followed the readme's own headline example crashed `getAllLambdaContracts` for
   *              the whole service the moment introspection ran in prep
   *              (rule.require.measure-the-value-you-emit)
   *
   * ✅ .REPAIRED, and this case is what grades the repair = `getJsonSchemaFromZod` now renders
   *    an absent position as `{ not: {} }` via a `toJSONSchema` `override`, so all three
   *    candidates below publish. the case is kept, and its verdicts flipped, because it is the
   *    only place that cross is driven through a REAL introspection request on this family
   *
   * .note = the throw was io-INDEPENDENT, so it predated the `{ io: 'input' }` repair rather
   *         than followed from it — `undefinedProcessor` guards on `ctx.unrepresentable` alone
   *         (`zod/v4/core/json-schema-processors.cjs:120-124`), never on the face. that is why
   *         the repair had to reach for `unrepresentable` and could not ride on the face
   */
  given(
    '[case17] a body-less envelope, met by an introspection request',
    () => {
      const inputSchema = z.object({ name: z.string() });

      const asIntrospectionOf = async (body: z.ZodType) => {
        const handler = forApiGateway(
          {
            schema: {
              input: inputSchema,
              output: asApiGatewayResponseSchema({ body }),
            },
            invoke: async () => ({ status: 204 }),
          },
          { env: { access: 'prep' } },
        );
        return handler(
          createV1Event({ introspect: 'schema' }),
          createMockContext(),
        );
      };

      when(
        '[t0] the body is `z.never()` — an equivalent body-less shape',
        () => {
          const result = useThen('the handler answers', async () =>
            asIntrospectionOf(z.never()),
          );

          then('introspection SUCCEEDS — no service-wide crash', () => {
            expect(result.statusCode).toBe(200);
          });

          then(
            'the published body slot claims that no body is ever carried',
            () => {
              const body = asParsedResponseBody({ response: result });
              expect(body.output.properties.body).toEqual({ not: {} });
            },
          );
        },
      );

      when(
        '[t1] the body is `z.undefined()` — the NAMED idiom, and the one that used to crash',
        () => {
          const result = useThen('the handler answers', async () =>
            asIntrospectionOf(z.undefined()),
          );

          // ⚠️ this row read `expect(result.statusCode).toBe(500)` until the override landed,
          //    and it was GREEN — the crash was real and reached through this family's own
          //    envelope. it is flipped here rather than deleted, so the next reader meets the
          //    repair at the exact surface that measured the defect
          then('introspection SUCCEEDS — the crash is retired', () => {
            expect(result.statusCode).toBe(200);
          });

          /**
           * ⚠️ .why the WHOLE document and not only the body slot = a peer asked what a
           *    deploying engineer actually reads here, and the answer was unmeasured. the
           *    prior snapshot pinned the generic internal-500 envelope, which named neither
           *    the endpoint nor the offending field; this one pins what replaced it
           *
           * ⇒ the snapshot is the claim, so a regression that quietly re-empties the body
           *   slot to `{}` — the rubber-stamp shape — goes red here rather than ships
           */
          then('and the published contract is snapped, in full', () => {
            // .note = a DENYLIST, never an allowlist: the spread keeps every key the envelope
            //         carries. a `{ output }` pick would have read as thorough and shown no
            //         field a later change ADDED
            //         (rule.require.snapshots-deny-volatile-not-allow-expected)
            const body = JSON.parse(result.body ?? '{}');
            expect(body).toMatchSnapshot();
          });

          then(
            'the body slot claims that no body is ever carried — as `z.never()` does',
            () => {
              const body = asParsedResponseBody({ response: result });
              expect(body.output.properties.body).toEqual({ not: {} });
            },
          );
        },
      );

      when('[t2] the body is `z.any()` — the rubber-stamp', () => {
        const result = useThen('the handler answers', async () =>
          asIntrospectionOf(z.any()),
        );

        /**
         * ⚠️ .why this row is load-bearing beyond the rubber-stamp it names = the repair
         *    disarms zod's refusal globally (`unrepresentable: 'any'`) and re-arms it in an
         *    `override` that refuses any position that renders EMPTY. `z.any()` renders empty
         *    HONESTLY, and `asApiGatewayResponseSchema` wraps every body in `.optional()` —
         *    so the first draft met an `optional` node holding `{}` and threw, and this row
         *    went 200 -> 500. it is the clamp on `getIsNodeWithInner`
         */
        then('it publishes, and publishes an empty claim', () => {
          expect(result.statusCode).toBe(200);
          const body = asParsedResponseBody({ response: result });
          expect(body.output.properties.body).toEqual({});
        });
      });
    },
  );

  /**
   * .what = the branch's HEADLINE guarantee, through THIS family's real exported handler
   * .why = the peer clamp at `[case11]` of `genLambdaEndpoint.forAskEndpoint.test.ts` proves it
   *        for the direct-invoke family. that proof does NOT transfer: the two families differ
   *        in exactly the axis at risk — this one carries an extra normalization step, parses a
   *        `body` slot rather than the event itself, and its own builder states the chain order
   *        is "LOAD-BEARING, ON TWO AXES" where "a break on either axis no-ops silently: no
   *        throw, no log, no type error"
   *        (rule.require.retest-the-model-on-every-family)
   *
   * .note = the assertion runs INSIDE `invoke`, never on the returned value — the return crosses
   *         output validation and the serializer afterwards, so a check on the result would
   *         grade the wrong border
   *
   * ⚠️ .PROVEN by revert, against the exact silent regression this family's builder warns of —
   *    drop the write-back at `genZodBodyValidationMiddleware.ts:56` (`event.body = inputAfter`),
   *    so validation still RUNS and its coerced result is discarded:
   *
   *      🔴 4 red — every `[t0]` instance row: depth-0, `.nested`, the array element, and the
   *         one under the PLAIN wrapper
   *      🟢 `[t1]` stayed GREEN — the 400 still fires, so a suite that clamped only the REFUSAL
   *         would have reported this regression as no regression at all
   *      🟢 the positive control stayed GREEN too — the 204 still comes back, which is what
   *         makes the four reds a lost COERCE rather than a broken chain
   *      🟢 the `signup.note` row stayed GREEN, and that one is the SHARPEST of the three. the
   *         raw parsed body still carries the note, so that row grades the WRAPPER's survival
   *         and never the coerce — which is precisely why it is a second row rather than an
   *         extra assertion folded into the `spot` one
   *
   *    ⇒ the three greens are the half worth the note (rule.require.clamp-edge-cases)
   *
   * ⚠️ .A SECOND REVERT, for the plain-wrapper row alone — `spot: SurfSpot.contract()` ->
   *    `SurfSpot.schema` (the raw schema, no coerce):
   *
   *      🔴 1 red — the `spot` instance row, and ONLY it
   *      🟢 the other three instance rows stayed GREEN, which is what makes this row a proof
   *         about the WRAPPER axis rather than a duplicate of the depth-0 one
   *
   * ⚠️ .and the red COUNT above was measured, never predicted. a prior draft of this block read
   *    `🔴 3 red` and stayed at 3 when a fourth instance row landed — a count carried across an
   *    edit measures the tree it was written against. `[case19]` on this same file already
   *    recorded that exact lesson, and `[case20]` re-learned it
   */
  given(
    '[case18] a domain object in the schema, through the wired handler',
    () => {
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
          /**
           * ⚠️ .why the PLAIN WRAPPER is here = it is the evidence the wish was written from,
           *    and it was absent from this case for three rounds.
           *    `configureProxyPhoneNumber.ts` hand-hydrated `assignment.agent` — a dobj one
           *    level under a PLAIN (non-dobj) object, itself `.nullable()`. the peer
           *    `forAskEndpoint [case11]` carries all three shapes; this family carried two,
           *    with no note of the third
           *
           * ⇒ and it is the shape a top-level-only design would miss, which is exactly why
           *   the wish's `.acceptance` names it: *"hydration reaches NESTED domain objects,
           *   not only the top level"*. a suite that proves depth-0 and array-nested and stops
           *   has proven the two cheapest of the three
           *
           * ⚠️ .why the ask family's proof does NOT carry = this file's own doc block already
           *    says so for the other two shapes (`rule.require.retest-the-model-on-every-family`),
           *    and the reason is the same one: this family runs an extra normalization step
           *    before validation that the ask family never reaches. a sweep bounded to two of
           *    three sub-shapes is the same class of miss as one bounded to one of two
           *    families (`rule.require.sweep-the-defect-class`)
           */
          signup: z
            .object({
              spot: SurfSpot.contract(), // depth 1, under a PLAIN wrapper
              note: z.string(), // a plain peer key, to prove the wrapper is untouched
            })
            .nullable(),
        }),
        output: asApiGatewayResponseSchema({ body: z.undefined() }),
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
          note: 'paddle out at dawn',
        },
      };

      when('[t0] the handler is invoked with the wire shape', () => {
        const seen = useThen('the handler answers', async () => {
          const captured: {
            surfer?: unknown;
            home?: unknown;
            crewFirst?: unknown;
            signupSpot?: unknown;
            signupNote?: unknown;
            signup?: unknown;
            status?: number;
          } = {};

          const handler = forApiGateway({
            schema,
            invoke: async ({ event }) => {
              // ⚠️ captured INSIDE invoke, deliberately — see the `.note` above
              captured.surfer = event.surfer;
              captured.home = event.surfer.home;
              captured.crewFirst = event.crew[0];
              captured.signup = event.signup;
              captured.signupSpot = event.signup?.spot;
              captured.signupNote = event.signup?.note;
              return { status: 204 };
            },
          });

          const result = await handler(
            createV1Event(payload),
            createMockContext(),
          );
          captured.status = result.statusCode;
          return captured;
        });

        // ⚠️ the POSITIVE CONTROL, and it is what makes the three below evidence rather than a
        //    broken probe: a chain that threw before `invoke` would leave every capture undefined
        //    and each `toBeInstanceOf` would fail for the WRONG reason
        //    (rule.require.positive-control-before-absence-claims)
        then('the chain reached invoke at all — the 204 came back', () => {
          expect(seen.status).toBe(204);
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

        then(
          'a dobj under a PLAIN wrapper arrives as an instance — the wish’s own shape',
          () => {
            expect(seen.signupSpot).toBeInstanceOf(SurfSpot);
          },
        );

        /**
         * ⚠️ .why this row and not the one above alone = the claim is that coerce reaches
         *    INTO a plain wrapper, so it owes both halves. the `spot` row alone would still
         *    pass if the coerce had replaced the whole `signup` value with something of its
         *    own — the peer key is what proves the wrapper came through untouched
         */
        then('and its plain peer key survives the descent untouched', () => {
          expect(seen.signupNote).toEqual('paddle out at dawn');
          expect(seen.signup).not.toBeInstanceOf(SurfSpot);
          expect(seen.signup).not.toBeInstanceOf(Surfer);
        });

        /**
         * ⚠️ .why a SNAPSHOT beside all five rows above = every one of them is a
         *    `toBeInstanceOf` or a single-key `toEqual`, and NEITHER SHAPE CAN SEE AN EXTRA
         *    KEY. a coerce that attached a field of its own to the value handed to `invoke`
         *    would leave all five GREEN — the prototype is still right and the named key is
         *    still right. so the rows above clamp what the coerce PRESERVES and say not one
         *    word about what it might ADD
         *
         * ⇒ this file's own peer at the OUTPUT border already learned that lesson the hard
         *   way: `local.dobjWire.acceptance.test.ts` exists because `withImmute` attaches an
         *   own `clone` property, and only a serialization caught it. this is that same
         *   question asked at the INPUT border, where no case had asked it at all
         *
         * .why SERIALIZED rather than the raw capture = a snapshot of a live class instance
         *      renders as its prototype name and hides the fields; the serialized form is the
         *      shape a reader can actually audit (rule.require.snapshots.[lesson] — the repo
         *      asks for BOTH a snapshot and assertions, and this file pairs them everywhere
         *      else)
         */
        then(
          'and the whole coerced input a handler receives is snapped',
          () => {
            expect(
              JSON.parse(
                JSON.stringify({
                  surfer: seen.surfer,
                  crewFirst: seen.crewFirst,
                  signup: seen.signup,
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

          const handler = forApiGateway({
            schema,
            invoke: async () => {
              reached = true;
              return { status: 204 };
            },
          });

          const result = await handler(
            createV1Event({
              ...payload,
              surfer: { uuid: 'u-1', handle: 'kai', home: {} },
            }),
            createMockContext(),
          );

          return {
            reached,
            status: result.statusCode,
            payload: asPayloadSnapshot({ payload: result }),
          };
        });

        then(
          'it is refused at the border — a 400, the caller is at fault',
          () => {
            expect(outcome.status).toBe(400);
          },
        );

        then('and invoke is never reached at all', () => {
          expect(outcome.reached).toEqual(false);
        });

        /**
         * ⚠️ .why this row = the wish's `.acceptance` asks that a dobj which fails its own
         *    validation "fails LOUD at the boundary". a bare `400` proves the REFUSAL and says
         *    not one word about the LOUD — a chain that answered `400` with an empty body, or
         *    with a message that never named `home`, would satisfy the row above exactly
         *
         * ⇒ so the status row grades the verdict and this one grades the DIAGNOSTIC, which is
         *   the half a caller actually reads. snapped rather than asserted on a substring,
         *   because the whole body is the contract (`asPayloadSnapshot` denies the volatile
         *   exid and keeps every other key —
         *   rule.require.snapshots-deny-volatile-not-allow-expected)
         *
         * 🟡 .what this snapshot PINS that may surprise a reader = the refusal carries
         *    `Content-Type` and NOT ONE owasp header, where every 200 in this file carries the
         *    full set. that is KNOWN and documented at `genLambdaEndpoint.forApiGateway.ts:313`
         *    (`⛔ 6 @middy/http-security-headers -> so NO owasp on a 4xx/5xx`) — a hook-order
         *    property of the chain, never a defect this case introduced. it is pre-existing on
         *    every 400/500 snapshot here, which is the positive control that says so
         *
         * ⇒ so the value of this row is larger than the message: it CLAMPS that known gap, so
         *   the day the order is repaired, the repair surfaces in a diff rather than silently
         */
        then('and the body it answers with names the field, loudly', () => {
          expect(outcome.payload).toMatchSnapshot();
        });
      });
    },
  );

  given(
    '[case19] a nullable domain object in the response BODY, onto the wire',
    () => {
      /**
       * ⚠️ .why this case exists = the FAMILY axis of a sweep miss a peer named. the gap it
       *    reported was "a nullable dobj at the output border", and the mirror it asked for is
       *    `forAskEndpoint [case12]`. this is the second axis of that same cause: THIS family
       *    had no dobj at its output border at ALL — nullable or otherwise
       *    (rule.require.sweep-the-defect-class — the cause named no family, so it has two)
       *
       * ⚠️ .why it is NOT a copy of the ask-family mirror = the two borders run different code
       *    past validation. `forAskEndpoint` hands the validated value back as the response, so
       *    an instance arrives at the caller as an instance. HERE the body crosses
       *    `httpResponseSerializer`, which `JSON.stringify`s it — so this case grades the
       *    SERIALIZE that the ask family never reaches, and a dobj whose props lost their
       *    enumerable flag would empty the body while every type still fit
       *    (the peer canary is `genIoLoggerMiddleware.test.ts [case8]`)
       *
       * ⚠️ .PROVEN BY REVERT (rule.require.clamp-edge-cases):
       *
       *      revert                                  | result
       *      ----------------------------------------|----------------------------------------
       *      `.nullable()` -> bare `.contract()`      | 🔴 2 red — `[t1]`'s two assertion rows.
       *                                               |    `statusCode` 200 -> 500, and the body
       *                                               |    becomes the 3-key error envelope
       *
       *    ⇒ `[t0]` stays green under that revert. a suite that clamped only the PRESENT arm
       *      would have reported the absent arm as covered
       *
       * ⚠️ .the count is 2 HERE and 3 on the ask twin, and the gap is the case's own subject.
       *    i predicted 3 by carry-over and measured 2. the twin THROWS out of the handler, so
       *    `useThen`'s own "the handler answers" row reds with the rest; HERE the error chain
       *    catches the `MalfunctionError` and converts it to a 500 RESPONSE, so the handler
       *    answers fine and only the assertions bite. ⇒ the caller-visible harm differs by
       *    family — a raised fault there, a silent 500 here — and a red count carried across
       *    families measures the wrong one (rule.require.measure-the-value-you-emit)
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
        output: asApiGatewayResponseSchema({
          body: z.object({ lesson: SurfLesson.contract().nullable() }),
        }),
      };

      when('[t0] the lookup found one', () => {
        const outcome = useThen('the handler answers', async () => {
          const handler = forApiGateway({
            schema,
            // ⚠️ .why `withImmute` and NOT a bare `new SurfLesson(...)` = the UNEVEN compiler
            //    demand, caught in the act. `.nullable()` makes this position a union,
            //    so tsc cannot unify `TOutput` from the return and falls back to the SCHEMA's
            //    output type — `ContractOf` declares that as `WithImmute<Instance>`, so a bare
            //    instance reds. the non-nullable peers in `refTrophyHandlers.ts` unify, so they
            //    take a bare `new X(...)` and never meet this
            invoke: async ({ event }) => ({
              status: 200,
              body: {
                lesson: withImmute(
                  new SurfLesson({ uuid: event.uuid, spot: 'pipeline' }),
                ),
              },
            }),
          });

          return await handler(
            createV1Event({ uuid: 'l-1' }),
            createMockContext(),
          );
        });

        then('the wire body carries the fields, never an empty object', () => {
          expect(JSON.parse(outcome.body ?? '')).toEqual({
            lesson: { uuid: 'l-1', spot: 'pipeline' },
          });
        });

        then('and the status is the one the handler chose', () => {
          expect(outcome.statusCode).toEqual(200);
        });

        /**
         * .why a snapshot beside the `toEqual` = the equality clamps the FIELDS and renders
         *      none of them to a reviewer. this is the arm where an instance crosses output
         *      validation and the serializer, so it is the arm where a leaked own property
         *      would reach the wire — the bytes are the thing worth showing
         */
        then('and the whole payload a caller receives is snapped', () => {
          expect(asPayloadSnapshot({ payload: outcome })).toMatchSnapshot();
        });
      });

      when('[t1] the lookup found naught, so the position is null', () => {
        const outcome = useThen('the handler answers', async () => {
          const handler = forApiGateway({
            schema,
            invoke: async () => ({ status: 200, body: { lesson: null } }),
          });

          return await handler(
            createV1Event({ uuid: 'l-absent' }),
            createMockContext(),
          );
        });

        // ⚠️ the row the gap was about. a `null` at a coerced position must short-circuit at
        //    the zod wrapper rather than fall into `new SurfLesson(null)` — at THIS border the
        //    failure would surface to a caller as a 500 on an ordinary `getOneById` miss
        then('the null crosses to the wire as null', () => {
          expect(JSON.parse(outcome.body ?? '')).toEqual({ lesson: null });
        });

        then('and the caller still meets a 200, never a 500', () => {
          expect(outcome.statusCode).toEqual(200);
        });

        // .why = the null arm's bytes are the ones a `getOneById` miss puts on the wire, so
        //        they are worth a reader's eye as much as the present arm's
        then('and the whole payload a caller receives is snapped', () => {
          expect(asPayloadSnapshot({ payload: outcome })).toMatchSnapshot();
        });
      });
    },
  );

  given(
    '[case20] a bare `.transform()` throw on the INPUT side — F35, at THIS family',
    () => {
      /**
       * ⛔ .status = RULED 2026-09-21 — NOT A DEFECT, and NO REPAIR IS OWED. this case pins
       *    CORRECT behavior, never a deferred fault. it was written as a defect record and
       *    the fulcrum it served is now closed
       *
       *    .why it is correct = a bare guard `throw` and a genuine null-deref inside a
       *      transform are INDISTINGUISHABLE — same plain `Error`, same `inst._zod.parse`
       *      frame, no property parts them. so a server fault is the only honest read of the
       *      signal, and it is the safe direction to be wrong in
       *
       *    ⇒ and a consumer who MEANS a caller fault has two zod-native forms, both clamped
       *      below: `[t2]` `.refine()`, and `[t3]` `ctx.addIssue` + `z.NEVER`
       *
       *    ⚠️ .to re-open, one claim must fall = that the two throws produce no
       *      distinguishable observable state. `[t0]` and `[t3]` clamp it from both sides
       *
       * .what = F35's consequence at the api-gateway family, RUN rather than inferred. this is
       *      the twin of `genLambdaEndpoint.forAskEndpoint.test.ts [case13]`
       *
       * ⚠️ .why it existed nowhere until now, though this family is the one F35's ORIGINAL text
       *    described = the sweep that widened F35 from one family to two clamped the arm it had
       *    just DISCOVERED and left the arm it had always named. the probe that measured this
       *    family was a throwaway and was deleted, so its result survived only as prose
       *    (rule.require.measure-the-value-you-emit — a claim owes a run, and a deleted run is
       *    a claim again the moment the next reader meets it)
       *
       * ⚠️ .the trap, for the THIRD time on this branch = F35's stated cause is *"the post-parse
       *    funnel belongs to `domain-objects`"*, which names NO family. a sweep bounded to one
       *    family is bounded to an axis the cause never mentioned
       *    (rule.require.sweep-the-defect-class, the second trap). the first instance was a hook
       *    phase, the second was this defect's own family axis, and this is the third: the
       *    REPAIR of a one-axis sweep was itself bounded to one axis
       *
       * .why it differs from the ask family = this family hands
       *      `genInternalServiceErrorMiddleware` a FUNCTION rather than `false`
       *      (`genLambdaEndpoint.forApiGateway.ts:334`), so the invocation SETTLES with a 500
       *      body instead of rejecting. both are wrong, and this one is the milder wrong
       *
       * ⚠️ .PROVEN BY REVERT (rule.require.clamp-edge-cases):
       *
       *      revert                                  | result
       *      ----------------------------------------|----------------------------------------
       *      `.transform()` -> `.refine()`, same      | 🔴 4 red — ALL FOUR of `[t0]`'s rows:
       *        guard, same message                    |    statusCode (500 -> 400), errorType,
       *                                               |    the swallowed-message row, and the
       *                                               |    snapshot
       *
       *    ⇒ `[t1]` and `[t2]` stay GREEN under that revert — each declares its own schema, so
       *      neither depends on this one. `[t1]` is the positive control that shows THIS family
       *      answers a zod-class rejection with a 400 already, so the 500 is a property of the
       *      ERROR CLASS rather than of the family
       *
       * ⚠️ .I PREDICTED 2 AND MEASURED 4, and the gap is worth the ink. I counted the two rows
       *    that name a status, and forgot that the swallowed-message row and the snapshot
       *    ALSO flip — under `.refine()` the consumer's message DOES reach the caller, and the
       *    payload becomes a 400 body. ⇒ a predicted red count is a claim like any other, and
       *    `[case19]` on this same file already recorded that lesson one axis over
       *    (rule.require.measure-the-value-you-emit)
       */
      const schema = {
        input: z.object({
          spot: z.string().transform((raw) => {
            // a consumer's OWN guard on a caller's value — the shape F35 is about
            if (raw !== 'pipeline') throw new Error('unknown surf spot');
            return raw;
          }),
        }),
        output: asApiGatewayResponseSchema({
          body: z.object({ booked: z.boolean() }),
        }),
      };

      when('[t0] the caller sends a value the consumer guard refuses', () => {
        const outcome = useThen('the invocation SETTLES', async () => {
          const handler = forApiGateway({
            schema,
            invoke: async () => ({ status: 200, body: { booked: true } }),
          });

          return await handler(
            createV1Event({ spot: 'trestles' }),
            createMockContext(),
          );
        });

        then('it settles as a SERVER fault — a 500, and CORRECT', () => {
          expect(outcome.statusCode).toEqual(500);
        });

        then('and the body names it an InternalServiceError', () => {
          const body = asParsedResponseBody({ response: outcome });
          expect(body.errorType).toEqual('InternalServiceError');
        });

        // the consumer's own message is SWALLOWED, and that is also correct: a bare `throw`
        // is indistinguishable from a null-deref, so its text may hold internals a caller
        // must never meet. a consumer who MEANS a caller fault reaches for `[t2]` or `[t3]`
        then('and the guard message never reaches the caller', () => {
          expect(outcome.body).not.toContain('unknown surf spot');
        });

        then('the whole payload, snapped', () => {
          expect(asPayloadSnapshot({ payload: outcome })).toMatchSnapshot();
        });
      });

      when(
        '[t1] a POSITIVE CONTROL — the same family, a zod-class refusal',
        () => {
          const outcome = useThen('the invocation settles', async () => {
            const handler = forApiGateway({
              schema: {
                input: z.object({ spot: z.string() }),
                output: asApiGatewayResponseSchema({
                  body: z.object({ booked: z.boolean() }),
                }),
              },
              invoke: async () => ({ status: 200, body: { booked: true } }),
            });

            return await handler(
              createV1Event({ spot: 42 }),
              createMockContext(),
            );
          });

          then('this family answers a zod-class refusal with a 400', () => {
            expect(outcome.statusCode).toEqual(400);
          });

          // ⇒ so the 500 above is a property of the ERROR CLASS, never of the family. without
          //   this row a reader could conclude `forApiGateway` 500s on every bad input
          then('so the 500 above is about the CLASS, never the family', () => {
            const body = asParsedResponseBody({ response: outcome });
            expect(body.errorType).not.toEqual('InternalServiceError');
          });
        },
      );

      when('[t2] ONE escape hatch — the same guard, via `.refine()`', () => {
        // ⚠️ the WEAKER of two: `.refine()` cannot RESHAPE, so it serves a consumer who only
        //   rejects. `[t3]` carries the one that guards AND reshapes in one pass
        const outcome = useThen('the invocation settles', async () => {
          const handler = forApiGateway({
            schema: {
              input: z.object({
                spot: z
                  .string()
                  .refine((raw) => raw === 'pipeline', 'unknown surf spot'),
              }),
              output: asApiGatewayResponseSchema({
                body: z.object({ booked: z.boolean() }),
              }),
            },
            invoke: async () => ({ status: 200, body: { booked: true } }),
          });

          return await handler(
            createV1Event({ spot: 'trestles' }),
            createMockContext(),
          );
        });

        then('the caller meets a 400 rather than a 500', () => {
          expect(outcome.statusCode).toEqual(400);
        });

        // ⇒ the row that makes the hatch USABLE rather than merely available: the consumer's
        //   own message survives verbatim, so a caller learns what to fix
        //   (rule.require.errors-name-the-fix)
        then('and the consumer message survives VERBATIM', () => {
          expect(outcome.body).toContain('unknown surf spot');
        });
      });

      when(
        '[t3] the STRONGER hatch — `.transform()` + `ctx.addIssue()`',
        () => {
          /**
           * .why this row is owed beside `[t2]` = `.refine()` cannot RESHAPE, so it is no
           *      substitute for a consumer whose transform genuinely converts — which is the
           *      headline usecase of this whole sdk. `ctx.addIssue` + `z.NEVER` guards AND
           *      reshapes in one pass, and it lands the same 400
           *
           * 🔴 .this is what RE-GRADES F35 = that fulcrum read `[t0]`'s 500 as sdk behavior
           *    owed a repair, on the premise *"this repo declares no such vocabulary"*. zod
           *    declares it. this row is the proof it reaches our chain end to end, with no
           *    edit to `getValidatedInput` ⇒ the gap is DISCOVERABILITY, never behavior
           *
           * .note = the ask family's twin is `forAskEndpoint.test.ts [case13][t3]`, and the
           *    two together are what make that re-grade a measurement at BOTH families rather
           *    than at the one I happened to run first
           *    (rule.require.sweep-the-defect-class — the family axis, which this defect's
           *    own record got wrong twice)
           *
           * ⚠️ .PROVEN BY REVERT (rule.require.clamp-edge-cases):
           *
           *      revert                                  | result
           *      ----------------------------------------|----------------------------------
           *      `ctx.addIssue` + `z.NEVER` -> a bare     | 🔴 2 red — the 400 row and the
           *        `throw`, same guard, same message      |    verbatim-message row
           *
           *    ⇒ the two GREEN rows under that revert are the ones that read a GOOD value, so
           *      they never reach the guard. that split is the proof the clamp grades the
           *      MECHANISM rather than the schema's happy path
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

          const refused = useThen('a bad value settles', async () => {
            const handler = forApiGateway({
              schema: {
                input: guardedInput,
                output: asApiGatewayResponseSchema({
                  body: z.object({ spot: z.string() }),
                }),
              },
              invoke: async ({ event }) => ({
                status: 200,
                body: { spot: event.spot },
              }),
            });

            return await handler(
              createV1Event({ spot: 'trestles' }),
              createMockContext(),
            );
          });

          then('the caller meets a 400 rather than a 500', () => {
            expect(refused.statusCode).toEqual(400);
          });

          then('and the consumer message survives VERBATIM', () => {
            expect(refused.body).toContain('unknown surf spot');
          });

          then('a good value reaches invoke RESHAPED', async () => {
            const handler = forApiGateway({
              schema: {
                input: guardedInput,
                output: asApiGatewayResponseSchema({
                  body: z.object({ spot: z.string() }),
                }),
              },
              invoke: async ({ event }) => ({
                status: 200,
                body: { spot: event.spot },
              }),
            });

            const outcome = await handler(
              createV1Event({ spot: 'pipeline' }),
              createMockContext(),
            );

            // 👍 the guard AND the reshape both landed — the half `[t2]` cannot reach
            expect(asParsedResponseBody({ response: outcome })).toEqual({
              spot: 'PIPELINE',
            });
          });
        },
      );
    },
  );

  given(
    '[case21] a `.pipe()` type-shift at the OUTPUT border, at THIS family',
    () => {
      /**
       * ⚠️ .status = the defect is LIVE and NOT REPAIRED. tracked at
       *    `.dream/v2026_09_18.fix.published-face-contradicts-the-wire-for-a-pipe.md`
       *
       * .what = the twin of `genLambdaEndpoint.forAskEndpoint.test.ts [case14]`, and it exists
       *      for the same reason `[case20]` does: the pipe defect was clamped at the published
       *      face (family-agnostic) and at ONE wired family, never at this one
       *
       * ⚠️ .why a twin is owed rather than assumed = this family's body crosses
       *    `httpResponseSerializer` on its way out, which the ask family never reaches. so the
       *    two families run DIFFERENT code past output validation, and a result carried across
       *    would measure the wrong one (rule.require.retest-the-model-on-every-family)
       *
       * ⚠️ .the contradiction, measured = `TOutput` binds to the pipe's OUTPUT side, so the
       *    COMPILER demands a `number`. `getValidatedOutput` then parses that return through the
       *    pipe's INPUT side, which demands a `string`. no `invoke` body satisfies both
       *
       * ⚠️ .PROVEN BY REVERT (rule.require.clamp-edge-cases):
       *
       *      revert                                  | result
       *      ----------------------------------------|----------------------------------------
       *      `z.string().pipe(z.coerce.number())`     | 🔴 4 red — and they span BOTH arms:
       *        -> a plain `z.number()`                |    `[t0]`'s two rows (its `'6'` is now
       *                                               |    refused) AND `[t1]`'s two (its `6` is
       *                                               |    now ACCEPTED, so the 500 becomes 200)
       *
       *    ⇒ that both arms flip is the proof the case measures the CONTRADICTION rather than
       *      either half of it. delete the type-shift and the two arms stop to disagree — which
       *      is exactly what a repair of this defect must achieve
       */
      const schema = {
        input: z.object({ spot: z.string() }),
        output: asApiGatewayResponseSchema({
          body: z.object({ waveHeight: z.string().pipe(z.coerce.number()) }),
        }),
      };

      when('[t0] the handler obeys the RUNTIME and hands back a string', () => {
        const outcome = useThen('the handler answers', async () => {
          const handler = forApiGateway({
            schema,
            /**
             * .as = the compiler demands a `number` here, because `TOutput` binds to the
             *       pipe's OUTPUT side. the RUNTIME demands a `string`, because
             *       `getValidatedOutput` parses through its INPUT side. this cast is how the
             *       two are held apart long enough to measure them
             * .removal = delete the cast the moment the pipe defect is repaired; `[t1]` below
             *       is the arm that reds when it is
             */
            invoke: async () =>
              ({
                status: 200,
                body: { waveHeight: '6' },
              }) as unknown as { status: number; body: { waveHeight: number } },
          });

          return await handler(
            createV1Event({ spot: 'pipeline' }),
            createMockContext(),
          );
        });

        then('it settles, and the wire carries a NUMBER', () => {
          expect(outcome.statusCode).toEqual(200);
          expect(JSON.parse(outcome.body ?? '')).toEqual({ waveHeight: 6 });
        });

        // ⚠️ the divergence, on one line: the PUBLISHED face of this schema says `string`, and
        //    the wire carries a number. a generated cross-service client is typed wrong, and
        //    no error fires anywhere (rule.forbid.failhide)
        then(
          '⚠️ while the PUBLISHED face of the same schema says `string`',
          () => {
            expect(typeof JSON.parse(outcome.body ?? '').waveHeight).toEqual(
              'number',
            );
          },
        );
      });

      when(
        '[t1] the handler obeys the COMPILER and hands back a number',
        () => {
          const outcome = useThen('the handler answers', async () => {
            const handler = forApiGateway({
              schema,
              // no cast — this is what the compiler asks for, and the runtime refuses it
              invoke: async () => ({ status: 200, body: { waveHeight: 6 } }),
            });

            return await handler(
              createV1Event({ spot: 'pipeline' }),
              createMockContext(),
            );
          });

          /**
           * ⚠️ .the family difference, and it is why this twin was owed = the ask family REJECTS
           *    here, since it hands `asOutputAfter: false`. THIS family settles with a 500, so a
           *    caller meets a server fault on a handler that satisfied its own compiler
           */
          then(
            '⚠️ the output validation REFUSES it — a 500 the handler never chose',
            () => {
              expect(outcome.statusCode).toEqual(500);
            },
          );

          then('the whole payload, snapped', () => {
            expect(asPayloadSnapshot({ payload: outcome })).toMatchSnapshot();
          });
        },
      );
    },
  );
});
