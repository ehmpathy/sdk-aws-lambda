/**
 * .what = proves an api-gateway handler owns its own WIRE response — the bytes, not the
 *         return value
 * .why = the wish's acceptance asks for exactly this: *"coverage proves the wire bytes,
 *        not just the return value — an assertion that the handler returned
 *        `{ statusCode: 204 }` does not prove api gateway sees a 204 with no body."*
 *        so every case here goes out over real http and reads the response with `fetch`
 *
 * .note = the three shapes are the ones the extant fixed 200+json contract could not
 *         express, each drawn from a real consumer:
 *          - 204 no body    -> a twilio webhook with no reply
 *          - 308 + Location -> a short-url / cloudfront redirect
 *          - xml body       -> a twilio twiml voice response
 *
 * .note = the harness applies THIS repo's reading of aws's proxy map. it proves the sdk
 *         emits a payload that becomes the intended bytes; it does not prove aws
 *         implements the map as documented (see ehmpathy/declastruct-aws#90)
 */
import { given, then, useBeforeAll, when } from 'test-fns';
import { z } from 'zod';

import {
  asApiGatewayResponseSchema,
  BadRequestError,
  forApiGateway,
  HttpStatusCode,
} from '../src/index';
import { asWireSnapshot } from '../src/__test_assets__/asWireSnapshot';
import { genApiGatewayProxyHarness } from '../src/__test_assets__/genApiGatewayProxyHarness';
import { getOneWireResponse } from '../src/__test_assets__/getOneWireResponse';

describe('an api-gateway handler owns its own wire response', () => {
  /**
   * .what = the wish's first named shape: twilio's voice webhook, answered 204 with no body
   * .note = the request is `application/x-www-form-urlencoded` — what twilio actually posts —
   *         so this also proves the sdk leaves a form body ALONE. `deserialize.body` defaults
   *         to true and parses only `application/json`, so the handler gets the raw string
   */
  given('[case1] a twilio webhook that answers 204 with no body', () => {
    let bodyReceived: unknown = 'never invoked';

    const handler = forApiGateway({
      schema: {
        input: z.any(),
        output: asApiGatewayResponseSchema({ body: z.undefined() }),
      },
      invoke: async ({ event }) => {
        bodyReceived = event;
        return { status: 204 };
      },
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler }),
    );
    afterAll(async () => harness.close());

    when('[t0] a real form-encoded request reaches it', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({
          url: `${harness.url}/voice`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'From=%2B15551234567&To=%2B15559876543&CallStatus=ringing',
        }),
      );

      then('the wire status is 204', () => {
        expect(wire.status).toBe(204);
      });

      // a twiml renderer reads the form itself, so a silent parse would hand it the wrong type
      then('the handler receives the raw form string, never a parsed object', () => {
        expect(bodyReceived).toBe(
          'From=%2B15551234567&To=%2B15559876543&CallStatus=ringing',
        );
      });

      then('the wire body is empty — never the json-quoted `""`', () => {
        expect(wire.text).toBe('');
      });

      then('the wire carries no content-type — no bytes exist to describe', () => {
        // a content-type that contradicts the body is the twilio 11200 shape
        expect(wire.headers['content-type']).toBeUndefined();
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  given('[case2] a short-url that answers 308 with a Location header', () => {
    const destination = 'https://ehmpath.com/surf/pipeline';

    const handler = forApiGateway({
      schema: {
        input: z.any(),
        output: asApiGatewayResponseSchema({ body: z.undefined() }),
      },
      invoke: async () => ({
        // the enum, never the literal — a public export owes a consumer in its own repo
        status: HttpStatusCode.PERMANENT_REDIRECT_308,
        headers: { Location: destination },
      }),
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler }),
    );
    afterAll(async () => harness.close());

    when('[t0] a real http request reaches it', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({ url: `${harness.url}/p` }),
      );

      then('the wire status is 308', () => {
        expect(wire.status).toBe(308);
      });

      then('the wire carries the Location header', () => {
        expect(wire.headers.location).toBe(destination);
      });

      then('the wire carries no content-type — a redirect has no body', () => {
        expect(wire.headers['content-type']).toBeUndefined();
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  given('[case3] a twilio voice webhook that answers twiml xml', () => {
    const twiml = '<Response><Say>cowabunga</Say></Response>';

    const handler = forApiGateway({
      schema: {
        input: z.any(),
        output: asApiGatewayResponseSchema({ body: z.string() }),
      },
      invoke: async () => ({
        headers: { 'Content-Type': 'text/xml' },
        body: twiml,
      }),
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler }),
    );
    afterAll(async () => harness.close());

    when('[t0] a real http request reaches it', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({ url: `${harness.url}/voice` }),
      );

      then('the wire status is 200, the defaulted status', () => {
        expect(wire.status).toBe(200);
      });

      then('the wire carries text/xml, never a re-stamped application/json', () => {
        // a content-type that contradicts the body is exactly what raises twilio 11200
        expect(wire.headers['content-type']).toContain('text/xml');
      });

      then('the wire bytes are byte-identical to what the handler returned', () => {
        expect(wire.text).toBe(twiml);
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  given('[case4] a handler that returns only a body — the convenient default', () => {
    const handler = forApiGateway({
      schema: {
        input: z.object({ name: z.string() }),
        output: asApiGatewayResponseSchema({
          body: z.object({ salutation: z.string() }),
        }),
      },
      invoke: async ({ event }) => ({
        body: { salutation: `aloha, ${event.name}` },
      }),
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler }),
    );
    afterAll(async () => harness.close());

    when('[t0] a real http request reaches it', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({
          url: `${harness.url}/greet`,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'kai' }),
        }),
      );

      then('the wire status is 200 though the handler never declared it', () => {
        expect(wire.status).toBe(200);
      });

      then('the wire carries application/json, stamped by the sdk', () => {
        expect(wire.headers['content-type']).toContain('application/json');
      });

      then('the wire body is the json-encoded body', () => {
        expect(JSON.parse(wire.text)).toEqual({ salutation: 'aloha, kai' });
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the ERROR half of the wish's acceptance, proven over real http — a BadRequestError
   *         reaches the wire as a 400 carrying `errorMessage` / `errorType` / `causeMessage`,
   *         and any other error as a 500 that leaks no internal detail
   */
  given('[case5] a handler that throws a BadRequestError with a cause', () => {
    // the metadata carries one caller-safe field and one secret-shaped one, so the assertions
    // below can state which of them reaches the wire rather than assume it
    const handler = forApiGateway({
      schema: { input: z.any(), output: z.any() },
      invoke: async () => {
        throw new BadRequestError('from is not a valid e164', {
          cause: new Error('e164 wants a plus prefix'),
          metadata: {
            fieldAtFault: 'from',
            apiKeyUsed: 'sk-should-not-be-in-metadata-0xc0ffee',
          },
        });
      },
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler }),
    );
    afterAll(async () => harness.close());

    when('[t0] a real http request reaches it', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({ url: `${harness.url}/voice` }),
      );

      then('the wire status is 400', () => {
        expect(wire.status).toBe(400);
      });

      then('the wire body carries errorMessage and errorType', () => {
        const body = JSON.parse(wire.text);
        expect(body.errorMessage).toContain('e164');
        expect(body.errorType).toBe('BadRequestError');
      });

      then('the wire body carries causeMessage when a cause is present', () => {
        expect(JSON.parse(wire.text).causeMessage).toContain('plus prefix');
      });

      then('the wire carries a body, so it keeps its content-type', () => {
        // the coherence step must NOT strip here — these bytes are real
        expect(wire.headers['content-type']).toContain('application/json');
      });

      /**
       * ⚠️ .what = `error.metadata` on a BadRequestError is CALLER-FACING, through TWO channels:
       *            `details` (the whole HelpfulError options bag, so metadata nests at
       *            `details.metadata.*`) AND `errorMessage`, which HelpfulError serializes the
       *            same values into. so a consumer who hardens this by a strip of `details`
       *            still publishes every value — one filter is not enough, and the obvious
       *            filter is the wrong one
       *
       *            put diagnostics in metadata; put secrets in `context.log`. `[case6]` proves
       *            the 500 path does not leak, so this is the 400 path alone
       *
       *            left as-is: a filter would change an error contract every consumer reads,
       *            which no acceptance line asks for
       */
      then('⚠️ metadata reaches the wire — via BOTH details and errorMessage', () => {
        const body = JSON.parse(wire.text);
        const secret = 'sk-should-not-be-in-metadata-0xc0ffee';

        // channel 1 — `details` is the whole options bag, so metadata nests inside it
        expect(body.details.metadata.fieldAtFault).toBe('from');
        expect(body.details.metadata.apiKeyUsed).toBe(secret);

        // ⚠️ channel 2 — and the message carries the same values, independently
        expect(body.errorMessage).toContain(secret);
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  given('[case6] a handler that throws an unexpected error', () => {
    const secret = 'sk-do-not-leak-me-0xdeadbeef';

    const handler = forApiGateway({
      schema: { input: z.any(), output: z.any() },
      invoke: async () => {
        throw new TypeError(`dao blew up while it read ${secret}`);
      },
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler }),
    );
    afterAll(async () => harness.close());

    when('[t0] a real http request reaches it', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({ url: `${harness.url}/voice` }),
      );

      then('the wire status is 500', () => {
        expect(wire.status).toBe(500);
      });

      then('the wire leaks NO internal detail — not the message, not the secret', () => {
        // every byte a client can read, body AND headers, keys included — a leak hides in a
        // key as easily as in a value, and a body-only check covers one channel of two
        // (rule.require.snapshots-deny-volatile-not-allow-expected)
        const surface = [
          wire.text,
          ...Object.entries(wire.headers).map(([key, value]) => `${key}: ${value}`),
        ].join('\n');

        expect(surface).not.toContain(secret);
        expect(surface).not.toContain('dao blew up');
        expect(surface).not.toContain('TypeError');
      });

      // the positive control: a `not.toContain` passes just as happily against an empty
      // string (rule.require.positive-control-before-absence-claims)
      then('the leak surface really holds both channels', () => {
        expect(wire.text.length).toBeGreaterThan(0);
        expect(Object.keys(wire.headers).length).toBeGreaterThan(0);
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  // the sanctioned opt-out of output validation — `schema.output` documents `z.any()` as the
  // way to stand it down (rule.require.explicit-optout)
  given('[case7] a handler that opts out of output validation via z.any()', () => {
    const handler = forApiGateway({
      schema: { input: z.any(), output: z.any() },

      // a shape NO envelope schema would admit — proof that validation truly stood down
      invoke: async () => ({ status: 204, headers: { 'X-Opted-Out': 'yes' } }),
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler }),
    );
    afterAll(async () => harness.close());

    when('[t0] a real http request reaches it', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({ url: `${harness.url}/opted-out` }),
      );

      then('the response passes unvalidated to the wire', () => {
        expect(wire.status).toBe(204);
        expect(wire.headers['x-opted-out']).toBe('yes');
      });

      then('the body-less rule still applies under the opt-out', () => {
        expect(wire.text).toBe('');
        expect(wire.headers['content-type']).toBeUndefined();
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  /**
   * ⚠️ .what = MEASURES A LIMIT, NOT A GUARANTEE — neither the cors headers nor the owasp
   *         security headers reach an error response. `[t1]` asserts their ABSENCE, so it goes
   *         red the day the order is fixed (rule.require.clamp-edge-cases)
   *
   * .the cause = `@middy/http-cors` and `@middy/http-security-headers` each open their
   *         `onError` with `if (request.response === undefined) return;`
   *         (`http-cors/index.js:54-57`, `http-security-headers/index.js:250-253`), and middy
   *         `unshift`s `onError` hooks — so both run BEFORE the error builders that set
   *         `request.response`. `main` carries the same relative order, so this predates the
   *         branch. left as-is: the reorder also moves them on the `after` hook, which no
   *         `.acceptance` line asks for. see `genLambdaEndpoint.forApiGateway.ts`
   *
   * .note = `[t0]` is the POSITIVE CONTROL — one handler serves both requests, so a green `[t0]`
   *         proves both middlewares are wired and configured, which is what makes `[t1]`'s
   *         absence a limit rather than a misconfiguration
   */
  given('[case8] a cors-configured handler, on BOTH its paths', () => {
    const handler = forApiGateway({
      schema: { input: z.any(), output: z.any() },

      // the WILDCARD form — documented by `CorsConfig`, and untested until this case
      cors: { origins: '*', credentials: false },
      invoke: async ({ event }) => {
        if ((event as { fail?: boolean } | null)?.fail)
          throw new BadRequestError('surfer is not a valid e164');

        return { body: { salutation: 'aloha' } };
      },
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler }),
    );
    afterAll(async () => harness.close());

    when('[t0] the request succeeds — the positive control', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({
          url: `${harness.url}/salute`,
          headers: {
            Origin: 'https://ehmpath.com',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fail: false }),
        }),
      );

      then('both middlewares ARE wired — each header reaches the wire', () => {
        expect(wire.status).toBe(200);
        expect(wire.headers['access-control-allow-origin']).toBe('*');
        expect(wire.headers['x-content-type-options']).toBe('nosniff');
        expect(wire.headers['strict-transport-security']).toBeDefined();
      });

      /**
       * ⚠️ .why the snapshot matters MOST here = the three assertions above are an ALLOWLIST of
       *         three header names, on the one case that establishes what a correctly wired
       *         response looks like — so the baseline `[t1]` is measured against is otherwise
       *         only partially visible (rule.require.snapshots-deny-volatile-not-allow-expected)
       *
       * .why = this is the ONLY wire case that drives the WILDCARD `origins: '*'`. that form
       *        once 500'd every success response, invisibly, because the one extant cors test
       *        used the array form. it also covers `credentials: false`, which no assertion
       *        above checks
       */
      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });

    when('[t1] the SAME handler throws', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({
          url: `${harness.url}/salute`,
          headers: {
            Origin: 'https://ehmpath.com',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fail: true }),
        }),
      );

      then('the error contract itself holds — 400 with the error body', () => {
        expect(wire.status).toBe(400);
        expect(JSON.parse(wire.text).errorType).toBe('BadRequestError');
      });

      then('⚠️ DEFECT: no cors header reaches the error response', () => {
        // a browser caller therefore cannot read this error body cross-origin
        expect(wire.headers['access-control-allow-origin']).toBeUndefined();
      });

      then('⚠️ DEFECT: no owasp security header reaches the error response', () => {
        expect(wire.headers['x-content-type-options']).toBeUndefined();
        expect(wire.headers['strict-transport-security']).toBeUndefined();
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = proves the aws-NATIVE `{ statusCode, body }` shape is refused at the WIRE grain —
   *         the most probable way a consumer breaks on upgrade
   *
   * .why = `status` is the one field whose name changed. unguarded, the legacy shape satisfies
   *        the cardinality check via `'body' in input`, loses its 404 to `status ?? 200`, and —
   *        with no `Content-Type` set — has its already-stringified body encoded a SECOND time.
   *        measured with the guard reverted:
   *
   *          status 200                                        <- the 404 was discarded
   *          body   "{\"errorMessage\":\"surfer not found\"}"  <- json inside json
   *
   *        the wire told the caller SUCCESS and handed them a double-encoded string
   *        (rule.forbid.failhide). a 500 is the correct answer, never a 400: the handler author
   *        is at fault, not the http caller (invariant.badrequesterror-not-lambda-error)
   *
   * ⚠️ .measured = THE TYPE DOES NOT CATCH THIS. `PickAny` refuses a response with no valid key
   *             (`{ statusCode }` alone, `{}` — each TS2322), but once ANY valid key is present
   *             the excess keys go unchecked, so `{ statusCode: 404, body: 'x' }` compiles clean:
   *             `body` satisfies a union member, and object-literal freshness is lost through the
   *             inferred `Promise<…>` return. the runtime assure is the ONLY guard here, for
   *             typed and untyped callers alike (rule.require.measure-the-value-you-emit)
   */
  given('[case9] a handler that returns the aws-native wire shape', () => {
    const handler = forApiGateway({
      schema: { input: z.any(), output: z.any() },

      // .as = the pre-upgrade habit. ⚠️ the cast is cosmetic — see `.measured` above
      invoke: async () =>
        ({
          statusCode: 404,
          body: JSON.stringify({ errorMessage: 'surfer not found' }),
        }) as unknown as { status: number },
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler }),
    );
    afterAll(async () => harness.close());

    when('[t0] a real http request reaches it', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({ url: `${harness.url}/legacy` }),
      );

      then('the wire carries a 500 — never the false 200 of the defect', () => {
        expect(wire.status).toBe(500);
        expect(wire.status).not.toBe(200);
      });

      then('the caller never receives the double-encoded body', () => {
        expect(wire.text).not.toContain('surfer not found');
      });

      then('the wire carries the generic 500 body, with no leak', () => {
        const body = JSON.parse(wire.text);
        expect(body.errorType).toBe('InternalServiceError');
        expect(body.errorMessage).toBe('internal server error');
        // the fix that the author needs travels in the LOG, never on the wire
        expect(wire.text).not.toContain('statusCode');
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = an EXPLICIT empty-string body, with no content-type
   * .why = `body` omitted and `body: ''` are two DIFFERENT values. the sdk's default omits the
   *        key (`asApiGatewayResponsePayload` reads `'body' in input.response`), and
   *        `genContentTypeCoherenceMiddleware` strips a stale content-type only when
   *        `body === undefined` — so an explicit `''` takes neither path and reaches the
   *        serializer intact (rule.require.measure-the-value-you-emit)
   */
  given('[case10] a handler that returns an EXPLICIT empty-string body', () => {
    const handler = forApiGateway({
      schema: { input: z.any(), output: z.any() },
      invoke: async () => ({ status: 200, body: '' }),
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler }),
    );
    afterAll(async () => harness.close());

    when('[t0] a real http request reaches it', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({ url: `${harness.url}/empty` }),
      );

      then('the wire status is the 200 the handler asked for', () => {
        expect(wire.status).toBe(200);
      });

      // an empty string is a legitimate json value, so `'""'` under `application/json` is
      // COHERENT — a surprise for a caller who meant "no body", so the bytes are pinned
      then('an explicit empty string is json-encoded, and coherently so', () => {
        expect(wire.headers['content-type']).toContain('application/json');
        expect(wire.text).toBe('""');
      });

      // the DIFFERENCE is the find: `[case1]` holds the other half — omitted -> zero bytes
      then('this differs from an OMITTED body, which carries zero bytes', () => {
        expect(wire.text).not.toBe('');
        expect(wire.text.length).toBeGreaterThan(0);
      });

      /**
       * ⚠️ .note = the snapshot's `text` prints as `""""` — four double-quotes — and that is
       *         FAITHFUL. jest wraps a string in its own quote pair without escaping what sits
       *         inside, so a two-character body `""` renders as `"` + `""` + `"`. peer cases
       *         print `"text": ""`, a genuinely EMPTY body. the same distinction is asserted
       *         in plain text above, so no reader depends on the render
       */
      then('the whole wire response is what a reviewer expects — 2-byte body', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the bytes a cors PREFLIGHT (`OPTIONS`) gets from a cors-configured handler
   * .why = `@middy/http-cors` defaults `disableBeforePreflightResponse: true` (`index.js:16`),
   *        so a preflight is answered by the HANDLER rather than short-circuited — see limit 1
   *        on `CorsConfig`. a vendor default is a claim about what the vendor would do, so these
   *        are the emitted bytes instead (rule.require.measure-the-value-you-emit)
   *
   * .note = `schema.input` is STRICT on purpose. a preflight carries no body, so a strict schema
   *         is what makes the two meet; a `z.any()` schema accepts the preflight and would mask
   *         the interaction the case exists to measure
   *
   * ⚠️ .bound = this measures the LOCAL harness, where every request reaches the handler. a
   *         deployed rest api commonly answers `OPTIONS` at the gateway with a MOCK integration,
   *         so a preflight may never reach the lambda — unverified, and the likeliest reason no
   *         consumer has reported this
   */
  given('[case11] a cors PREFLIGHT against a strict-schema handler', () => {
    let invoked = false;

    const handler = forApiGateway({
      schema: {
        // STRICT on purpose — a preflight body-less request must meet a real contract
        input: z.object({ surfer: z.string() }),
        output: z.any(),
      },
      cors: { origins: '*', credentials: false },
      invoke: async () => {
        invoked = true;
        return { body: { salutation: 'aloha' } };
      },
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler }),
    );
    afterAll(async () => harness.close());

    when('[t0] a browser sends the preflight', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({
          url: `${harness.url}/salute`,
          method: 'OPTIONS',
          headers: {
            Origin: 'https://ehmpath.com',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type',
          },
        }),
      );

      // the vendor's `before` short-circuit is off, so the preflight falls through the whole
      // chain — the body validation among it, which no OPTIONS exemption guards
      then('⚠️ LIMIT: the preflight is NOT answered with a 204', () => {
        expect(wire.status).not.toBe(204);
        expect(wire.status).toBe(400);
      });

      // a browser accepts a preflight ONLY on a 2xx carrying `Access-Control-Allow-Origin`.
      // this has neither — the second absence is `[case8]`'s dead `onError`, so the two
      // limits COMPOUND: the preflight fails, in the one way a browser cannot report
      then('⚠️ LIMIT: and it carries no cors header either', () => {
        expect(wire.headers['access-control-allow-origin']).toBeUndefined();
      });

      // right outcome, wrong cause: the schema refuses it, rather than cors that answers first
      then('the handler is never invoked', () => {
        expect(invoked).toBe(false);
      });

      /**
       * ⚠️ .what = LIVE, NOT FIXED — the same error body names its own class TWO ways:
       *
       *          errorMessage : "✋ ConstraintError: validation failed: …"
       *          errorType    : "BadRequestError"
       *
       *        and no field says which governs (rule.forbid.ambiguous-labels)
       *
       * .the cause = only the VALIDATION path disagrees. that error is raised as a
       *        ConstraintError and re-labelled `BadRequestError` for ancient callers
       *        (invariant.ancient-vs-contemp-callers), while a handler-thrown error agrees with
       *        itself — `[case5]` and `[case8][t1]` both carry `BadRequestError` in both fields.
       *        so a caller cannot learn the rule from experience. the `✋` and the duplicated
       *        `details` are the same cause: HelpfulError renders prefix, emoji, and an issues
       *        blob into `.message`, which the middleware copies verbatim
       *
       * .left as-is = to change `errorMessage` changes an extant error contract every consumer
       *        reads, which no acceptance line asks for. clamped so the fact is asserted rather
       *        than incidental to a snapshot (rule.require.clamp-edge-cases)
       */
      then('⚠️ LIMIT: errorMessage and errorType name different classes', () => {
        const body = JSON.parse(wire.text);

        // the wire contract a caller parses
        expect(body.errorType).toBe('BadRequestError');

        // ...and the human-readable field, which disagrees with it
        expect(body.errorMessage).toContain('ConstraintError');
        expect(body.errorMessage).not.toContain('BadRequestError');

        // the same text also puts an emoji and a duplicate of `details` on the wire
        expect(body.errorMessage).toContain('✋');
        expect(body.errorMessage).toContain('issues');
        expect(body.details.issues).toBeDefined();
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the wish's three named shapes, proven again through an HTTP-API (v2) trigger
   * .why = `ApiGatewayRequestPayload` is `APIGatewayProxyEvent | APIGatewayProxyEventV2`, so a
   *        suite that runs only the v1 arm measures one of the two formats the public type
   *        accepts (rule.require.a-harness-types-as-wide-as-its-contract)
   *
   *        v2 is no cosmetic variant: it moves method and path under `requestContext.http` and
   *        drops `httpMethod`/`path` from the top level, so a normalizer defect there reaches
   *        the handler as an absent method — and twilio and cloudfront are as plausibly wired
   *        behind an http-api as a rest-api
   */
  given('[case12] an HTTP-API (v2) trigger that answers 204 with no body', () => {
    const formBody = 'From=%2B15551234567&CallStatus=completed';

    let eventSeen: unknown = 'never invoked';

    const handler = forApiGateway({
      schema: {
        input: z.any(),
        output: asApiGatewayResponseSchema({ body: z.undefined() }),
      },
      invoke: async ({ event }) => {
        eventSeen = event;
        return { status: 204 };
      },
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler, version: 'v2' }),
    );
    afterAll(async () => harness.close());

    when('[t0] a real form-encoded request reaches it over v2', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({
          url: `${harness.url}/voice`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody,
        }),
      );

      then('the wire status is 204, exactly as on v1', () => {
        expect(wire.status).toBe(204);
      });

      then('the wire body is empty — never the json-quoted `""`', () => {
        expect(wire.text).toBe('');
      });

      then('the wire carries no content-type — no bytes exist to describe', () => {
        // a content-type that contradicts the body is the twilio 11200 shape
        expect(wire.headers['content-type']).toBeUndefined();
      });

      // the v2-specific claim: proves the normalizer READ the v2 arm rather than fell through
      // to a v1 default — one that produced `undefined` would still emit a correct 204
      then('the handler receives the raw form string, unparsed, as on v1', () => {
        expect(eventSeen).toBe(formBody);
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  given('[case13] an HTTP-API (v2) trigger that answers 308 with a Location', () => {
    const destination = 'https://ehmpath.com/surf/pipeline';

    const handler = forApiGateway({
      schema: {
        input: z.any(),
        output: asApiGatewayResponseSchema({ body: z.undefined() }),
      },
      invoke: async () => ({
        status: HttpStatusCode.PERMANENT_REDIRECT_308,
        headers: { Location: destination },
      }),
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler, version: 'v2' }),
    );
    afterAll(async () => harness.close());

    when('[t0] a real http request reaches it over v2', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({ url: `${harness.url}/s/abc123`, method: 'GET' }),
      );

      then('the wire status is 308', () => {
        expect(wire.status).toBe(308);
      });

      then('the wire carries the Location header', () => {
        expect(wire.headers.location).toBe(destination);
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  given('[case14] an HTTP-API (v2) trigger that answers with verbatim xml', () => {
    const twiml = '<Response><Say>cowabunga</Say></Response>';

    const handler = forApiGateway({
      schema: {
        input: z.any(),
        output: asApiGatewayResponseSchema({ body: z.string() }),
      },
      invoke: async () => ({
        headers: { 'Content-Type': 'text/xml' },
        body: twiml,
      }),
    });

    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler, version: 'v2' }),
    );
    afterAll(async () => harness.close());

    when('[t0] a real http request reaches it over v2', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({ url: `${harness.url}/voice` }),
      );

      then('the wire status is 200, the defaulted status', () => {
        expect(wire.status).toBe(200);
      });

      then('the wire carries text/xml, never a re-stamped application/json', () => {
        // a content-type that contradicts the body is exactly what raises twilio 11200
        expect(wire.headers['content-type']).toContain('text/xml');
      });

      then('the wire bytes are byte-identical to what the handler returned', () => {
        expect(wire.text).toBe(twiml);
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = the v2 arm of BOTH error paths — the 400 and the 500
   * .why = the error path runs on `request.response`, which the normalizer has already made
   *        version-independent — a sound argument, and an argument is not a run
   *        (rule.require.measure-the-value-you-emit)
   *
   * .note = it asserts the SAME bytes the v1 cases assert, since the claim under test is that
   *         the two arms converge. a divergence here is the defect
   */
  given('[case15] an HTTP-API (v2) trigger whose handler throws', () => {
    const secret = 'sk-v2-should-not-leak-0xfeedface';

    const handlerConstraint = forApiGateway({
      schema: { input: z.any(), output: z.any() },
      invoke: async () => {
        throw new BadRequestError('surfer is not a valid e164', {
          cause: new Error('e164 wants a plus prefix'),
        });
      },
    });

    const handlerMalfunction = forApiGateway({
      schema: { input: z.any(), output: z.any() },
      invoke: async () => {
        throw new TypeError(`dao blew up while it read ${secret}`);
      },
    });

    const harnessConstraint = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler: handlerConstraint, version: 'v2' }),
    );
    const harnessMalfunction = useBeforeAll(async () =>
      genApiGatewayProxyHarness({ handler: handlerMalfunction, version: 'v2' }),
    );
    afterAll(async () => harnessConstraint.close());
    afterAll(async () => harnessMalfunction.close());

    when('[t0] it throws a BadRequestError over v2', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({ url: `${harnessConstraint.url}/voice` }),
      );

      then('the wire status is 400, exactly as on v1', () => {
        expect(wire.status).toBe(400);
      });

      then('the wire body carries errorType BadRequestError, as on v1', () => {
        const body = JSON.parse(wire.text);
        expect(body.errorMessage).toContain('e164');
        expect(body.errorType).toBe('BadRequestError');
      });

      then('the wire body carries causeMessage, as on v1', () => {
        expect(JSON.parse(wire.text).causeMessage).toContain('plus prefix');
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });

    when('[t1] it throws an unexpected error over v2', () => {
      const wire = useBeforeAll(async () =>
        getOneWireResponse({ url: `${harnessMalfunction.url}/voice` }),
      );

      then('the wire status is 500, exactly as on v1', () => {
        expect(wire.status).toBe(500);
      });

      then('the wire body leaks no internal detail, as on v1', () => {
        expect(wire.text).not.toContain(secret);
        expect(wire.text).not.toContain('dao blew up');
        expect(JSON.parse(wire.text).errorType).toBe('InternalServiceError');
      });

      then('the whole wire response is what a reviewer expects', () => {
        expect(asWireSnapshot({ wire })).toMatchSnapshot();
      });
    });
  });
});
