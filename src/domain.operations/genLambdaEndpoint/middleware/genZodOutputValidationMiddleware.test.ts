import middy from '@middy/core';
import type { Context } from 'aws-lambda';
import { getError, MalfunctionError } from 'helpful-errors';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { genZodOutputValidationMiddleware } from './genZodOutputValidationMiddleware';

describe('genZodOutputValidationMiddleware', () => {
  const invokeMiddleware = async <T>(
    schema: z.ZodSchema<T>,
    response: unknown,
  ) => {
    const middleware = genZodOutputValidationMiddleware({ schema });
    const request = {
      event: {},
      response,
      context: {} as Record<string, unknown>,
      error: undefined as unknown as Error,
      internal: {},
    } as unknown as Parameters<NonNullable<typeof middleware.after>>[0];

    await middleware.after!(request);
    return request.response;
  };

  given('[case1] valid output', () => {
    const schema = z.object({
      success: z.boolean(),
      data: z.string(),
    });

    when('[t0] validated', () => {
      then('it should pass validation', async () => {
        const result = await invokeMiddleware(schema, {
          success: true,
          data: 'hello',
        });
        expect(result).toEqual({ success: true, data: 'hello' });
      });
    });
  });

  given('[case2] invalid output', () => {
    const schema = z.object({
      success: z.boolean(),
      data: z.string(),
    });

    when('[t0] validated', () => {
      then('it should throw MalfunctionError', async () => {
        const error = await getError(
          invokeMiddleware(schema, { success: 'not boolean', data: 123 }),
        );
        expect(error).toBeInstanceOf(MalfunctionError);
      });

      then(
        'error message should contain output validation failed',
        async () => {
          const error = await getError(
            invokeMiddleware(schema, { success: 'not boolean', data: 123 }),
          );
          expect(error.message).toContain('output validation failed');
        },
      );
    });
  });

  given('[case3] output with transform', () => {
    const schema = z.object({
      timestamp: z.date().transform((val) => val.toISOString()),
    });

    when('[t0] validated', () => {
      then('it should apply transform', async () => {
        const date = new Date('2024-01-01T00:00:00.000Z');
        const result = await invokeMiddleware(schema, { timestamp: date });
        expect(result).toEqual({ timestamp: '2024-01-01T00:00:00.000Z' });
      });
    });
  });

  given('[case4] output with optional fields', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    when('[t0] validated without optional', () => {
      then('it should pass validation', async () => {
        const result = await invokeMiddleware(schema, { required: 'value' });
        expect(result).toEqual({ required: 'value' });
      });
    });

    when('[t1] validated with optional', () => {
      then('it should include optional', async () => {
        const result = await invokeMiddleware(schema, {
          required: 'value',
          optional: 'extra',
        });
        expect(result).toEqual({ required: 'value', optional: 'extra' });
      });
    });
  });

  /**
   * .what = the same middleware, run inside a REAL `middy(...).use(...)` chain
   * .why = every case above hand-feeds a `request` object, so each proves this middleware's own
   *        logic and says not one word about whether it COMPOSES. the two claims are separable,
   *        and only this case can prove the second:
   *          - that middy actually invokes the `after` hook we register
   *          - that the value we write to `request.response` is the value the caller receives
   *          - that a throw from the hook surfaces to the caller as a rejection, so a bad
   *            response cannot reach the wire
   *
   * .note = the sdk-contract smoke test asserts only `typeof middleware === 'function'`, which
   *         proves the export exists and no more. a middleware's whole purpose is to compose, so
   *         composition is the claim its coverage owes
   *
   * .note = a middy chain is in-process, so this crosses no remote boundary and stays a unit test
   *         (rule.forbid.unit.remote-boundaries)
   */
  given('[case5] composed into a real middy chain', () => {
    const schema = z.object({
      salute: z.string(),
      shouted: z.boolean().default(false),
    });

    const createMockContext = (): Context =>
      ({
        functionName: 'test-function',
        awsRequestId: 'test-request-id',
      }) as Context;

    when('[t0] the handler returns a response the schema accepts', () => {
      then(
        'the caller receives the VALIDATED value, defaults applied',
        async () => {
          const handler = middy(async () => ({ salute: 'aloha' })).use(
            genZodOutputValidationMiddleware({ schema }),
          );

          const result = await handler({}, createMockContext());

          // `shouted` was absent from the handler's return; the schema default supplies it —
          // which proves the middleware's write to `request.response` reached the caller
          expect(result).toEqual({ salute: 'aloha', shouted: false });
        },
      );
    });

    when('[t1] the handler returns a response the schema refuses', () => {
      then(
        'the invocation REJECTS, so no bad response reaches the wire',
        async () => {
          const handler = middy(async () => ({ salute: 42 })).use(
            genZodOutputValidationMiddleware({ schema }),
          );

          const error = await getError(handler({}, createMockContext()));

          expect(error).toBeInstanceOf(MalfunctionError);
          expect(error.message).toContain('output validation failed');
        },
      );
    });
  });
});
