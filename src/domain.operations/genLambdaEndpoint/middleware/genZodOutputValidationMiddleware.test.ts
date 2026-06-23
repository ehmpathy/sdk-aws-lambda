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
});
