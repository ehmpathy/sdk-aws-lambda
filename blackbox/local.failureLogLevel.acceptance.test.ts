import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { given, then, useBeforeAll, useThen, when } from 'test-fns';
import { z } from 'zod';

import { genApiGatewayProxyHarness } from '../src/__test_assets__/genApiGatewayProxyHarness';
import {
  asApiGatewayResponseSchema,
  asLambdaEvent,
  askLambdaEndpoint,
  type EndpointOperation,
  genLambdaEndpoint,
  runLambdaEndpoint,
} from '../src/index';
import { asLogLineMasked } from './__test_assets__/asLogLineMasked';

/**
 * .what = runs one call through the export a consumer imports, and records the lines on-call reads
 * .why = a handled failure reads a success to aws, so the log level is on-call's one signal
 *        (sdk-aws-lambda#77: 24 prod failures hid at debug). each `forAsk` outcome is read here;
 *        for `forApiGateway` and `forSqs`, the success is read here and the failures in
 *        `local.askApiGateway` and `local.sqsQueue`
 *
 * .note = sdk-logs writes warn and error through `console.warn`, and info and debug through
 *         `console.log`, each with its level inside the line. both spies only observe: they call
 *         through to the real console (`rule.forbid.acceptance.mocks`)
 */
const runOnce = async (input: {
  run: () => Promise<unknown>;
}): Promise<{
  invokeRejected: boolean;
  lines: { console: 'warn' | 'log'; line: Record<string, unknown> }[];
}> => {
  const spyWarn = jest.spyOn(console, 'warn');
  const spyLog = jest.spyOn(console, 'log');
  try {
    const invokeRejected = await input.run().then(
      () => false,
      () => true,
    );

    // each handler line, with the console it reached, whole save its volatile fields
    const asConsoleLines = (inputConsole: {
      console: 'warn' | 'log';
      calls: unknown[][];
    }): { console: 'warn' | 'log'; line: Record<string, unknown> }[] =>
      inputConsole.calls
        .map((args) => args[0])
        .filter(
          (line): line is Record<string, unknown> =>
            typeof line === 'object' &&
            line !== null &&
            ['handler.output', 'handler.error'].includes(
              String((line as { message?: unknown }).message),
            ),
        )
        .map((line) => ({
          console: inputConsole.console,
          line: asLogLineMasked({ line }),
        }));
    const lines = [
      ...asConsoleLines({ console: 'warn', calls: spyWarn.mock.calls }),
      ...asConsoleLines({ console: 'log', calls: spyLog.mock.calls }),
    ];
    return { invokeRejected, lines };
  } finally {
    spyWarn.mockRestore();
    spyLog.mockRestore();
  }
};

/**
 * .what = runs one call of a `forAsk` endpoint whose invoke is given
 * .why = the four `forAsk` arms differ only in what the invoke does
 */
const runOnceForAsk = async (input: {
  invoke: EndpointOperation<{ name: string }, { salute: string }>;
}): ReturnType<typeof runOnce> =>
  runOnce({
    run: () =>
      runLambdaEndpoint.onReferenced({
        handler: genLambdaEndpoint.forAsk({
          schema: {
            input: z.object({ name: z.string() }),
            output: z.object({ salute: z.string() }),
          },
          invoke: input.invoke,
        }),
        struct: { payload: 'ancient' },
        event: { name: 'Kai' },
      }),
  });

/**
 * .what = a real `forApiGateway` peer over http that refuses a spot shorter than 3 characters
 * .why = the refusal a handler throws is then the one a consumer logs, never a hand-built one
 */
const genForecastPeer = async (): ReturnType<typeof genApiGatewayProxyHarness> =>
  genApiGatewayProxyHarness({
    handler: genLambdaEndpoint.forApiGateway({
      schema: {
        input: z.object({ payload: z.object({ spot: z.string().min(3) }) }),
        output: asApiGatewayResponseSchema({
          payload: z.object({ swell: z.string() }),
        }),
      },
      invoke: async () => ({ payload: { swell: 'overhead' } }),
    }),
  });

/**
 * .what = a `forAsk` invoke that asks the forecast peer with a bad spot, under the opt given
 * .why = the handler's own log carries its trail to the peer, as a consumer's does
 */
const asForecastAsk =
  (input: {
    url: string;
    refusal: { as: 'ConstraintError' } | null;
  }): EndpointOperation<{ name: string }, { salute: string }> =>
  async (_, { log }) => {
    await askLambdaEndpoint.viaApiGateway(
      {
        url: `${input.url}/forecast`,
        method: 'POST',
        body: { spot: 'x' },
        ...(input.refusal ? { refusal: input.refusal } : {}),
      },
      { log },
    );
    return { salute: 'unreached' };
  };

/**
 * .what = the message and level of each line, for the assertions that name them
 * .why = the snapshot pins every field; these name the two on-call filters by
 */
const asLevels = (input: {
  lines: { console: 'warn' | 'log'; line: Record<string, unknown> }[];
}): { console: string; message: unknown; level: unknown }[] =>
  input.lines.map(({ console, line }) => ({
    console,
    message: line.message,
    level: line.level,
  }));

describe('the failure log level of an endpoint', () => {
  // the local default floor is info, which writes no debug line. the floor is lowered for this
  // file, so a success's debug line is seen, not merely the absence of a warn
  const logLevelPrior = process.env.LOG_LEVEL;
  beforeAll(() => {
    process.env.LOG_LEVEL = 'debug';
  });
  afterAll(() => {
    if (logLevelPrior === undefined) delete process.env.LOG_LEVEL;
    if (logLevelPrior !== undefined) process.env.LOG_LEVEL = logLevelPrior;
  });

  given('[case1] a forAsk endpoint, through the export', () => {
    when('[t0] the handler succeeds', () => {
      const outcome = useThen('the invoke settles', async () =>
        runOnceForAsk({ invoke: async () => ({ salute: 'aloha, Kai' }) }),
      );

      then('handler.output is written at debug, never at warn or above', () => {
        expect(outcome.invokeRejected).toEqual(false);
        expect(asLevels(outcome)).toEqual([
          { console: 'log', message: 'handler.output', level: 'debug' },
        ]);
      });

      then('the lines match snapshot', () => {
        expect(outcome).toMatchSnapshot();
      });
    });

    when('[t1] the handler throws a ConstraintError', () => {
      const outcome = useThen('the invoke settles', async () =>
        runOnceForAsk({
          invoke: async () => {
            throw new ConstraintError('the surf spot is closed');
          },
        }),
      );

      then('handler.output is written at warn, and no handler.error', () => {
        expect(asLevels(outcome)).toEqual([
          { console: 'warn', message: 'handler.output', level: 'warn' },
        ]);
      });

      then('the lines match snapshot', () => {
        expect(outcome).toMatchSnapshot();
      });
    });

    when('[t2] the handler throws a MalfunctionError', () => {
      const outcome = useThen('the invoke settles', async () =>
        runOnceForAsk({
          invoke: async () => {
            throw new MalfunctionError('the wave feed is down');
          },
        }),
      );

      then('the invoke fails, so aws counts an error', () => {
        expect(outcome.invokeRejected).toEqual(true);
      });

      then('handler.output and handler.error are each written at error', () => {
        expect(asLevels(outcome)).toEqual([
          { console: 'warn', message: 'handler.output', level: 'error' },
          { console: 'warn', message: 'handler.error', level: 'error' },
        ]);
      });

      then('the lines match snapshot', () => {
        expect(outcome).toMatchSnapshot();
      });
    });

    when('[t3] a peer refused the request the handler composed', () => {
      const peer = useBeforeAll(async () => genForecastPeer());
      afterAll(async () => peer.close());

      const outcome = useThen('the invoke settles', async () =>
        runOnceForAsk({
          invoke: asForecastAsk({ url: peer.url, refusal: null }),
        }),
      );

      then('the invoke fails, so aws counts an error', () => {
        expect(outcome.invokeRejected).toEqual(true);
      });

      then('the peer line is at warn; the handler writes handler.output and handler.error each at error', () => {
        expect(asLevels(outcome)).toEqual([
          { console: 'warn', message: 'handler.output', level: 'warn' },
          { console: 'warn', message: 'handler.output', level: 'error' },
          { console: 'warn', message: 'handler.error', level: 'error' },
        ]);
      });

      then('the handler line names the peer refusal and the opt-in', () => {
        const errorMessage = String(
          (outcome.lines[1]?.line.metadata as { errorMessage?: unknown } | undefined)
            ?.errorMessage,
        );
        expect(errorMessage).toContain('LambdaEndpointRefusedError');
        expect(errorMessage).toContain('refused the request');
        expect(errorMessage).toContain("refusal: { as: 'ConstraintError' }");
      });

      then('the lines match snapshot', () => {
        expect(outcome).toMatchSnapshot();
      });
    });

    when('[t4] a peer refused, and the handler opts into pass-through', () => {
      const peer = useBeforeAll(async () => genForecastPeer());
      afterAll(async () => peer.close());

      const outcome = useThen('the invoke settles', async () =>
        runOnceForAsk({
          invoke: asForecastAsk({
            url: peer.url,
            refusal: { as: 'ConstraintError' },
          }),
        }),
      );

      then('the peer line and the handler line are each at warn, and no handler.error', () => {
        expect(asLevels(outcome)).toEqual([
          { console: 'warn', message: 'handler.output', level: 'warn' },
          { console: 'warn', message: 'handler.output', level: 'warn' },
        ]);
      });

      then('the handler line holds the peer ConstraintError, with no refusal wrap', () => {
        const errorMessage = String(
          (outcome.lines[1]?.line.metadata as { errorMessage?: unknown } | undefined)
            ?.errorMessage,
        );
        expect(errorMessage).toContain('ConstraintError');
        expect(errorMessage).not.toContain('refused the request');
      });

      then('the lines match snapshot', () => {
        expect(outcome).toMatchSnapshot();
      });
    });
  });

  /**
   * .what = a success of each peer family stays at debug too
   * .why = the failure levels of these families are read in `local.askApiGateway` and
   *        `local.sqsQueue`, whose spies watch `console.warn` alone; a debug line goes to
   *        `console.log`, so the success arm of each is read here
   */
  given('[case2] a forApiGateway endpoint, through the export', () => {
    when('[t0] the handler succeeds', () => {
      const outcome = useThen('the invoke settles', async () =>
        runOnce({
          run: () =>
            runLambdaEndpoint.onReferenced({
              handler: genLambdaEndpoint.forApiGateway({
                schema: {
                  input: z.object({ payload: z.object({ name: z.string() }) }),
                  output: asApiGatewayResponseSchema({
                    payload: z.object({ salute: z.string() }),
                  }),
                },
                invoke: async ({ payload }) => ({
                  payload: { salute: `aloha, ${payload.name}` },
                }),
              }),
              struct: { payload: 'ancient' },
              event: asLambdaEvent.fromApiGateway({
                body: { name: 'Kai' },
                httpMethod: 'POST',
              }),
            }),
        }),
      );

      then('handler.output is written at debug, never at warn or above', () => {
        expect(outcome.invokeRejected).toEqual(false);
        expect(asLevels(outcome)).toEqual([
          { console: 'log', message: 'handler.output', level: 'debug' },
        ]);
      });

      then('the lines match snapshot', () => {
        expect(outcome).toMatchSnapshot();
      });
    });
  });

  given('[case3] a forSqs.perRecord endpoint, through the export', () => {
    when('[t0] the handler succeeds on its one record', () => {
      const outcome = useThen('the invoke settles', async () =>
        runOnce({
          run: () =>
            runLambdaEndpoint.onReferenced({
              handler: genLambdaEndpoint.forSqs.perRecord({
                schema: {
                  input: z.object({
                    headers: z.object({}),
                    payload: z.object({ orderId: z.string() }),
                  }),
                },
                invoke: async () => {},
              }),
              struct: { payload: 'ancient' },
              event: asLambdaEvent.fromSqs({
                messages: [JSON.stringify({ orderId: 'ord-0' })],
              }),
            }),
        }),
      );

      then('handler.output is written at debug, never at warn or above', () => {
        expect(outcome.invokeRejected).toEqual(false);
        expect(asLevels(outcome)).toEqual([
          { console: 'log', message: 'handler.output', level: 'debug' },
        ]);
      });

      then('the lines match snapshot', () => {
        expect(outcome).toMatchSnapshot();
      });
    });
  });

  given('[case4] a forSqs.perBatch endpoint, through the export', () => {
    when('[t0] the handler succeeds on its one record', () => {
      const outcome = useThen('the invoke settles', async () =>
        runOnce({
          run: () =>
            runLambdaEndpoint.onReferenced({
              handler: genLambdaEndpoint.forSqs.perBatch({
                schema: {
                  input: z.object({
                    headers: z.object({}),
                    payload: z.object({ orderId: z.string() }),
                  }),
                },
                invoke: async ({ records }) => ({ successes: records }),
              }),
              struct: { payload: 'ancient' },
              event: asLambdaEvent.fromSqs({
                messages: [JSON.stringify({ orderId: 'ord-0' })],
              }),
            }),
        }),
      );

      then('handler.output is written at debug, never at warn or above', () => {
        expect(outcome.invokeRejected).toEqual(false);
        expect(asLevels(outcome)).toEqual([
          { console: 'log', message: 'handler.output', level: 'debug' },
        ]);
      });

      then('the lines match snapshot', () => {
        expect(outcome).toMatchSnapshot();
      });
    });
  });
});
