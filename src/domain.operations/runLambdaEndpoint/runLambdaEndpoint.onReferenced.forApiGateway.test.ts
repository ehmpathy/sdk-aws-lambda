import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { asApiGatewayRequestEventOnwire } from '../../__test_assets__/asApiGatewayRequestEventOnwire';
import { asParsedResponseBody } from '../../__test_assets__/asParsedResponseBody';
import type { ApiGatewayResponseOnwire } from '../../domain.objects/ApiGatewayResponseOnwire';
import { asLambdaEvent } from '../asLambdaEvent/asLambdaEvent';
import { asApiGatewayResponseSchema } from '../genLambdaEndpoint/genLambdaEndpoint.forApiGateway/asApiGatewayResponseSchema';
import { forApiGateway } from '../genLambdaEndpoint/genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway';
import { forAsk } from '../genLambdaEndpoint/genLambdaEndpoint.forAsk/genLambdaEndpoint.forAsk';
import { asLambdaContext } from './context/asLambdaContext';
import { onReferenced } from './runLambdaEndpoint.onReferenced';

type Seen = { exid: string | null; headers: Record<string, string> };

/**
 * .what = an api gateway endpoint that echoes a recipient, and throws for one address
 * .why = the minimum shape that exercises success, a caller fault, and a server fault; each run
 *        records what `invoke` saw
 */
const genNotifyEndpoint = (input: { seen: Seen[] }) =>
  forApiGateway({
    schema: {
      input: z.object({ payload: z.object({ to: z.string().email() }) }),
      output: asApiGatewayResponseSchema({
        payload: z.object({ sentTo: z.string() }),
      }),
    },
    invoke: async ({ payload, event }, { log }) => {
      input.seen.push({
        exid: log.trail?.exid ?? null,
        headers: { ...event.headers } as Record<string, string>,
      });
      if (payload.to === 'fatal@example.com')
        throw new Error('dependency dead');
      return { payload: { sentTo: payload.to } };
    },
  });

const asOnwire = (response: unknown) => response as ApiGatewayResponseOnwire;

describe('runLambdaEndpoint.onReferenced × forApiGateway', () => {
  given('[case1] an api gateway endpoint and no struct', () => {
    const seen: Seen[] = [];
    const handler = genNotifyEndpoint({ seen });

    when('[t0] a fromApiGateway event is run, in the default dialect', () => {
      const response = useThen('it resolves', async () =>
        onReferenced({
          handler,
          event: asLambdaEvent.fromApiGateway({
            httpMethod: 'POST',
            path: '/notifications',
            body: { to: 'kai@example.com' },
          }),
        }),
      );

      // 🔴 the clamp: on 0.7.1 the contemp frame reached event normalization, which threw,
      //    and the endpoint answered a redacted 500 before `invoke` was reached
      then('the handler answers its own 200', () => {
        expect(asOnwire(response).statusCode).toEqual(200);
        expect(asParsedResponseBody({ response: asOnwire(response) })).toEqual({
          sentTo: 'kai@example.com',
        });
      });

      then('invoke ran once', () => {
        expect(seen).toHaveLength(1);
      });

      then(
        'the handler saw the opt-in as a header, and a minted exid in its trail',
        () => {
          expect(seen[0]!.headers['x-trail-exid']).toMatch(/^exid:/);
          expect(seen[0]!.exid).toEqual(seen[0]!.headers['x-trail-exid']);
        },
      );
    });
  });

  given('[case2] a caller exid on the trail', () => {
    const seen: Seen[] = [];
    const handler = genNotifyEndpoint({ seen });

    when('[t0] a valid event is run', () => {
      useThen('it resolves', async () =>
        onReferenced({
          handler,
          trail: { exid: 'exid:kai-1' },
          event: asLambdaEvent.fromApiGateway({
            httpMethod: 'POST',
            body: { to: 'kai@example.com' },
          }),
        }),
      );

      then('the endpoint trail carries the caller exid', () => {
        expect(seen[0]!.exid).toEqual('exid:kai-1');
      });
    });

    when('[t1] the handler throws', () => {
      const response = useThen('it resolves, a 500 is returned', async () =>
        onReferenced({
          handler,
          trail: { exid: 'exid:kai-1' },
          event: asLambdaEvent.fromApiGateway({
            httpMethod: 'POST',
            body: { to: 'fatal@example.com' },
          }),
        }),
      );

      then(
        'the body is redacted and its correlationId is the caller exid',
        () => {
          expect(asOnwire(response).statusCode).toEqual(500);
          expect(
            asParsedResponseBody({ response: asOnwire(response) }),
          ).toEqual({
            errorMessage: 'internal server error',
            errorType: 'InternalServiceError',
            correlationId: 'exid:kai-1',
          });
        },
      );
    });
  });

  given('[case3] a body the schema refuses', () => {
    const seen: Seen[] = [];
    const handler = genNotifyEndpoint({ seen });
    const event = () =>
      asLambdaEvent.fromApiGateway({
        httpMethod: 'POST',
        body: { to: 'not-an-email' },
      });

    when('[t0] run with no struct — the opt-in header is sent', () => {
      const response = useThen('it resolves', async () =>
        onReferenced({ handler, event: event() }),
      );

      then('invoke never ran', () => {
        expect(seen).toHaveLength(0);
      });

      then('the 400 body speaks the contemp dialect', () => {
        expect(asOnwire(response).statusCode).toEqual(400);
        const body = asParsedResponseBody({ response: asOnwire(response) });
        expect(body.error.class).toEqual('ConstraintError');
        expect(body.error.message).toContain('payload.to');
        expect(body).not.toHaveProperty('errorType');
      });
    });

    when('[t1] run with struct ancient — no header is sent', () => {
      const response = useThen('it resolves', async () =>
        onReferenced({
          handler,
          event: event(),
          struct: { payload: 'ancient' },
        }),
      );

      then('the 400 body is the flat ancient dialect', () => {
        expect(asOnwire(response).statusCode).toEqual(400);
        const body = asParsedResponseBody({ response: asOnwire(response) });
        expect(body.errorType).toEqual('BadRequestError');
        expect(body.errorMessage).toContain('payload.to');
        expect(body).not.toHaveProperty('error');
      });
    });
  });

  given('[case4] struct ancient on a valid event', () => {
    const seen: Seen[] = [];
    const handler = genNotifyEndpoint({ seen });

    when('[t0] run', () => {
      const response = useThen('it resolves', async () =>
        onReferenced({
          handler,
          struct: { payload: 'ancient' },
          event: asLambdaEvent.fromApiGateway({
            httpMethod: 'POST',
            body: { to: 'kai@example.com' },
          }),
        }),
      );

      then('the handler answers 200', () => {
        expect(asOnwire(response).statusCode).toEqual(200);
      });

      then(
        'the event arrives raw: no x-trail-exid, and a fresh trail exid',
        () => {
          expect(seen[0]!.headers).not.toHaveProperty('x-trail-exid');
          expect(seen[0]!.exid).toMatch(/^exid:/);
        },
      );
    });
  });

  given('[case6] a real request that carries aws and w3c trace headers', () => {
    const seen: Seen[] = [];
    const handler = genNotifyEndpoint({ seen });

    when(
      '[t0] a refused body arrives with no x-trail-exid, as from a browser',
      () => {
        const response = useThen('it resolves', async () =>
          onReferenced({
            handler,
            // ancient sends the raw event, exactly as aws delivers it: no opt-in header
            struct: { payload: 'ancient' },
            event: asLambdaEvent.fromApiGateway({
              httpMethod: 'POST',
              body: { to: 'not-an-email' },
              headers: {
                'x-amzn-trace-id': 'Root=1-67891233-abcdef012345678912345678',
                traceparent:
                  '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
                'x-request-id': 'req-1',
                'x-correlation-id': 'corr-1',
              },
            }),
          }),
        );

        // no generic correlation header ever opts a caller in, so a proxy that forwards one cannot
        // flip an error body
        then('the 400 stays flat: prod does not move', () => {
          expect(asOnwire(response).statusCode).toEqual(400);
          const body = asParsedResponseBody({ response: asOnwire(response) });
          expect(body.errorType).toEqual('BadRequestError');
          expect(body).not.toHaveProperty('error');
        });
      },
    );
  });

  given(
    '[case7] both payload versions aws delivers, with the opt-in header',
    () => {
      // `fromApiGateway` builds v1 only, and aws builds v2. so the v2 arm is driven through the
      // endpoint with a wire event, exactly as aws would hand it over, with the header a caller
      // of the sdk's runner or caller would have sent
      const seen: Seen[] = [];
      const handler = genNotifyEndpoint({ seen });
      const asWire = (version: 'v1' | 'v2') =>
        asApiGatewayRequestEventOnwire({
          version,
          method: 'POST',
          url: '/notifications',
          headers: {
            'content-type': 'application/json',
            'x-trail-exid': `exid:${version}-caller`,
          },
          body: JSON.stringify({ to: 'not-an-email' }),
        });

      (['v1', 'v2'] as const).map((version, index) =>
        when(`[t${index}] a refused ${version} request is handled`, () => {
          const response = useThen('it resolves', async () =>
            handler(asWire(version), asLambdaContext()),
          );

          then(
            'the 400 is the contemp dialect: the header was read after normalization',
            () => {
              expect(asOnwire(response).statusCode).toEqual(400);
              const body = asParsedResponseBody({
                response: asOnwire(response),
              });
              expect(body.error.class).toEqual('ConstraintError');
            },
          );
        }),
      );
    },
  );

  // the receiver owns the carrier: the endpoint a `genLambdaEndpoint` builder returned declares it, so an
  // event that lost the builder's mark (a spread, a hand-built or captured request) is still framed right
  given('[case5] an api gateway event the builder did not declare', () => {
    const seen: Seen[] = [];
    const handler = genNotifyEndpoint({ seen });

    when(
      '[t0] a spread copy of a declared event is run, in the default dialect',
      () => {
        const response = useThen('it resolves', async () =>
          onReferenced({
            handler,
            event: {
              ...asLambdaEvent.fromApiGateway({
                httpMethod: 'POST',
                body: { to: 'kai@example.com' },
              }),
            },
            trail: { exid: 'exid:from-caller' },
          }),
        );

        then('the handler answers its own 200', () => {
          expect(asOnwire(response).statusCode).toEqual(200);
        });

        then('the caller trail reaches the handler', () => {
          expect(seen.at(-1)?.exid).toEqual('exid:from-caller');
        });
      },
    );

    when('[t1] a hand-built event is run, in the default dialect', () => {
      const response = useThen('it resolves', async () =>
        onReferenced({
          handler,
          event: {
            ...asLambdaEvent.fromApiGateway({
              httpMethod: 'POST',
              body: { to: 'not-an-email' },
            }),
          },
        }),
      );

      then('the 400 is the contemp dialect, as for a built event', () => {
        expect(asOnwire(response).statusCode).toEqual(400);
        const body = asParsedResponseBody({ response: asOnwire(response) });
        expect(body.error.class).toEqual('ConstraintError');
      });
    });
  });

  // the remedies the refusal and the readme name for a changed event
  given('[case8] an event that needs a change the builder can make', () => {
    const seen: Seen[] = [];
    const handler = genNotifyEndpoint({ seen });

    when(
      '[t0] the change is passed to the builder, in the default dialect',
      () => {
        const response = useThen('it resolves', async () =>
          onReferenced({
            handler,
            event: asLambdaEvent.fromApiGateway({
              httpMethod: 'POST',
              body: { to: 'kai@example.com' },
              requestContext: { authorizer: { principalId: 'kai' } },
            }),
            trail: { exid: 'exid:from-caller' },
          }),
        );

        then('the handler answers its own 200, with the caller trail', () => {
          expect(asOnwire(response).statusCode).toEqual(200);
          expect(seen.at(-1)?.exid).toEqual('exid:from-caller');
        });
      },
    );

    // a raw event captured from aws carries its own headers, so it crosses as sent: `ancient` adds no
    // opt-in and removes none, which is how the harness hands real wire requests through
    when(
      '[t1] a raw event that holds the header is run with struct ancient',
      () => {
        useThen('it resolves', async () =>
          onReferenced({
            handler,
            event: {
              ...asLambdaEvent.fromApiGateway({
                httpMethod: 'POST',
                body: { to: 'kai@example.com' },
              }),
              headers: { 'x-trail-exid': 'exid:set-by-hand' },
            },
            struct: { payload: 'ancient' },
          }),
        );

        then('the header reaches the handler as sent', () => {
          expect(seen.at(-1)?.exid).toEqual('exid:set-by-hand');
        });
      },
    );
  });

  // the carrier never comes from an event's contents: a forwarded request that holds the header is
  // a valid payload for a direct invoke, and keeps the wrapper. and an event the api gateway builder
  // declared, run against a direct-invoke endpoint, is framed for the endpoint that receives it
  given(
    '[case10] a declared api gateway event, run against a direct-invoke endpoint',
    () => {
      const handler = forAsk({
        schema: {
          input: z.object({ httpMethod: z.string() }).passthrough(),
          output: z.object({ ok: z.boolean() }),
        },
        invoke: async (_input, { log }) => ({
          ok: log.trail?.exid === 'exid:caller',
        }),
      });

      when('[t0] run in the default dialect, with a caller trail', () => {
        const response = useThen('it resolves', async () =>
          onReferenced({
            handler,
            event: asLambdaEvent.fromApiGateway({ httpMethod: 'POST' }),
            trail: { exid: 'exid:caller' },
          }),
        );

        then('the wrapper reaches the endpoint, with the caller exid', () => {
          expect(response).toEqual({ ok: true });
        });
      });
    },
  );

  given(
    '[case9] a direct-invoke event that holds an x-trail-exid field',
    () => {
      const handler = forAsk({
        schema: {
          input: z.object({
            uuid: z.string(),
            headers: z.object({ 'x-trail-exid': z.string() }),
          }),
          output: z.object({ ok: z.boolean() }),
        },
        invoke: async () => ({ ok: true }),
      });

      when('[t0] run in the default dialect', () => {
        const response = useThen('it resolves', async () =>
          onReferenced({
            handler,
            event: { uuid: 'u1', headers: { 'x-trail-exid': 'exid:fwd' } },
            trail: { exid: 'exid:caller' },
          }),
        );

        then(
          'the contemp dialect holds: the output is returned, framed as sent',
          () => {
            expect(response).toEqual({ ok: true });
          },
        );
      });
    },
  );
});
