import {
  BadRequestError,
  ConstraintError,
  MalfunctionError,
} from 'helpful-errors';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import { asLambdaEvent } from '../../../asLambdaEvent/asLambdaEvent';
import { asLambdaEventSchema } from '../../../asLambdaEventSchema/asLambdaEventSchema';
import { genLambdaEventRefusedLogMiddleware } from './genLambdaEventRefusedLogMiddleware';

/**
 * .what = a log that records each warn, for the context
 * .note = deliberate mutation in a `const` box — the calls land from inside the step
 */
const genLogFake = (): {
  log: { warn: (message: string, metadata?: unknown) => void };
  warned: { message: string; metadata: unknown }[];
} => {
  const warned: { message: string; metadata: unknown }[] = [];
  return {
    warned,
    log: {
      warn: (message, metadata) => {
        warned.push({ message, metadata });
      },
    },
  };
};

/**
 * .what = runs the step's `before` on an event, then its `onError` on a thrown value, as middy
 *         does when a later step (the validator, or `invoke`) throws
 * .as = middy's request type demands fields this step never reads; it reads `event`, `context`,
 *       `internal`, and `error` alone
 */
const runStepAcrossAThrow = async (input: {
  schema: unknown;
  event: unknown;
  error: unknown;
  context: Record<string, unknown>;
}): Promise<{ response: unknown }> => {
  const step = genLambdaEventRefusedLogMiddleware({ schema: input.schema });
  const request: Record<string, unknown> = {
    event: input.event,
    context: input.context,
    internal: {},
    response: undefined,
    error: undefined,
  };
  // .why = a schema with no source yields no step, so naught runs, as in a real chain
  await step?.before?.(request as never);
  // .note = deliberate mutation — middy writes the thrown value onto the request, then calls onError
  request.event = { payload: 'replaced by a later step' };
  request.error = input.error;
  await step?.onError?.(request as never);
  return { response: request.response };
};

const eventOfSns = asLambdaEvent.fromSns({ messages: ['{}'] });
const messageId = eventOfSns.Records[0]!.Sns.MessageId;

describe('genLambdaEventRefusedLogMiddleware', () => {
  given('[case1] an event-source schema, and a caller fault', () => {
    when('[t0] a ConstraintError is thrown, with a log present', () => {
      const { log, warned } = genLogFake();
      const outcome = useThen('the step runs', async () =>
        runStepAcrossAThrow({
          schema: asLambdaEventSchema.fromSns(),
          event: eventOfSns,
          error: new ConstraintError('notice is stale'),
          context: { log },
        }),
      );
      then(
        'one warn line is written, with the ids of the event as it arrived',
        () => {
          expect(warned).toHaveLength(1);
          expect(warned[0]).toMatchObject({
            message: 'lambda.event.refused',
            metadata: {
              source: 'sns',
              ids: [messageId],
              class: 'ConstraintError',
            },
          });
        },
      );
      then('it sets no response; the constraint step still answers', () => {
        expect(outcome.response).toBeUndefined();
      });
    });

    when('[t1] a BadRequestError is thrown', () => {
      const { log, warned } = genLogFake();
      useThen('the step runs', async () =>
        runStepAcrossAThrow({
          schema: asLambdaEventSchema.fromSns(),
          event: eventOfSns,
          error: new BadRequestError('complaints route to the abuse desk'),
          context: { log },
        }),
      );
      then('it warns too, since it is a caller fault aws drops', () => {
        expect(warned.map((line) => line.message)).toEqual([
          'lambda.event.refused',
        ]);
      });
    });
  });

  given('[case2] a schema that declares no source', () => {
    when('[t0] a ConstraintError is thrown, with a log present', () => {
      const { log, warned } = genLogFake();
      useThen('the step runs', async () =>
        runStepAcrossAThrow({
          schema: z.object({}),
          event: {},
          error: new ConstraintError('refused'),
          context: { log },
        }),
      );
      then('no warn line; a direct caller reads its own response', () => {
        expect(warned).toEqual([]);
      });
    });
    when('[t1] the step is built', () => {
      then('it is null, so no step joins that endpoint chain', () => {
        expect(
          genLambdaEventRefusedLogMiddleware({ schema: z.object({}) }),
        ).toBeNull();
      });
    });
  });

  given('[case3] a chain with no log (trail never ran)', () => {
    when('[t0] a ConstraintError is thrown', () => {
      const outcome = useThen('the step runs', async () => {
        // .why = the spy window spans this one step alone, so it sees no other case's warns
        const spy = jest.spyOn(console, 'warn');
        try {
          await runStepAcrossAThrow({
            schema: asLambdaEventSchema.fromSns(),
            event: eventOfSns,
            error: new ConstraintError('refused'),
            context: {},
          });
          return { warnCount: spy.mock.calls.length };
        } finally {
          spy.mockRestore();
        }
      });
      then('no warn line is written, and the step does not throw', () => {
        expect(outcome.warnCount).toEqual(0);
      });
    });
  });

  given('[case4] a thrown value that is no caller fault', () => {
    when('[t0] a MalfunctionError is thrown, with a log present', () => {
      const { log, warned } = genLogFake();
      useThen('the step runs', async () =>
        runStepAcrossAThrow({
          schema: asLambdaEventSchema.fromSns(),
          event: eventOfSns,
          error: new MalfunctionError('lookup table unreachable'),
          context: { log },
        }),
      );
      then(
        'no warn line; aws retries a server fault, so the event is not lost',
        () => {
          expect(warned).toEqual([]);
        },
      );
    });

    when('[t1] a value that is not an Error is thrown', () => {
      const { log, warned } = genLogFake();
      useThen('the step runs', async () =>
        runStepAcrossAThrow({
          schema: asLambdaEventSchema.fromSns(),
          event: eventOfSns,
          error: 'not an error',
          context: { log },
        }),
      );
      then('no warn line', () => {
        expect(warned).toEqual([]);
      });
    });
  });
});
