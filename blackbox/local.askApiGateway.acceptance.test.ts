/**
 * .what = a peer service asks an api gateway endpoint over real http, opted into the contemp dialect
 * .why = `askLambdaEndpoint.viaApiGateway` sends the caller's trail in the `x-trail-exid` header —
 *        the one carrier aws lets a caller use. these cases prove the header reaches the endpoint,
 *        and that each answer comes back as the throw `askLambdaEndpoint` gives
 *
 * .note = the harness fronts the handler with a real http server that applies aws's documented
 *         proxy map, so the request travels as bytes, as it would to a deployed gateway
 */
import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { genContextLogTrail } from 'sdk-logs';
import { getError, given, then, useBeforeAll, useThen, when } from 'test-fns';
import { omit } from 'type-fns';
import { z } from 'zod';

import {
  asTrailExidHeaders,
  asApiGatewayResponseSchema,
  askLambdaEndpoint,
  genLambdaEndpoint,
  LambdaEndpointRefusedError,
} from '../src/index';
import { genApiGatewayProxyHarness } from '../src/__test_assets__/genApiGatewayProxyHarness';
import { getOneHttpResponse } from '../src/__test_assets__/getOneHttpResponse';
import { asLogLineMasked } from './__test_assets__/asLogLineMasked';

type Seen = { exid: string | null };

const genContext = (input: { exid: string }) =>
  genContextLogTrail({ trail: { exid: input.exid, stack: [] }, env: null });

/**
 * .what = casts a thrown error into the shape a reviewer reads in a snapshot
 * .why = the url holds the harness's random port, in the message and in the metadata alike, so the
 *        port is masked; every other field is the contract
 */
const asPortMasked = (text: string): string =>
  text
    .replace(/127\.0\.0\.1:\d+/g, '127.0.0.1:[port]')
    // the `date` response header changes on every run and rides the error's headers
    .replace(/("date":\s*")[^"]*"/g, '$1[date]"')
    // the same header, escaped inside a json body
    .replace(/\\"date\\":\s*\\"[^"\\]*\\"/g, '\\"date\\": \\"[date]\\"');
const asErrorSnapshot = (error: Error): Record<string, unknown> => ({
  class: error.constructor.name,
  message: asPortMasked(error.message),
  metadata: JSON.parse(
    asPortMasked(
      JSON.stringify((error as { metadata?: unknown }).metadata ?? null),
    ),
  ),
});

describe('askLambdaEndpoint.viaApiGateway', () => {
  given('[case1] an api gateway endpoint behind a local http harness', () => {
    const seen: Seen[] = [];
    const harness = useBeforeAll(async () =>
      genApiGatewayProxyHarness({
        handler: genLambdaEndpoint.forApiGateway({
          schema: {
            input: z.object({ payload: z.object({ to: z.string().email() }) }),
            output: asApiGatewayResponseSchema({
              payload: z.object({ sentTo: z.string() }),
            }),
          },
          invoke: async ({ payload }, { log }) => {
            seen.push({ exid: log.trail?.exid ?? null });
            if (payload.to === 'fatal@example.com')
              throw new Error('dependency dead');
            return { payload: { sentTo: payload.to } };
          },
        }),
      }),
    );
    afterAll(async () => harness.close());

    when('[t0] a valid body is asked, with a trail exid', () => {
      const response = useThen('it resolves', async () =>
        askLambdaEndpoint.viaApiGateway<{ sentTo: string }>(
          {
            url: `${harness.url}/notifications`,
            method: 'POST',
            body: { to: 'kai@example.com' },
          },
          genContext({ exid: 'exid:ord-7' }),
        ),
      );

      then('the response is a 200 with the handler payload', () => {
        expect(response.status).toEqual(200);
        expect(response.body).toEqual({ sentTo: 'kai@example.com' });
        expect(JSON.parse(response.text)).toEqual(response.body);
        expect(response.headers['content-type']).toContain('application/json');
      });

      then('the endpoint trail carries the caller exid, so the logs join up', () => {
        expect(seen.at(-1)).toEqual({ exid: 'exid:ord-7' });
      });

      // the whole contract a reviewer reads. the volatile headers are denied by name, and every
      // other key the answer holds is pinned, so a header nobody named still shows in the diff
      then('the answer matches snapshot', () => {
        expect({
          ...response,
          headers: omit(response.headers, [
            'date',
            'connection',
            'keep-alive',
            'content-length',
          ]),
        }).toMatchSnapshot();
      });
    });

    when('[t1] a body the schema refuses is asked', () => {
      // the asker composed the body, so by default the refusal is its own malfunction (sdk-aws-lambda#77)
      then(
        'it throws a LambdaEndpointRefusedError that names the field and the opt-in',
        async () => {
          const error = await getError(
            askLambdaEndpoint.viaApiGateway(
              {
                url: `${harness.url}/notifications`,
                method: 'POST',
                body: { to: 'not-an-email' },
              },
              genContext({ exid: 'exid:ord-7' }),
            ),
          );
          expect(error).toBeInstanceOf(LambdaEndpointRefusedError);
          expect(error).toBeInstanceOf(MalfunctionError);
          expect(error).not.toBeInstanceOf(ConstraintError);
          expect(error.message).toContain('payload.to');
          expect(error.message).toContain("refusal: { as: 'ConstraintError' }");
          expect(asErrorSnapshot(error)).toMatchSnapshot();
        },
      );

      then(
        'under the pass-through opt, it throws a ConstraintError that names the field to fix',
        async () => {
          const error = await getError(
            askLambdaEndpoint.viaApiGateway(
              {
                url: `${harness.url}/notifications`,
                method: 'POST',
                body: { to: 'not-an-email' },
                refusal: { as: 'ConstraintError' },
              },
              genContext({ exid: 'exid:ord-7' }),
            ),
          );
          expect(error).toBeInstanceOf(ConstraintError);
          expect(error).not.toBeInstanceOf(LambdaEndpointRefusedError);
          expect(error.message).toContain('payload.to');
          expect(asErrorSnapshot(error)).toMatchSnapshot();
        },
      );
    });

    when('[t2] the handler throws', () => {
      then('it throws a MalfunctionError that carries the correlationId', async () => {
        const error = await getError(
          askLambdaEndpoint.viaApiGateway(
            {
              url: `${harness.url}/notifications`,
              method: 'POST',
              body: { to: 'fatal@example.com' },
            },
            genContext({ exid: 'exid:ord-7' }),
          ),
        );
        expect(error).toBeInstanceOf(MalfunctionError);
        expect(error instanceof MalfunctionError ? error.metadata : null).toMatchObject({
          status: 500,
          correlationId: 'exid:ord-7',
        });
        expect(asErrorSnapshot(error)).toMatchSnapshot();
      });
    });

    when('[t3] a caller header tries to override the opt-in', () => {
      then('the trail header wins', async () => {
        await askLambdaEndpoint.viaApiGateway(
          {
            url: `${harness.url}/notifications`,
            method: 'POST',
            headers: { 'x-trail-exid': 'exid:imposter' },
            body: { to: 'kai@example.com' },
          },
          genContext({ exid: 'exid:ord-7' }),
        );
        expect(seen.at(-1)).toEqual({ exid: 'exid:ord-7' });
      });
    });

    when('[t3b] a caller header of the same name in another case', () => {
      then('the trail header still wins, and the exid is the only one', async () => {
        await askLambdaEndpoint.viaApiGateway(
          {
            url: `${harness.url}/notifications`,
            method: 'POST',
            headers: { 'X-Trail-Exid': 'exid:imposter' },
            body: { to: 'kai@example.com' },
          },
          genContext({ exid: 'exid:ord-7' }),
        );
        expect(seen.at(-1)).toEqual({ exid: 'exid:ord-7' });
      });
    });

    when('[t3c] a body is given and no method', () => {
      then('the request is a POST, so the endpoint answers its payload', async () => {
        const response = await askLambdaEndpoint.viaApiGateway<{
          sentTo: string;
        }>(
          {
            url: `${harness.url}/notifications`,
            body: { to: 'kai@example.com' },
          },
          genContext({ exid: 'exid:ord-7' }),
        );
        expect(response.body).toEqual({ sentTo: 'kai@example.com' });
      });
    });

    when('[t4] another http client spreads asTrailExidHeaders into its request', () => {
      const answered = useThen('it resolves', async () =>
        getOneHttpResponse({
          url: `${harness.url}/notifications`,
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...asTrailExidHeaders({ trail: { exid: 'exid:from-fetch' } }),
          },
          body: JSON.stringify({ to: 'not-an-email' }),
        }),
      );

      then('the opt-in is the header, not the client: the 400 is the nested envelope', () => {
        expect(answered.status).toEqual(400);
        const body = JSON.parse(answered.text);
        expect(body.error.class).toEqual('ConstraintError');
      });
    });

    when('[t5] a client sends no opt-in, as a browser does', () => {
      const answered = useThen('it resolves', async () =>
        getOneHttpResponse({
          url: `${harness.url}/notifications`,
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ to: 'not-an-email' }),
        }),
      );

      then('the 400 is the flat ancient body: prod does not move', () => {
        expect(answered.status).toEqual(400);
        const body = JSON.parse(answered.text);
        expect(body.errorType).toEqual('BadRequestError');
        expect(body).not.toHaveProperty('error');
      });
    });
  });

  /**
   * .what = the wish's critical path, joined end to end over real http: an http caller → a consumer
   *         endpoint → a peer endpoint that refuses the request the consumer composed
   * .why = each half is clamped alone elsewhere; this proves the ask road's thrown class reaches the
   *        consumer's chain and becomes the answer its caller gets (sdk-aws-lambda#77)
   */
  given('[case3] a consumer endpoint whose peer refuses the request it composed', () => {
    const peer = useBeforeAll(async () =>
      genApiGatewayProxyHarness({
        handler: genLambdaEndpoint.forApiGateway({
          schema: {
            input: z.object({ payload: z.object({ to: z.string().email() }) }),
            output: asApiGatewayResponseSchema({
              payload: z.object({ sentTo: z.string() }),
            }),
          },
          invoke: async ({ payload }) => ({ payload: { sentTo: payload.to } }),
        }),
      }),
    );
    afterAll(async () => peer.close());

    /**
     * .what = a consumer that composes a bad request to the peer, under the opt it is given
     * .why = the consumer's own caller sent a valid body; the consumer built the bad one
     */
    const genConsumer = (input: { refusal: { as: 'ConstraintError' | 'LambdaEndpointRefusedError' } }) =>
      genApiGatewayProxyHarness({
        handler: genLambdaEndpoint.forApiGateway({
          schema: {
            input: z.object({ payload: z.object({ user: z.string() }) }),
            output: asApiGatewayResponseSchema({
              payload: z.object({ sentTo: z.string() }),
            }),
          },
          invoke: async (_, { log }) => {
            const answered = await askLambdaEndpoint.viaApiGateway<{ sentTo: string }>(
              {
                url: `${peer.url}/notifications`,
                method: 'POST',
                body: { to: 'not-an-email' },
                refusal: input.refusal,
              },
              { log },
            );
            return { payload: { sentTo: answered.body?.sentTo ?? '' } };
          },
        }),
      });

    /**
     * .what = an http caller asks the consumer, with the consumer's `handler.output` line kept
     * .why = on-call filters by that line's level; the spy only observes, and calls through
     */
    const askConsumer = async (input: { url: string }) => {
      const spy = jest.spyOn(console, 'warn');
      try {
        const response = await getOneHttpResponse({
          url: `${input.url}/notify`,
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...asTrailExidHeaders({ trail: { exid: 'exid:browser-1' } }),
          },
          body: JSON.stringify({ user: 'kai' }),
        });
        // the peer runs in this process too: its line comes first, the consumer's last.
        // each line is kept whole, save its volatile fields, so the snapshot sees every key
        const asLinesOf = (inputLines: {
          message: string;
        }): Record<string, unknown>[] =>
          spy.mock.calls
            .map((args) => args[0])
            .filter(
              (line): line is Record<string, unknown> =>
                typeof line === 'object' &&
                line !== null &&
                (line as { message?: unknown }).message === inputLines.message,
            )
            .map((line) => asLogLineMasked({ line }));
        return {
          status: response.status,
          text: asPortMasked(response.text),
          outputs: asLinesOf({ message: 'handler.output' }),
          errors: asLinesOf({ message: 'handler.error' }),
        };
      } finally {
        spy.mockRestore();
      }
    };

    when('[t0] the consumer takes the default opt', () => {
      const consumer = useBeforeAll(async () =>
        genConsumer({ refusal: { as: 'LambdaEndpointRefusedError' } }),
      );
      afterAll(async () => consumer.close());

      const answered = useThen('the http caller gets an answer', async () =>
        askConsumer({ url: consumer.url }),
      );

      then('the http caller gets a 500, never a 400 it cannot fix', () => {
        expect(answered.status).toEqual(500);
      });

      then('the body holds no peer message, only a correlation id', () => {
        expect(answered.text).not.toContain('payload.to');
        expect(answered.text).toContain('correlationId');
      });

      then('the consumer logs handler.output at error, with the peer, its reason, and the opt-in', () => {
        // the consumer's own line is the last; the peer's comes first
        const [, outputOfConsumer] = answered.outputs;
        const errorMessage = String(
          (outputOfConsumer?.metadata as { errorMessage?: unknown } | undefined)
            ?.errorMessage,
        );
        expect(answered.outputs.map((line) => line.level)).toEqual([
          'warn',
          'error',
        ]);
        expect(errorMessage).toContain('refused the request');
        expect(errorMessage).toContain('payload.to');
        expect(errorMessage).toContain("refusal: { as: 'ConstraintError' }");
      });

      then('the consumer logs one handler.error at error, since the refusal is its own fault', () => {
        expect(answered.errors.map((line) => line.level)).toEqual(['error']);
        const errorMessage = String(
          (answered.errors[0]?.metadata as { errorMessage?: unknown } | undefined)
            ?.errorMessage,
        );
        expect(errorMessage).toContain('refused the request');
      });

      then('the whole answer and every line match snapshot', () => {
        expect(answered).toMatchSnapshot();
      });
    });

    when('[t1] the consumer opts into pass-through', () => {
      const consumer = useBeforeAll(async () =>
        genConsumer({ refusal: { as: 'ConstraintError' } }),
      );
      afterAll(async () => consumer.close());

      const answered = useThen('the http caller gets an answer', async () =>
        askConsumer({ url: consumer.url }),
      );

      then('the http caller gets the peer refusal as a 400, as before', () => {
        expect(answered.status).toEqual(400);
        expect(answered.text).toContain('payload.to');
      });

      then('the consumer logs handler.output at warn, after the peer line', () => {
        expect(answered.outputs.map((line) => line.level)).toEqual([
          'warn',
          'warn',
        ]);
      });

      then('no handler.error is written, since a caller fault is no server fault', () => {
        expect(answered.errors).toEqual([]);
      });

      then('the whole answer and every line match snapshot', () => {
        expect(answered).toMatchSnapshot();
      });
    });
  });

  given('[case2] an endpoint that is not reachable', () => {
    when('[t0] the server behind the url has closed', () => {
      then('it throws a MalfunctionError that names the url, method, and exid', async () => {
        const harness = await genApiGatewayProxyHarness({
          handler: genLambdaEndpoint.forApiGateway({
            schema: {
              input: z.object({ payload: z.object({}) }),
              output: asApiGatewayResponseSchema({ payload: z.object({}) }),
            },
            invoke: async () => ({ payload: {} }),
          }),
        });
        await harness.close();

        const error = await getError(
          askLambdaEndpoint.viaApiGateway(
            { url: `${harness.url}/notifications`, method: 'POST', body: {} },
            genContext({ exid: 'exid:ord-7' }),
          ),
        );

        // fetch alone throws a bare `TypeError: fetch failed`, which names no url and no exid
        expect(error).toBeInstanceOf(MalfunctionError);
        expect(error instanceof MalfunctionError ? error.metadata : null).toMatchObject({
          url: `${harness.url}/notifications`,
          method: 'POST',
          exid: 'exid:ord-7',
        });
      });
    });
  });
});
