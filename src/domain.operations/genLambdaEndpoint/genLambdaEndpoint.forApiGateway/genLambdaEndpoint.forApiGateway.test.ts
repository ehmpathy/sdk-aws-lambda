import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DomainEntity, DomainLiteral, withImmute } from 'domain-objects';
import { ConstraintError } from 'helpful-errors';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import type { ApiGatewayOnwireVersion } from '../../../__test_assets__/asApiGatewayRequestEventOnwire';
import { asApiGatewayRequestEventOnwire } from '../../../__test_assets__/asApiGatewayRequestEventOnwire';
import { asParsedResponseBody } from '../../../__test_assets__/asParsedResponseBody';
import { asResponseOnwireSnapshot } from '../../../__test_assets__/asResponseOnwireSnapshot';
import { forAsk } from '../genLambdaEndpoint.forAsk/genLambdaEndpoint.forAsk';
import type {
  ApiGatewayHeadersMerged,
  ApiGatewayHeadersOnwire,
} from './ApiGatewayRequestEventUnified';
import { asApiGatewayResponseSchema } from './asApiGatewayResponseSchema';
import { forApiGateway } from './genLambdaEndpoint.forApiGateway';

/**
 * .what = `true` when `T` is `never`, `false` otherwise
 * .why = `never` is assignable to each type, so a plain assertion cannot detect it — a clamp
 *        written as `const x: string = value` passes under `never` and proves naught. the tuple
 *        wrap defeats the distribution that would otherwise collapse the check itself
 * .note = test-local by design. it names no domain concept, so it earns no home in `src/`
 *         (`rule.prefer.wet-over-dry`)
 */
type IsNever<T> = [T] extends [never] ? true : false;

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
      input: z.object({ payload: z.object({ name: z.string() }) }),
      output: asApiGatewayResponseSchema({
        payload: z.object({ id: z.string(), name: z.string() }),
      }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns response', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async ({ payload }) => ({
            payload: {
              id: 'user-123',
              name: payload.name,
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
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });
  });

  given('[case2] invalid request body', () => {
    const schema = {
      input: z.object({ payload: z.object({ email: z.string().email() }) }),
      output: asApiGatewayResponseSchema({
        payload: z.object({ success: z.boolean() }),
      }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns error', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({ payload: { success: true } }),
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
       * .what = the error PATH sits under `payload`
       * .why = `schema.input` describes the PAIR, so zod reports `payload.email`. a caller that
       *        maps an error back to a form field reads exactly this string
       *
       * .why it is a SEPARATE `then` = the peer above asserts `toContain('validation
       *        failed')`, which holds whatever the path — so it cannot see the path. the
       *        introspection report's peer shape is clamped by `[case6]`'s
       *        `body.input.properties.payload.properties.customerId`
       *
       * .note = goes RED if the validator is ever handed `schema.input.payload` rather than
       *         `schema.input` — a plausible edit that drops the `payload.` prefix from every
       *         error path (rule.require.clamp-edge-cases)
       */
      then(
        'the error path sits under `payload`, as the readme advertises',
        () => {
          const body = asParsedResponseBody({ response: result });
          expect(body.errorMessage).toContain('payload.email');
        },
      );

      /**
       * .what = the *"leaves the lambda invocation a success"* guarantee, named rather than
       *         left implicit
       * .why = in lambda that distinction is whether the handler's promise resolves or rejects:
       *        a rejection becomes a `FunctionError`, which cloudwatch counts and the caller
       *        retries (invariant.badrequesterror-not-lambda-error). the peer `then`s prove
       *        resolution incidentally while they name only status and body, so without this
       *        block the guarantee has no name anywhere in the suite
       *
       * .why it reads the shared result = a settled `result` exists only because the promise
       *        fulfilled — `useThen` awaits it, so a rejection never reaches this line. the
       *        shared value already carries the proof, and a second invocation would buy a
       *        second run of the whole composed chain to re-derive it
       *        (`rule.forbid.redundant-expensive-operations`)
       *
       * .the trade, stated = under a regression to `throw`, the red lands on the `useThen`
       *        rather than here, so the failure names the block and not the guarantee. that is
       *        the cost of one invocation, and it is accepted: the suite still goes red, and
       *        this comment is where the next reader learns which guarantee broke
       */
      then('the invocation succeeds, never a FunctionError', () => {
        expect(result).toMatchObject({ statusCode: 400 });
      });

      then('result matches snapshot', () => {
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the clamp that cors headers reach the wire at all — it goes red the moment
   *         `request.event` stops to be http-shaped, since cors then finds no slot to read
   *
   * .note = this case proves cors headers are present. it does not prove the origin was
   *         echoed, and the distinction is invisible from the assertion alone: `origins` here
   *         holds one entry, and `@middy/http-cors` falls back to `options.origins[0]` when it
   *         finds no request origin (`index.js:2-14`). so an echo and a fallback yield the same
   *         string, and both satisfy the `toBe` below
   *
   * .the origin clamp is `[case18]`, which allowlists two origins and calls from the second.
   *         do not read this case as a substitute for it, and do not shrink `[case18]` to one
   *         origin: a header-merge swapped for a naive replace starves cors of the origin and
   *         leaves this case green
   */
  given('[case3] cors configured', () => {
    const schema = {
      input: z.object({ payload: z.object({ data: z.string() }) }),
      output: asApiGatewayResponseSchema({
        payload: z.object({ result: z.string() }),
      }),
    };

    when('[t0] handler invoked', () => {
      then('it should include cors headers', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({ payload: { result: 'ok' } }),
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

        // the whole response wire, so a header nobody named is still visible in the diff
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });
  });

  given('[case4] handler error', () => {
    const schema = {
      input: z.object({ payload: z.object({ value: z.number() }) }),
      output: asApiGatewayResponseSchema({
        payload: z.object({ result: z.number() }),
      }),
    };

    when('[t0] handler throws', () => {
      /**
       * .note = one invocation, shared by every `then` below. the composed chain is the
       *         expensive part, and one settled value carries every claim made of it
       *         (`rule.forbid.redundant-expensive-operations`)
       */
      const result = useThen('the sdk answers the wire', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => {
            throw new Error('Database connection failed');
          },
        });

        return handler(createV1Event({ value: 42 }), createMockContext());
      });

      then('it should return 500 with generic error body', () => {
        // note: 500 responses include a generic error message and correlation id
        // but no internal details to avoid info leaks
        expect(result.statusCode).toBe(500);
        expect(result.body).toBeDefined();
        const body = asParsedResponseBody({ response: result });
        expect(body.errorMessage).toBe('internal server error');
        expect(body.errorType).toBe('InternalServiceError');
        expect(body.correlationId).toMatch(/^exid:/);
        // verify no internal details leaked
        expect(body.stackTrace).toBeUndefined();
        expect(result.body).not.toContain('Database connection');

        // the whole response wire; the exid is MASKED rather than reduced to a boolean, so the
        // snapshot still shows that a correlationId reached the caller
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });

      /**
       * .what = the api-gateway family's server-fault settle state, named as its own guarantee
       * .why = this family answers the wire for both faults, so a server fault must settle
       *        fulfilled too — http demands a response, and a hung request is worse than a 500.
       *        that is why `genInternalServiceErrorMiddleware` takes a function here rather than
       *        the `false` its peer family passes. the settle state is a guarantee at four
       *        points across the two families; the ask-endpoint pair is asserted in its own suite
       *
       * .why it reads the shared result = a settled `result` exists only because the promise
       *        fulfilled, so a second invocation would re-run the whole chain to re-derive a
       *        fact the shared value already carries
       *        (`rule.forbid.redundant-expensive-operations`). the same trade as `[case2][t0]`:
       *        under a regression to a rejection the red lands on the `useThen`
       */
      then('the invocation is a success even on a server fault', () => {
        expect(result).toMatchObject({ statusCode: 500 });
      });
    });
  });

  given('[case5] access to the reconciled event', () => {
    const schema = {
      input: z.object({ payload: z.object({ action: z.string() }) }),
      output: asApiGatewayResponseSchema({
        payload: z.object({ method: z.string(), path: z.string() }),
      }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns response', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async ({ event }) => {
            /**
             * .what = the url path costs a narrow, where `event.path` would cost none
             * .why = the envelope carries `params` (the two extracted bags) and not the path
             *        string, so a reader of the string goes through `_` — and `_` is the
             *        v1|v2 union, where v1 puts it at `path` and v2 at `requestContext.http`.
             *        that is the cost of the drop, written where a reader meets it
             */
            const raw = event._.raw;

            return {
              payload: {
                method: event.method,
                path: 'path' in raw ? raw.path : raw.requestContext.http.path,
              },
            };
          },
        });

        return handler(createV1Event({ action: 'test' }), createMockContext());
      });

      then('it should have access to event', () => {
        expect(result.statusCode).toBe(200);
        const body = asParsedResponseBody({ response: result });
        expect(body.method).toBe('POST');
        expect(body.path).toBe('/users');
      });

      then('result matches snapshot', () => {
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });
  });

  given('[case6] deserialize body disabled', () => {
    const schema = {
      input: z.object({ payload: z.string() }),
      output: asApiGatewayResponseSchema({
        payload: z.object({ received: z.string() }),
      }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns response', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async ({ payload }) => ({
            payload: {
              received: payload,
            },
          }),
          deserialize: { payload: false },
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
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });
  });

  given('[case7] introspection request in prep env', () => {
    const schema = {
      input: z.object({ payload: z.object({ customerId: z.string() }) }),
      output: asApiGatewayResponseSchema({
        payload: z.object({ name: z.string(), balance: z.number() }),
      }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns schema', async () => {
        const handler = forApiGateway(
          {
            schema,
            invoke: async () => ({ payload: { name: 'test', balance: 100 } }),
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
        // the report describes `schema.input`, which now describes the PAIR — so the caller's
        // body schema is nested one level, under `payload`
        expect(
          body.input.properties.payload.properties.customerId,
        ).toBeDefined();
      });

      then('response reports the whole response envelope', () => {
        const body = asParsedResponseBody({ response: result });
        expect(body.output.type).toBe('object');
        expect(body.output.properties.status).toBeDefined();
        expect(body.output.properties.headers).toBeDefined();
        // the envelope's body slot is `payload`, in BOTH directions — so the report names it
        expect(body.output.properties.payload).toBeDefined();
      });

      then('the reported envelope keeps the body contract reachable', () => {
        const body = asParsedResponseBody({ response: result });
        expect(body.output.properties.payload.properties.name).toBeDefined();
        expect(body.output.properties.payload.properties.balance).toBeDefined();
      });

      then('response matches snapshot', () => {
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });
  });

  given('[case8] introspection request in prod env', () => {
    const schema = {
      input: z.object({ payload: z.object({ id: z.string() }) }),
      output: asApiGatewayResponseSchema({
        payload: z.object({ value: z.number() }),
      }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns error', async () => {
        const handler = forApiGateway(
          {
            schema,
            invoke: async () => ({ payload: { value: 42 } }),
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
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });
  });

  given('[case9] introspection request without env config', () => {
    const schema = {
      input: z.object({ payload: z.object({ id: z.string() }) }),
      output: asApiGatewayResponseSchema({
        payload: z.object({ value: z.number() }),
      }),
    };

    when('[t0] handler invoked with introspect payload', () => {
      const result = useThen('handler returns error', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({ payload: { value: 42 } }),
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
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });
  });

  given('[case10] normal request with env config', () => {
    const schema = {
      input: z.object({ payload: z.object({ name: z.string() }) }),
      output: asApiGatewayResponseSchema({
        payload: z.object({ message: z.string() }),
      }),
    };

    when('[t0] handler invoked with normal payload', () => {
      const result = useThen('handler returns response', async () => {
        const handler = forApiGateway(
          {
            schema,
            invoke: async ({ payload }) => ({
              payload: { message: `Hello, ${payload.name}!` },
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
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the three wire shapes the fixed 200+json contract could not express
   * .why = a twilio webhook answers 204-no-body or twiml xml; a short-url answers 308+Location.
   *        each asserts the `ApiGatewayResponseOnwire` the chain emits, never only what the
   *        handler returned
   */
  given('[case11] a handler that answers 204 with no body', () => {
    const schema = {
      input: z.object({ payload: z.object({ name: z.string() }) }),
      output: asApiGatewayResponseSchema({ payload: z.undefined() }),
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
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });
  });

  given('[case12] a handler that answers 308 with a Location header', () => {
    const schema = {
      input: z.object({ payload: z.object({ slug: z.string() }) }),
      output: asApiGatewayResponseSchema({ payload: z.undefined() }),
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
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });
  });

  given('[case13] a handler that answers an xml body', () => {
    const twiml = '<Response><Say>cowabunga</Say></Response>';
    const schema = {
      input: z.object({ payload: z.object({ From: z.string() }) }),
      output: asApiGatewayResponseSchema({ payload: z.string() }),
    };

    when('[t0] handler invoked', () => {
      const result = useThen('handler returns xml', async () => {
        const handler = forApiGateway({
          schema,
          invoke: async () => ({
            headers: { 'Content-Type': 'text/xml' },
            payload: twiml,
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
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
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
      input: z.object({ payload: z.object({ name: z.string() }) }),
      output: asApiGatewayResponseSchema({ payload: z.undefined() }),
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
   * .what = proves the aws-native wire shape is refused loudly rather than silently mangled
   * .why = the shape an author who knows aws writes from habit. `{ statusCode: 404, body: JSON.stringify(x) }`
   *        satisfies the cardinality check via `'body' in input`, loses its 404 to
   *        `status ?? 200`, and has its body stringified a second time. a 500 is the correct
   *        answer, not a 400: the handler author is at fault, not the http caller
   *        (invariant.badrequesterror-not-lambda-error)
   *
   * .note = both of its keys are wire words — the envelope says `status` and `payload`.
   *        so this shape is refused twice over, and an author who fixes only the status still
   *        meets a loud 500 rather than a silent empty 200
   *
   * .measured = the type does not catch this. a tsc probe of four shapes:
   *
   *               { statusCode: 404 }             -> TS2322, refused
   *               { header: {…} }                 -> TS2322, refused
   *               { statusCode: 404, body: 'x' }  -> compiles clean
   *               { status: 204 }                 -> compiles (the positive control)
   *
   *             `PickAny` refuses a response with no valid key; once any valid key is present
   *             the excess keys go unchecked, because object-literal freshness is lost through
   *             the inferred `Promise<…>` return. so `isApiGatewayResponse.assure` is the only
   *             guard here, for typed and untyped callers alike
   *             (rule.require.measure-the-value-you-emit)
   */
  given('[case15] a handler that returns the aws-native wire shape', () => {
    const schema = {
      input: z.object({ payload: z.object({ name: z.string() }) }),
      output: z.any(),
    };

    when('[t0] it returns { statusCode, body } — the aws habit', () => {
      const result = useThen('the handler answers', async () => {
        const handler = forApiGateway({
          schema,
          // .as = the aws wire shape. the cast is cosmetic — see `.measured` above: the
          //       compiler does not refuse this shape, so the runtime assure is the guard
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
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });

    when('[t1] each deferred wire key is handed over on its own', () => {
      /**
       * the whole family shares one cause, so each member is checked, not just statusCode
       *
       * .note = this list is a second copy of `IS_KEY_OF_RESPONSE_WIRE_UNREAD`, and the
       *         source's own clamp cannot see it: that clamp is a
       *         `Record<KeyOfResponseOnwireUnread, true>`, so tsc refuses a key absent there
       *         and says not one word about one absent here. a key added to the source must be
       *         added here by hand, and this note is the sole record of that
       */
      const keysOfOnwire = [
        'statusCode',
        'body', // a wire key only, since the envelope's body slot takes the word `payload`
        'multiValueHeaders',
        'isBase64Encoded',
        'cookies',
      ];

      keysOfOnwire.map((key) =>
        then(`\`${key}\` is refused rather than dropped`, async () => {
          const handler = forApiGateway({
            schema,
            invoke: async () =>
              ({ [key]: 'whatever', payload: { ok: true } }) as unknown as {
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
      input: z.object({ payload: z.object({ name: z.string() }) }),
      output: z.any(),
    };

    when('[t0] the ask-endpoint family runs — the positive control', () => {
      const translated = useThen('the handler answers', async () => {
        /**
         * .note = DELIBERATE MUTATION in a `const` box, the repaired form this file uses at
         *         `[case17][t1]`. the middleware CALLS `logTranslate.input`, so the observation
         *         is produced inside a closure with no return path to this scope
         * .why the `dispatch` seed = a count of 0 is the DEFECT's own expected value in `[t1]`,
         *         so a count alone cannot tell "the branch never ran" from "the handler was
         *         never invoked" — both read 0. `dispatch` is the second axis that separates
         *         them, and its seed is a value no assertion below expects
         *         (rule.require.positive-control-before-absence-claims)
         */
        const observed: { calls: number; dispatch: string } = {
          calls: 0,
          dispatch: 'the handler was never invoked',
        };

        const handler = forAsk({
          schema: { input: schema.input, output: z.any() },
          invoke: async () => ({ ok: true }),
          logTranslate: {
            input: (event) => {
              observed.calls += 1;
              return event;
            },
          },
        });

        // the ask family takes the WHOLE event, and this case shares one `schema.input` with
        // its api-gateway peer — so the ask EVENT is the pair the schema now describes
        await handler({ payload: { name: 'Kai' } }, createMockContext());
        observed.dispatch = 'the handler answered';

        // a flat bag of scalars: `useThen` hands back a proxy that defers property access, so a
        // nested read (`.length`, `.body.x`) resolves `undefined` through it
        return observed;
      });

      then('the handler was invoked — so `calls` is a real observation', () => {
        expect(translated.dispatch).toBe('the handler answered');
      });

      then('the log branch does run — so the probe can observe it', () => {
        expect(translated.calls).toBe(1);
      });
    });

    when('[t1] the api-gateway family runs — the same option', () => {
      const translated = useThen('the handler answers', async () => {
        // .note = deliberate mutation, the same annotated box and the same seed as `[t0]`
        const observed: { calls: number; dispatch: string } = {
          calls: 0,
          dispatch: 'the handler was never invoked',
        };

        const handler = forApiGateway({
          schema,
          invoke: async () => ({ payload: { ok: true } }),
          logTranslate: {
            input: (event) => {
              observed.calls += 1;
              return event;
            },
          },
        });

        const result = await handler(
          createV1Event({ name: 'Kai' }),
          createMockContext(),
        );
        observed.dispatch = `the handler answered ${result.statusCode}`;

        return observed;
      });

      /**
       * .what = the positive control on the absence claim below
       * .why = `calls === 0` is the defect's expected value and the value a never-dispatched
       *        handler produces. so the absence assertion alone stays green under a harness
       *        that stopped to invoke the handler at all — it would report a real defect for a
       *        false reason, which is the worst shape a green test can take
       */
      then('the handler was invoked, and answered 200', () => {
        expect(translated.dispatch).toBe('the handler answered 200');
      });

      /**
       * .defect = live, not fixed — `logTranslate.input` never fires for this family
       *
       *        .the polarity = this assertion is green while the defect is present, and goes
       *           red the moment the repair lands. a defect left deliberately in place must
       *           not be left unmeasured (`rule.require.clamp-edge-cases`)
       *        .the repair, unapplied = move `genTrailMiddleware()` above the entry that
       *           produces what it reads. left because the chain-order edit reaches every
       *           family, and it predates this route
       */
      then(
        'the log branch never runs — no handler.input, ever (a live defect)',
        () => {
          expect(translated.calls).toBe(0);
        },
      );
    });
  });

  /**
   * .what = the clamps for the `{ headers, payload, event }` hand-off
   * .why = the three fields are one object each: `headers === event.headers` and
   *        `payload === event.payload`. that identity is the whole argument for the lift, and it
   *        holds only because the validator writes back into the envelope rather than parse into
   *        a side bag (`domain.terms/headers.md`)
   */
  given('[case17] the hand-off `invoke` receives', () => {
    const schema = {
      input: z.object({ payload: z.object({ name: z.string() }) }),
      output: z.any(),
    };

    when('[t0] a handler reads its three fields', () => {
      const seen = useThen('the handler answers', async () => {
        /**
         * .note = DELIBERATE MUTATION. the three fields under test are the handler's INPUT, and
         *         a handler returns its output — so no return path carries them out. `useThen`
         *         shares a result; this shares an observation from inside the closure
         *         (rule.require.immutable-vars, the annotated-exception clause)
         *
         * .why a const BOX and not a `let` = the box makes the name immutable, so the only
         *         mutation left is the one write below. and it lets the guard NARROW: tsc cannot
         *         track a closure's write to a `let`, which is what forced the `captured!`
         *         non-null assertion this replaces
         * .why the guard = a handler that never runs would have yielded `null`, and `captured!`
         *         asserted otherwise without proof. the three `then`s below would then fail on a
         *         null dereference — an opaque message for a real defect (the handler did not
         *         run) that names neither the cause nor the fix (`rule.require.failloud`)
         */
        const box: {
          seen: {
            headers: Record<string, string | undefined>;
            payload: unknown;
            event: {
              headers: Record<string, string | undefined>;
              payload: unknown;
            };
          } | null;
        } = { seen: null };

        const handler = forApiGateway({
          schema,
          invoke: async ({ headers, payload, event }) => {
            box.seen = { headers, payload, event };
            return { payload: { ok: true } };
          },
        });

        await handler(createV1Event({ name: 'Kai' }), createMockContext());

        // the positive control on the observation itself — never assert on an unproven capture
        if (!box.seen)
          throw new ConstraintError(
            '`invoke` never ran, so the hand-off was never captured',
            {
              fix: 'the chain rejected the request before `logic` — read the thrown response, and check the fixture against `schema.input`',
            },
          );

        return box.seen;
      });

      then('`payload` is the VALIDATED body, in one hop', () => {
        expect(seen.payload).toEqual({ name: 'Kai' });
      });

      then('`headers` reads in one hop, keys lowercased', () => {
        // the fixture sends `Content-Type`; rfc 9110 §5.1 makes the case irrelevant
        expect(seen.headers['content-type']).toEqual('application/json');
      });

      then(
        'each lifted field IS the envelope slot — one object, never a copy',
        () => {
          expect(seen.headers).toBe(seen.event.headers);
          expect(seen.payload).toBe(seen.event.payload);
        },
      );
    });

    /**
     * .what = the clamp for the DEEP freeze — fulcrum F04
     * .why = `event` is middy's own `request.event`, by reference, and `@middy/http-cors` reads
     *        `event.headers` in its `after` hook — after the handler has returned. so a write
     *        through it corrupts what a vendor reads, with no error anywhere
     * .note = it goes RED without `setEventFrozen`: both writes succeed silently and the
     *         assertions invert (rule.require.clamp-edge-cases)
     */
    when('[t1] a handler writes through the envelope it was handed', () => {
      const seen = useThen('the handler answers', async () => {
        /**
         * .what = names the outcome of ONE write attempt
         * .why = a pure transformer, so each attempt reports by RETURN rather than by a push
         *        into a shared array. the defect arm is `'the write LANDED'`, which is a value
         *        no assertion below expects — so a silent freeze regression fails by name
         */
        const asWriteOutcome = (input: { write: () => void }): string => {
          try {
            input.write();
            return 'the write LANDED';
          } catch (error) {
            return (error as Error).constructor.name;
          }
        };

        /**
         * .note = DELIBERATE MUTATION in a `const` box, exactly as `[t0]`. the outcomes are
         *         produced INSIDE the handler closure, and the response body is pinned by
         *         `schema.output` — so there is no return path to carry them out
         * .why the seed = `'never invoked'`, so a run that never reaches the handler fails with
         *         a value that names the cause. it is the positive control on the observation
         */
        const observed: { event: string; headers: string } = {
          event: 'never invoked',
          headers: 'never invoked',
        };

        const handler = forApiGateway({
          schema,
          invoke: async ({ event, headers }) => {
            // the envelope itself
            observed.event = asWriteOutcome({
              write: () => {
                (event as unknown as { path: string }).path = '/hijacked';
              },
            });

            // and its PROJECTION — the bag cors reads. a shallow freeze would let this pass
            observed.headers = asWriteOutcome({
              write: () => {
                (headers as Record<string, string>).origin =
                  'https://evil.test';
              },
            });

            return { payload: { ok: true } };
          },
        });

        const wire = await handler(
          createV1Event({ name: 'Kai' }),
          createMockContext(),
        );
        return { ...observed, wire };
      });

      then('a write to the envelope THROWS rather than land', () => {
        expect(seen.event).toBe('TypeError');
      });

      then('a write to the lifted bag throws too — the freeze is deep', () => {
        expect(seen.headers).toBe('TypeError');
      });

      /**
       * .what = the whole freeze hand-off — both what the author is told and what the caller
       *            receives, pinned as one object
       * .why = the two assertions above each name one outcome string and say naught about the
       *        wire (`rule.require.acceptance-journey-coverage`)
       * .note = the pair is snapshotted together on purpose: the claim is that the freeze refuses
       *         both writes and leaves the response intact. two separate snapshots would each go
       *         green while the two drifted apart
       */
      then('the whole freeze hand-off matches snapshot', () => {
        expect({
          refused: { event: seen.event, headers: seen.headers },
          wire: asResponseOnwireSnapshot({ wire: seen.wire }),
        }).toMatchSnapshot();
      });
    });

    /**
     * .what = the freeze journey a real author meets — a write with no `try`, so the throw
     *            escapes `invoke`
     * .why = `[t1]` catches its own writes, which is what makes it a clamp. but no author writes
     *        a `try` around a line they do not yet know will throw, so `[t1]` demonstrates the
     *        mechanism and not the experience
     * .note = this is the arm a caller sees. `[t1]` is the arm the handler sees
     */
    when(
      '[t2] the write escapes `invoke` — no `try`, as an author writes it',
      () => {
        const result = useThen(
          'the sdk answers on the handler behalf',
          async () => {
            const handler = forApiGateway({
              schema,
              invoke: async ({ event }) => {
                // the shape an author writes before they learn the envelope is frozen
                (event as unknown as { path: string }).path = '/hijacked';
                return { payload: { ok: true } };
              },
            });

            return handler(createV1Event({ name: 'Kai' }), createMockContext());
          },
        );

        then('the caller meets a 500, never a silently corrupted 200', () => {
          expect(result.statusCode).toBe(500);
        });

        /**
         * .what = the whole 500 wire of the escaped freeze throw
         * .why = a `TypeError` from a frozen write carries a v8 message about the property and the
         *        object. a snapshot is the only check that can show whether that internal text
         *        reaches the caller — an assertion can only name a field it already suspects
         *        (`rule.require.snapshots-deny-volatile-not-allow-expected`)
         *
         * .measured = the body is generic. `errorType: 'InternalServiceError'`, a masked
         *      correlation id, and no `TypeError` text, no `/hijacked`, no stack. so the sdk
         *      leaks naught of the handler's internals on an escaped throw
         * .note = it is pinned in the denylist direction: the day a change starts to forward
         *      v8's message to the caller, this goes red. an assertion on `statusCode` alone
         *      could not
         */
        then('the whole 500 wire matches snapshot', () => {
          expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
        });
      },
    );
  });

  /**
   * .what = the clamp for the header merge — the zod-strip trap, sharpened
   * .why = zod strips unknown keys, so a schema that names only `authorization` yields a bag with
   *        no `origin`. a wholesale write-back would hand that to `@middy/http-cors`, which reads
   *        `origin` out of this slot (`index.js:84`) and, with an allowlist, answers
   *        `options.origins[0]` unconditionally when it finds none (`index.js:2-14`) — so a
   *        caller from the second allowlisted origin would receive the first, and the browser
   *        would refuse a response this sdk allowlisted
   *
   * .note = it goes red with a replace in place of the merge: `Access-Control-Allow-Origin`
   *         comes back `https://a.test` rather than the caller's own
   *         (rule.require.clamp-edge-cases)
   */
  given('[case18] a header schema that names one key, beside cors', () => {
    const handler = forApiGateway({
      schema: {
        input: z.object({
          headers: z.object({ authorization: z.string() }),
          payload: z.object({ name: z.string() }),
        }),
        output: z.any(),
      },
      cors: {
        origins: ['https://a.test', 'https://b.test'],
        credentials: false,
      },
      invoke: async ({ headers }) => {
        /**
         * .what = a type-level clamp, beside the runtime ones below
         * .why = `ApiGatewayHeadersMerged<THeadersDeclared>` intersects the author's declared keys
         *        with the open wire record, and each half carries a guarantee:
         *
         *        - the annotation `: string` fails to compile if the declared half ever
         *          widens to `string | undefined` — which is what a reader is promised
         *          when they name a key in `schema.input.headers`
         *        - the `x-forwarded-for` read fails to compile if the open half is dropped
         *          in favor of `THeadersDeclared` alone — the regression of today's plain-record
         *          access that `ApiGatewayRequestEventUnified.ts:20-34` names
         *
         * .note = this pair goes red under `--what types`, never at run time. it is the only
         *         clamp on this route that a green test suite alone would not catch
         */
        const saw: string = headers.authorization;
        const forwarded = headers['x-forwarded-for'];

        return { payload: { saw, forwarded: forwarded ?? null } };
      },
    });

    when('[t0] a caller from the second allowlisted origin calls', () => {
      const result = useThen('the handler answers', async () => {
        const event = createV1Event({ name: 'Kai' });
        (event.headers as Record<string, string>).Authorization = 'Bearer tok';
        (event.headers as Record<string, string>).Origin = 'https://b.test';

        return handler(event, createMockContext());
      });

      then('the declared header still reaches the handler', () => {
        expect(asParsedResponseBody({ response: result }).saw).toBe(
          'Bearer tok',
        );
      });

      then(
        'cors echoes the caller origin, not the first allowlisted one',
        () => {
          expect(result.headers?.['Access-Control-Allow-Origin']).toBe(
            'https://b.test',
          );
        },
      );

      /**
       * .what = the whole wire of the header-merge positive arm, denied-not-allowed
       * .why = the two assertions above each name one field — a body key and one header. so a
       *        header this route never named is invisible to both, which is the allowlist
       *        failure mode `asResponseOnwireSnapshot` exists to close
       *        (rule.require.snapshots-deny-volatile-not-allow-expected)
       * .note = no extant snapshot holds this shape: `[case3]` allowlists one origin, so its
       *         `Access-Control-Allow-Origin` cannot tell an echo from `origins[0]`
       *
       * .to check it bites = edit `Access-Control-Allow-Origin` in the `.snap` to
       *         `https://a.test` — `origins[0]`, which is precisely the merge regression this
       *         case exists to catch — and re-run without `--resnap`
       */
      then('the whole response wire matches snapshot', () => {
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });

    /**
     * .what = the refusal arm of header validation — the one behavior this route adds that can
     *            refuse a request. the positive arm is `[t0]`; `[case17][t0]` is the opt-out arm
     * .why = a regression that stopped enforcement of the `headers` half passes every other
     *        test in this file: `[t0]` sends a valid header and asserts it arrives, which a
     *        middleware that validates `payload` alone also satisfies
     *
     * .note = the violation is an absent `authorization`, which is the realistic one — http
     *         header values are strings on the wire, so a type mismatch cannot arise there.
     *         the schema is `z.string()`, so absent is the refusal zod can render
     *
     * .note = the three assertions are graded, never redundant. the 400 alone would pass under
     *         a middleware that refused every request; the field path is what proves the
     *         refusal came from the header half rather than from `payload`
     *
     * .to check it bites = in `genZodInputValidationMiddleware`, feed the parse a header bag
     *         that always satisfies — `headers: { ...event.headers, authorization: 'stub' }`.
     *         all three assertions below go red (the 400 reads 200) while `[t0]`'s cors echo
     *         stays green, since the merge is a separate guarantee
     */
    when('[t1] a caller omits the declared `authorization` header', () => {
      const result = useThen('the sdk answers', async () => {
        const event = createV1Event({ name: 'Kai' });
        // deliberately no `Authorization` — the schema at `[case18]` requires it
        (event.headers as Record<string, string>).Origin = 'https://b.test';

        return handler(event, createMockContext());
      });

      then('the request is refused with a 400, never served', () => {
        expect(result.statusCode).toBe(400);
        expect(result.statusCode).not.toBe(200);
      });

      then('the error names the header field at fault, not the payload', () => {
        const body = asParsedResponseBody({ response: result });

        // the path proves which half refused — a payload-only validator cannot produce it
        expect(body.details.issues[0].path).toBe('headers.authorization');
        expect(body.errorMessage).toContain('headers.authorization');
      });

      then('the payload half is not blamed for a header fault', () => {
        const body = asParsedResponseBody({ response: result });
        const paths = body.details.issues.map(
          (issue: { path: string }) => issue.path,
        );
        expect(paths).not.toContain('payload.name');
      });

      /**
       * .what = the whole wire of the one refusal this route adds — a 400 whose fault path
       *            names a header
       * .why = every other 400 snapshot in this repo pins a payload refusal
       *        (`local.sdkContract [t1-t4]`, `local.payloadCompat [t1]`). the three assertions
       *        above each name one field of the body and none names a header — and a refusal
       *        carries the cors and content-type headers a browser acts on
       * .note = `asResponseOnwireSnapshot` masks the trail exid, so the `correlationId`'s
       *         presence is pinned where its value would churn every run
       *
       * .defect = live, not fixed — this snapshot pins a defect rather than endorse it. the 400
       *         carries one header (`Content-Type`) where `[t0]`'s 200 carries twelve. the cors
       *         and owasp headers are absent, so a browser refuses this refusal and the caller
       *         sees a network error in place of the field name the body took care to name
       *
       *         .the record = `.dream/v2026_09_22.fix.no-cors-or-owasp-headers-on-error-responses.md`
       *         .the repair, unapplied = both vendors sit below the error builders in the chain
       *            array, and the fix reaches every family
       *         .when it lands = this snapshot goes red, and that is correct. do not re-snap it
       *            back; the 12-header shape is the right one
       *         (rule.require.deferred-defect-records-lead-with-status)
       */
      then('the whole refusal wire matches snapshot', () => {
        expect(asResponseOnwireSnapshot({ wire: result })).toMatchSnapshot();
      });
    });
  });

  given('[case19] one webhook crosses every boundary', () => {
    /**
     * .what = the densest walk — `headers`, `payload`, `event`, and `event._.raw` read in one
     *            handler, on both wire versions
     * .why = every other case reads one source, so none can observe two sources disagree.
     *        three interaction defects are visible only here:
     *
     *        - `event` bound to `_.raw` rather than to the reconciled shape — v1's raw carries
     *          `httpMethod` at the top level, so a v1-only arm passes against that mis-wire.
     *          `[t1]` does not
     *        - the cors seam starved on the v2 arm alone — `[case17]` runs one version
     *        - `payload` and `event` transposed — the two fields this route renames into each
     *          other's former senses, so a swapped bind is plausible. only a handler that
     *          reads both in one body can catch it
     *
     * .note = one handler const serves both arms, deliberately. that the same closure answers
     *         a v1 and a v2 wire is the version-invariance claim, proven by one artifact
     *         rather than asserted once per case (experience `case=5`, `[t3]`)
     *
     * .to check it bites = in `forApiGateway.ts`, hand `invoke` the raw union's own fields in
     *         place of the reconciled ones — `{ ...event._.raw, _, headers, payload }`. `[t1]`,
     *         `[t2]`, and `[t3]` go red while `[t0]` stays green, since the mis-wire is
     *         invisible on v1 — which is the arm that earns this case its place
     */
    const handler = forApiGateway({
      schema: {
        input: z.object({
          headers: z.object({ 'x-signature': z.string() }),
          payload: z.object({ amount: z.number() }),
        }),
        output: asApiGatewayResponseSchema({
          payload: z.object({
            signature: z.string(),
            method: z.string(),
            path: z.string(),
            amount: z.number(),
            rawBodyViaEscapeHatch: z.string().nullable(),
            rawMethodTop: z.string().nullable(),
            rawMethodNested: z.string().nullable(),
          }),
        }),
      },
      // `credentials: false` so the wildcard stays a literal `*`, rather than an echo of the
      // caller origin — `[case18]` already owns the echo arm, and this walk must not duplicate it
      cors: { origins: '*', credentials: false },
      invoke: async ({ headers, payload, event }) => {
        /**
         * .note = the union at `_` forces this narrow, and that is the whole job of the mark:
         *         a paved read (`event.method`) needs none because the sdk reconciled it, and
         *         a read through `_` is version-locked again — so the compiler says so
         */
        const raw = event._.raw;

        return {
          payload: {
            signature: headers['x-signature'],
            method: event.method,
            path: 'path' in raw ? raw.path : raw.requestContext.http.path,
            amount: payload.amount,

            /**
             * .what = the signature-verify boundary — a handler that verifies a signature
             *         covers the bytes, never the parsed value, so it needs the body string
             * .note = `_.raw.body` is `string | null | undefined` — the union of v1's
             *         `string | null` and v2's `string | undefined`. the `?? null` collapses
             *         it, which is why the envelope carries no reconciled body-string slot of
             *         its own: a slot that saves a caller one `??` is not a slot
             */
            rawBodyViaEscapeHatch: raw.body ?? null,

            rawMethodTop: 'httpMethod' in raw ? raw.httpMethod : null,
            rawMethodNested:
              'http' in raw.requestContext
                ? raw.requestContext.http.method
                : null,
          },
        };
      },
    });

    const askWith = async (version: ApiGatewayOnwireVersion) =>
      handler(
        asApiGatewayRequestEventOnwire({
          version,
          method: 'POST',
          url: '/charge',
          /**
           * .note = capitalized on purpose. the declared schema key is `x-signature`,
           *         lowercase, so the case-fold is under test beside every other boundary
           *         here — on both versions, which is where the fold's whole risk sits
           */
          headers: {
            'Content-Type': 'application/json',
            'X-Signature': 'sig-abc',
            Origin: 'https://spa.test',
          },
          body: JSON.stringify({ amount: 4200 }),
        }),
        createMockContext(),
      );

    when('[t0] a v1 request arrives, POST /charge, signed', () => {
      const result = useThen('the handler answers', async () => askWith('v1'));

      then('all boundaries read through', () => {
        expect(asParsedResponseBody({ response: result })).toEqual({
          signature: 'sig-abc', // 1 — the header lift, folded to lowercase
          method: 'POST', // 2 — the envelope
          path: '/charge', //     "
          amount: 4200, // 3 — the validated body
          rawBodyViaEscapeHatch: '{"amount":4200}', // 4 — the bytes, via `_.raw`
          rawMethodTop: 'POST', // 5 — the escape hatch
          rawMethodNested: null, //     v1 holds no nested method
        });
      });

      then('the reconciled shape and the raw shape agree on this arm', () => {
        const body = asParsedResponseBody({ response: result });

        // which is precisely why this arm alone cannot tell them apart. [t1] can
        expect(body.rawMethodTop).toBe(body.method);
      });
    });

    when('[t1] the identical request arrives as a v2 wire form', () => {
      const result = useThen('the handler answers', async () => askWith('v2'));

      then('every paved read is unchanged', () => {
        const body = asParsedResponseBody({ response: result });

        expect(body.signature).toBe('sig-abc');
        expect(body.method).toBe('POST');
        expect(body.path).toBe('/charge');
        expect(body.amount).toBe(4200);

        // the verify boundary survives the version change with no envelope slot of its own —
        // `_.raw.body ?? null` reads the same on both arms
        expect(body.rawBodyViaEscapeHatch).toBe('{"amount":4200}');
      });

      then(
        'the raw shape diverges — the assertion no other case can make',
        () => {
          const body = asParsedResponseBody({ response: result });

          // v2 drops the top-level method and moves it under `requestContext.http`
          expect(body.rawMethodTop).toBe(null);
          expect(body.rawMethodNested).toBe('POST');

          // so `event` is not `_.raw`. a build that bound the two together passes every
          // [t0] assertion above and fails exactly this pair
          expect(body.method).not.toBe(body.rawMethodTop);
        },
      );
    });

    /**
     * .what = the pair both `[t2]` and `[t3]` read, derived once at the `given` scope
     * .why = each block needs the same two answers, and a peer `when` that re-derives them
     *        runs the whole composed chain twice more — 4 invocations where 2 serve
     *        (rule.forbid.redundant-expensive-operations)
     * .note = the share is not merely cheaper, it is stricter: `[t3]`'s whole claim is that
     *         these two arms agree on the paved surface, which is a claim about one pair of
     *         answers. re-derived answers could agree while the pair `[t2]` snapshotted did not
     *
     * .why not `useWhen`, which the rule's own brief prescribes for this = `useWhen` takes a
     *         `desc` and never reads it (`test-fns/dist/domain.operations/useWhen.js:4-21`,
     *         whose own doc says it creates no nested `when` block). it runs at collection, so
     *         every `then` inside it registers against the parent `given` — the label vanishes
     *         from the output and the blocks hoist out of order. this suite's `[caseN]`/`[tN]`
     *         markers are how every artifact on this route cites a clamp, so the `const` is
     *         used instead: the identical cut to 2 invocations, with both blocks real `when`s,
     *         labelled and in order
     */
    const answered = {
      v1: useThen('[t2·a] the v1 arm answers', async () => askWith('v1')),
      v2: useThen('[t2·b] the v2 arm answers', async () => askWith('v2')),
    };

    when('[t2] either response leaves the chain', () => {
      then('cors echoes on both versions', () => {
        // proves the header lift starved no vendor seam. `[case17]` proves it on one version
        expect(answered.v1.headers?.['Access-Control-Allow-Origin']).toBe('*');
        expect(answered.v2.headers?.['Access-Control-Allow-Origin']).toBe('*');
      });

      /**
       * .what = the whole wire of both arms, snapshotted as one pair
       * .why = the assertion above names one header key, and `[t3]` compares the parsed body
       *        only — so every other header is unchecked on both arms. this is the one place
       *        on the route where two wire versions answer the same request, and the contract
       *        claim is that their wire output is indistinguishable. a reviewer reads that off
       *        one artifact here; no count of `toBe`s shows it
       * .note = snapshotted as a `{ v1, v2 }` pair, on purpose. two separate snapshots would
       *         each go green on its own while the two drifted apart — the pair cannot
       */
      then('both wires match snapshot, as a pair', () => {
        expect({
          v1: asResponseOnwireSnapshot({ wire: answered.v1 }),
          v2: asResponseOnwireSnapshot({ wire: answered.v2 }),
        }).toMatchSnapshot();
      });
    });

    when('[t3] the two arms are set side by side', () => {
      then('every paved read matches; only the `_` reads differ', () => {
        // the same pair `[t2]` snapshotted, shared rather than re-derived
        const bodyV1 = asParsedResponseBody({ response: answered.v1 });
        const bodyV2 = asParsedResponseBody({ response: answered.v2 });

        // the paved surface — version-agnostic by contract, so it must match.
        // `rawBodyViaEscapeHatch` sits here too, and it reads through `_` — the one `_` read
        // that agrees across arms, because `?? null` collapses the version artifact. that
        // agreement is why the envelope carries no reconciled body-string slot
        expect({
          signature: bodyV2.signature,
          method: bodyV2.method,
          path: bodyV2.path,
          amount: bodyV2.amount,
          rawBodyViaEscapeHatch: bodyV2.rawBodyViaEscapeHatch,
        }).toEqual({
          signature: bodyV1.signature,
          method: bodyV1.method,
          path: bodyV1.path,
          amount: bodyV1.amount,
          rawBodyViaEscapeHatch: bodyV1.rawBodyViaEscapeHatch,
        });

        // the `_` surface — version-locked by contract, so it must not match
        expect([bodyV2.rawMethodTop, bodyV2.rawMethodNested]).not.toEqual([
          bodyV1.rawMethodTop,
          bodyV1.rawMethodNested,
        ]);
      });
    });
  });

  /**
   * .what = the type-level clamp on `THeaders`'s bound. run by `--what types`, never at run
   *            time — `@ts-expect-error` inverts, so a lost bound fails tsc on the unused
   *            directive rather than slip past a green suite
   * .why = the validator spreads the validated headers over the wire bag
   *        (`genZodInputValidationMiddleware.ts:111`). unbound, `headers: z.string()` compiles
   *        clean and then spreads a string's indices into the very slot `@middy/http-cors`
   *        reads — `{ 0: 'a', 1: 'b', … }`, no throw, no compile error
   *
   * .to check it bites = widen `ApiGatewayHeadersDeclared` to `unknown` and re-run `tsc`. it
   *        fails with exactly two `TS2578: Unused '@ts-expect-error' directive` — one per
   *        refusal below — and none on the two controls, so the clamp bites narrowly. a third
   *        error comes free and is the sharper evidence:
   *        `genZodInputValidationMiddleware.ts(129,41): TS2698: Spread types may only be
   *        created from object types` — the bound is the premise the write-back's own spread
   *        rests on (rule.require.clamp-edge-cases)
   */
  given('[case20] a header schema that is not a record', () => {
    when('[t0] the declared type is checked', () => {
      then('a scalar header schema is refused at compile time', () => {
        const declareScalar = () =>
          forApiGateway({
            schema: {
              // @ts-expect-error — `string` is no record; the spread would inject its indices
              input: z.object({ headers: z.string(), payload: z.any() }),
              output: z.any(),
            },
            invoke: async () => ({ status: 204 }),
          });

        const declareList = () =>
          forApiGateway({
            schema: {
              // @ts-expect-error — an array is no record either; same spread hazard
              input: z.object({
                headers: z.array(z.string()),
                payload: z.any(),
              }),
              output: z.any(),
            },
            invoke: async () => ({ status: 204 }),
          });

        expect(typeof declareScalar).toEqual('function');
        expect(typeof declareList).toEqual('function');
      });

      /**
       * .why these controls = without them the two refusals above would also be satisfied by
       *        a bound so tight that no header schema compiles. these prove the refusal is
       *        narrow: the two shapes a real author writes still compile
       */
      then('a record header schema still compiles — the control', () => {
        const declareObject = () =>
          forApiGateway({
            schema: {
              input: z.object({
                headers: z.object({ authorization: z.string() }),
                payload: z.any(),
              }),
              output: z.any(),
            },
            invoke: async ({ headers }) => ({ payload: headers.authorization }),
          });

        const declareAbsent = () =>
          forApiGateway({
            schema: {
              input: z.object({ payload: z.object({ to: z.string() }) }),
              output: z.any(),
            },
            invoke: async ({ payload }) => ({ payload: payload.to }),
          });

        expect(typeof declareObject).toEqual('function');
        expect(typeof declareAbsent).toEqual('function');
      });
    });
  });

  /**
   * .what = `event` is the envelope and `payload` is the body — held by the type checker
   * .why = the two words sit side by side in one bag, and a body read off `event` is the one
   *        slip whose key exists. so tsc must refuse the read at the use, where no absent key
   *        can name it
   *
   * .why a type clamp and not a run = the refusal is compile-time by nature, so no green suite
   *        can prove it. `@ts-expect-error` inverts: the day a body read off `event` compiles,
   *        `tsc` fails on the unused directive. `--what types` is the enforcement
   *
   * .to check it bites = retype `ForApiGatewayInput`'s `invoke` bag so `event` holds the body,
   *        and re-run `tsc`. it reports exactly one `TS2578: Unused '@ts-expect-error'
   *        directive`, at `[t0]` (rule.require.clamp-edge-cases)
   * .the controls fail on a different code = `[t1]` and `[t2]` each raise a plain `TS2339`,
   *        never a `TS2578`. so the refusal keys on the shape, and an `event` broken outright
   *        cannot satisfy it
   */
  given('[case21] a handler that reads the body', () => {
    const schema = {
      input: z.object({ payload: z.object({ name: z.string() }) }),
      output: z.any(),
    };

    when(
      '[t0] it destructures `{ event }` and reads a BODY field off it',
      () => {
        then('typescript refuses it — `event` is the envelope', () => {
          const readStaleBody = () =>
            forApiGateway({
              schema,
              // @ts-expect-error — the envelope has no `.name`; the error names its own fields
              invoke: async ({ event }) => ({ payload: event.name }),
            });

          expect(typeof readStaleBody).toEqual('function');
        });
      },
    );

    when('[t1] it destructures `{ payload }` and reads the same field', () => {
      then('it compiles', () => {
        const readPayload = () =>
          forApiGateway({
            schema,
            invoke: async ({ payload }) => ({ payload: payload.name }),
          });

        expect(typeof readPayload).toEqual('function');
      });
    });

    /**
     * .why this control = without it, the refusal above would also be satisfied by an
     *        `event` broken outright. this proves the refusal is NARROW — the envelope's own
     *        fields still read, so `[t0]` refuses the body SENSE rather than the field
     */
    when('[t2] it destructures `{ event }` and reads an ENVELOPE field', () => {
      then('it compiles', () => {
        const readEnvelope = () =>
          forApiGateway({
            schema,
            invoke: async ({ event }) => ({
              payload: {
                method: event.method,
                id: event._.raw.requestContext.requestId,
              },
            }),
          });

        expect(typeof readEnvelope).toEqual('function');
      });
    });
  });

  /**
   * .what = the type-level clamp on `ApiGatewayHeadersMerged`'s absent-key arm. run by
   *            `--what types`, never at run time
   * .why = `ApiGatewayHeadersDeclared` is `ApiGatewayHeadersOnwire | undefined`, and `undefined`
   *        is a real declared state — it denotes *"this author constrains no header"*, which is
   *        the status quo for every production site that reads headers with no guard. so
   *        `ApiGatewayHeadersMerged<undefined>` is a shape a real caller reaches, and an
   *        intersection collapses it: `undefined & Record<string, string | undefined>` reduces
   *        to `never`, which is assignable to each type and refuses naught
   *
   * .why `[case18]` cannot catch it = that clamp asserts `const saw: string = headers.x`, and
   *        `never` satisfies exactly that. a clamp whose assertion a `never` also satisfies is a
   *        clamp with no teeth (`rule.require.clamp-edge-cases`) — which is why this one asserts
   *        a refusal rather than an acceptance
   */
  given('[case22] a handler that declares no header schema', () => {
    when('[t0] it reads a wire header off the lifted bag', () => {
      then('the bag is the wire record, never `never`', () => {
        const readUndeclared = () =>
          forApiGateway({
            schema: {
              input: z.object({ payload: z.object({ to: z.string() }) }),
              output: z.any(),
            },
            invoke: async ({ headers }) => {
              // the open read — every wire key still reachable, value `string | undefined`
              const auth: string | undefined = headers.authorization;

              /**
               * .note = the refusal, and the whole point of this case. a wire header is a
               *         string or absent, so a `number` must not take it. under a `never` bag
               *         this line compiles and the directive goes unused — `TS2578`, which is
               *         how the clamp bites
               */
              // @ts-expect-error — a wire header is `string | undefined`, never a number
              const wrong: number = headers['x-retry'];

              return { payload: { auth, wrong } };
            },
          });

        expect(typeof readUndeclared).toEqual('function');
      });
    });

    /**
     * .why this control = without it the refusal above would also be satisfied by a bag typed
     *        so tightly that the declared arm breaks. this proves the repair is narrow — an
     *        author who declares one key still gets the narrow type on it and the open read
     *        beside it, which is `[case18]`'s pair, re-asserted here against the same type
     */
    when('[t1] a peer handler declares one key — the control', () => {
      then('the declared key narrows and the open read survives', () => {
        const readDeclared = () =>
          forApiGateway({
            schema: {
              input: z.object({
                headers: z.object({ authorization: z.string() }),
                payload: z.any(),
              }),
              output: z.any(),
            },
            invoke: async ({ headers }) => {
              // the declared half — narrowed to `string`, so no absent check is owed
              const auth: string = headers.authorization;

              // the open half — a key no schema names, still reachable
              const fwd: string | undefined = headers['x-forwarded-for'];

              return { payload: { auth, fwd } };
            },
          });

        expect(typeof readDeclared).toEqual('function');
      });
    });
  });

  /**
   * .what = the type-level clamp on `ApiGatewayHeadersMerged` read directly, off the public
   *            export rather than through `forApiGateway`
   * .why = `[case22]` enters through the factory, and the factory's inference hides the defect:
   *        with no `headers` key `THeaders` has no inference site, so it falls back to its
   *        constraint `ApiGatewayHeadersOnwire | undefined` — a union, which distributes through
   *        an intersection and leaves the record arm alive. so `[case22]` passes under the
   *        broken type and under the repaired one alike
   *
   * .note = the defect is reachable only where a consumer writes the type by hand, which
   *        `src/index.ts` lets them do. a clamp that enters through the one harness the sdk
   *        provides cannot deliver the arm that breaks
   *        (`rule.require.a-harness-types-as-wide-as-its-contract`)
   *
   * .to check it bites = revert `ApiGatewayHeadersMerged` to the bare intersection and re-run
   *        `tsc`. it fails with exactly two errors, both inside `[t0]`:
   *          `TS2322: Type 'false' is not assignable to type 'true'`           <- the IsNever read
   *          `TS2339: Property 'authorization' does not exist on type 'never'` <- the index read
   *        while `[t1]`, `[t2]`, `[t3]`, and every case in `[case22]` stay green — so this is
   *        the only clamp in this file that reaches the defect
   *        (rule.require.clamp-edge-cases, both directions)
   *
   * .note = the second error also prices the defect: an index of a `never` bag is loud, so a
   *        consumer who reads one header meets a baffling message. a hand-off of the whole bag
   *        is silent — `never` is assignable to each type — so a consumer who forwards it meets
   *        no error at all, and the lie travels downstream
   */
  given('[case23] the merged header type, read off the public export', () => {
    when('[t0] the ABSENT-key arm is named directly', () => {
      then('it is the wire record, never `never`', () => {
        const absentArmIsNever: IsNever<ApiGatewayHeadersMerged<undefined>> =
          false;

        // and the arm carries a real read, which `never` could not
        const probe = (headers: ApiGatewayHeadersMerged<undefined>) =>
          headers.authorization;

        expect([absentArmIsNever, typeof probe]).toEqual([false, 'function']);
      });
    });

    /**
     * .why this control = the arm the FACTORY produces. it was sound before the repair and
     *        must stay sound after, else the fix traded one broken arm for another
     */
    when(
      '[t1] the arm inference actually produces is named — the control',
      () => {
        then('the union distributes and the record arm survives', () => {
          const inferredArmIsNever: IsNever<
            ApiGatewayHeadersMerged<ApiGatewayHeadersOnwire | undefined>
          > = false;

          expect(inferredArmIsNever).toEqual(false);
        });
      },
    );

    /**
     * .why this control = proves the repair did not flatten the DECLARED arm. a conditional
     *        that returned the wire record unconditionally would satisfy `[t0]` and `[t1]` both,
     *        and silently drop every narrow type an author declared
     */
    when('[t2] a DECLARED key is named — the control', () => {
      then('the declared half narrows and the open half survives', () => {
        const read = (
          headers: ApiGatewayHeadersMerged<{ authorization: string }>,
        ) => {
          // the declared half — narrow, so no absent check is owed
          const auth: string = headers.authorization;

          // the open half — a key no schema names
          const fwd: string | undefined = headers['x-forwarded-for'];

          return { auth, fwd };
        };

        expect(typeof read).toEqual('function');
      });
    });

    /**
     * .what = where a header transform out of the string domain is actually caught
     * .why = it is refused at the bound, before `ApiGatewayHeadersMerged` is ever reached —
     *        `Type 'number' is not assignable to type 'string'`, with the key named. so it is
     *        not the `never` collapse `[t0]` clamps, and the two must not be conflated
     */
    when('[t3] a header transform leaves the string domain', () => {
      then('it is refused at the bound, never silently `never`', () => {
        const declareNumeric = () =>
          forApiGateway({
            schema: {
              // @ts-expect-error — the bound admits strings; a `number` output is refused here
              input: z.object({
                headers: z.object({ 'x-retry': z.string().transform(Number) }),
                payload: z.any(),
              }),
              output: z.any(),
            },
            invoke: async () => ({ status: 204 }),
          });

        // the control — a transform that stays a string is fine, so the refusal is narrow
        const declareTrimmed = () =>
          forApiGateway({
            schema: {
              input: z.object({
                headers: z.object({
                  authorization: z.string().transform((raw) => raw.trim()),
                }),
                payload: z.any(),
              }),
              output: z.any(),
            },
            invoke: async ({ headers }) => ({ payload: headers.authorization }),
          });

        expect([typeof declareNumeric, typeof declareTrimmed]).toEqual([
          'function',
          'function',
        ]);
      });
    });
  });

  /**
   * .what = a BODY-LESS response envelope, driven through a real `{ introspect: 'schema' }`
   *         request
   * .why = the introspection cases each declare a real body, and the body-less cases never send
   *        an introspect request, so the crossing is covered only here
   *        (rule.require.sweep-the-defect-class)
   *
   * .note = zod cannot represent `undefined` in json schema, at any position. so
   *         `getJsonSchemaFromZod` renders an absent position as `{ not: {} }`, and each
   *         body-less candidate below must publish rather than crash `getAllLambdaContracts`
   *         for the whole service (rule.require.measure-the-value-you-emit)
   */
  given(
    '[case24] a body-less envelope, met by an introspection request',
    () => {
      const inputSchema = z.object({ name: z.string() });

      const asIntrospectionOf = async (body: z.ZodType) => {
        const handler = forApiGateway(
          {
            schema: {
              input: z.object({ payload: inputSchema }),
              output: asApiGatewayResponseSchema({ payload: body }),
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
              expect(body.output.properties.payload).toEqual({ not: {} });
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
              expect(body.output.properties.payload).toEqual({ not: {} });
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
          expect(body.output.properties.payload).toEqual({});
        });
      });
    },
  );

  /**
   * .what = a validated domain object reaches `invoke` as a live instance, through THIS family's
   *         real exported handler
   * .why = the forAsk peer clamp does not transfer: this family reconciles the envelope first and
   *        validates the `{ headers, payload }` pair, and its chain order breaks silently — no
   *        throw, no log, no type error (rule.require.retest-the-model-on-every-family)
   *
   * .note = the assertion runs INSIDE `invoke`; the return crosses output validation and the
   *         serializer afterwards, so a check on the result would grade the wrong border
   *
   * ⚠️ .to prove it bites = in `genZodInputValidationMiddleware`, drop the write-back
   *    `event.payload = inputAfter.payload`. every `[t0]` instance row goes red; `[t1]` (the
   *    400), the positive control (the 204), and the `signup.note` row (the wrapper survives)
   *    stay green. and swap `spot: SurfSpot.contract()` for `SurfSpot.schema`: only the `spot`
   *    row goes red, so that row grades the plain-wrapper axis alone
   *    (rule.require.clamp-edge-cases)
   */
  given(
    '[case25] a domain object in the schema, through the wired handler',
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
          payload: z.object({
            surfer: Surfer.contract(), // depth 0
            crew: z.array(Surfer.contract()), // depth 1, inside an array
            /**
             * ⚠️ .why the PLAIN WRAPPER is here = it is the evidence the wish was written from,
             *    and it was absent from this case for three rounds.
             *    `configureProxyPhoneNumber.ts` hand-hydrated `assignment.agent` — a dobj one
             *    level under a PLAIN (non-dobj) object, itself `.nullable()`. the peer
             *    `forAsk [case11]` carries all three shapes; this family carried two,
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
        }),
        output: asApiGatewayResponseSchema({ payload: z.undefined() }),
      };

      const bodyOnwire = {
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
            invoke: async ({ payload }) => {
              // ⚠️ captured INSIDE invoke, deliberately — see the `.note` above
              captured.surfer = payload.surfer;
              captured.home = payload.surfer.home;
              captured.crewFirst = payload.crew[0];
              captured.signup = payload.signup;
              captured.signupSpot = payload.signup?.spot;
              captured.signupNote = payload.signup?.note;
              return { status: 204 };
            },
          });

          const result = await handler(
            createV1Event(bodyOnwire),
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
              ...bodyOnwire,
              surfer: { uuid: 'u-1', handle: 'kai', home: {} },
            }),
            createMockContext(),
          );

          return {
            reached,
            status: result.statusCode,
            payload: asResponseOnwireSnapshot({ wire: result }),
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
         *   because the whole body is the contract (`asResponseOnwireSnapshot` denies the volatile
         *   exid and keeps every other key —
         *   rule.require.snapshots-deny-volatile-not-allow-expected)
         *
         * 🟡 .what this snapshot PINS that may surprise a reader = the refusal carries
         *    `Content-Type` and NOT ONE owasp header, where every 200 in this file carries the
         *    full set. that is KNOWN and documented in `genLambdaEndpoint.forApiGateway.ts`
         *    (`6  @middy/http-security-headers       -> so no owasp on a 4xx/5xx`) — a hook-order
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
    '[case26] a nullable domain object in the response BODY, onto the wire',
    () => {
      /**
       * ⚠️ .why this case exists = the FAMILY axis of a sweep miss a peer named. the gap it
       *    reported was "a nullable dobj at the output border", and the mirror it asked for is
       *    `forAsk [case12]`. this is the second axis of that same cause: THIS family
       *    had no dobj at its output border at ALL — nullable or otherwise
       *    (rule.require.sweep-the-defect-class — the cause named no family, so it has two)
       *
       * ⚠️ .why it is NOT a copy of the ask-family mirror = the two borders run different code
       *    past validation. `forAsk` hands the validated value back as the response, so
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
        input: z.object({ payload: z.object({ uuid: z.string() }) }),
        output: asApiGatewayResponseSchema({
          payload: z.object({ lesson: SurfLesson.contract().nullable() }),
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
            invoke: async ({ payload }) => ({
              status: 200,
              payload: {
                lesson: withImmute(
                  new SurfLesson({ uuid: payload.uuid, spot: 'pipeline' }),
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
          expect(asResponseOnwireSnapshot({ wire: outcome })).toMatchSnapshot();
        });
      });

      when('[t1] the lookup found naught, so the position is null', () => {
        const outcome = useThen('the handler answers', async () => {
          const handler = forApiGateway({
            schema,
            invoke: async () => ({ status: 200, payload: { lesson: null } }),
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
          expect(asResponseOnwireSnapshot({ wire: outcome })).toMatchSnapshot();
        });
      });
    },
  );

  given(
    '[case27] a bare `.transform()` throw on the INPUT side — F35, at THIS family',
    () => {
      /**
       * .what = a bare `Error` thrown inside a consumer's `.transform()` SETTLES as a 500 — the
       *         twin of `genLambdaEndpoint.forAsk.test.ts [case13]`
       * .why this is correct = a guard `throw` and a real null-deref inside a transform are
       *      indistinguishable — same plain `Error`, same zod frame. so a server fault is the
       *      only honest read. a consumer who MEANS a caller fault has two zod-native forms,
       *      both clamped below: `[t2]` `.refine()`, and `[t3]` `ctx.addIssue` + `z.NEVER`
       *
       * .why it differs from the ask family = this family hands
       *      `genInternalServiceErrorMiddleware` a FUNCTION rather than `false`, so the
       *      invocation settles with a 500 body instead of a rejection
       *
       * ⚠️ .to prove it bites = swap this case's `.transform()` guard for a `.refine()` with the
       *    same message: all four `[t0]` rows go red (statusCode, errorType, the swallowed
       *    message, the snapshot), while `[t1]` and `[t2]` stay green — they declare their own
       *    schemas. `[t1]` is the positive control: this family already answers a zod-class
       *    rejection with a 400, so the 500 is a property of the error CLASS
       *    (rule.require.clamp-edge-cases)
       */
      const schema = {
        input: z.object({
          payload: z.object({
            spot: z.string().transform((raw) => {
              // a consumer's OWN guard on a caller's value — the shape F35 is about
              if (raw !== 'pipeline') throw new Error('unknown surf spot');
              return raw;
            }),
          }),
        }),
        output: asApiGatewayResponseSchema({
          payload: z.object({ booked: z.boolean() }),
        }),
      };

      when('[t0] the caller sends a value the consumer guard refuses', () => {
        const outcome = useThen('the invocation SETTLES', async () => {
          const handler = forApiGateway({
            schema,
            invoke: async () => ({ status: 200, payload: { booked: true } }),
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
          expect(asResponseOnwireSnapshot({ wire: outcome })).toMatchSnapshot();
        });
      });

      when(
        '[t1] a POSITIVE CONTROL — the same family, a zod-class refusal',
        () => {
          const outcome = useThen('the invocation settles', async () => {
            const handler = forApiGateway({
              schema: {
                input: z.object({ payload: z.object({ spot: z.string() }) }),
                output: asApiGatewayResponseSchema({
                  payload: z.object({ booked: z.boolean() }),
                }),
              },
              invoke: async () => ({ status: 200, payload: { booked: true } }),
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
                payload: z.object({
                  spot: z
                    .string()
                    .refine((raw) => raw === 'pipeline', 'unknown surf spot'),
                }),
              }),
              output: asApiGatewayResponseSchema({
                payload: z.object({ booked: z.boolean() }),
              }),
            },
            invoke: async () => ({ status: 200, payload: { booked: true } }),
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
           * .note = the ask family's twin is `forAsk.test.ts [case13][t3]`, and the
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
                input: z.object({ payload: guardedInput }),
                output: asApiGatewayResponseSchema({
                  payload: z.object({ spot: z.string() }),
                }),
              },
              invoke: async ({ payload }) => ({
                status: 200,
                payload: { spot: payload.spot },
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
                input: z.object({ payload: guardedInput }),
                output: asApiGatewayResponseSchema({
                  payload: z.object({ spot: z.string() }),
                }),
              },
              invoke: async ({ payload }) => ({
                status: 200,
                payload: { spot: payload.spot },
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
    '[case28] a `.pipe()` type-shift at the OUTPUT border, at THIS family',
    () => {
      /**
       * ⚠️ .status = the defect is LIVE and NOT REPAIRED. tracked at
       *    `.dream/v2026_09_18.fix.published-face-contradicts-the-wire-for-a-pipe.md`
       *
       * .what = the twin of `genLambdaEndpoint.forAsk.test.ts [case14]`, and it exists
       *      for the same reason `[case27]` does: the pipe defect was clamped at the published
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
        input: z.object({ payload: z.object({ spot: z.string() }) }),
        output: asApiGatewayResponseSchema({
          payload: z.object({ waveHeight: z.string().pipe(z.coerce.number()) }),
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
                payload: { waveHeight: '6' },
              }) as unknown as {
                status: number;
                payload: { waveHeight: number };
              },
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
              invoke: async () => ({ status: 200, payload: { waveHeight: 6 } }),
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
            expect(
              asResponseOnwireSnapshot({ wire: outcome }),
            ).toMatchSnapshot();
          });
        },
      );
    },
  );
});
