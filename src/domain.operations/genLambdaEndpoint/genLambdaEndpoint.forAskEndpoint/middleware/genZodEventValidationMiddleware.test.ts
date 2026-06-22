import { ConstraintError, getError } from 'helpful-errors';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { genZodEventValidationMiddleware } from './genZodEventValidationMiddleware';

describe('genZodEventValidationMiddleware', () => {
  const invokeMiddleware = async <T>(
    schema: z.ZodSchema<T>,
    event: unknown,
  ) => {
    const middleware = genZodEventValidationMiddleware({ schema });
    const request = {
      event,
      context: {} as Record<string, unknown>,
      response: undefined,
      error: undefined as unknown as Error,
      internal: {},
    } as unknown as Parameters<NonNullable<typeof middleware.before>>[0];

    await middleware.before!(request);
    return request.event;
  };

  given('[case1] valid input', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    when('[t0] validated', () => {
      then('it should pass validation', async () => {
        const result = await invokeMiddleware(schema, {
          name: 'alice',
          age: 30,
        });
        expect(result).toEqual({ name: 'alice', age: 30 });
      });
    });
  });

  given('[case2] invalid input', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    when('[t0] validated', () => {
      then('it should throw ConstraintError', async () => {
        const error = await getError(
          invokeMiddleware(schema, { name: 123, age: 'invalid' }),
        );
        expect(error).toBeInstanceOf(ConstraintError);
      });

      then('error message should contain validation failed', async () => {
        const error = await getError(
          invokeMiddleware(schema, { name: 123, age: 'invalid' }),
        );
        expect(error.message).toContain('validation failed');
      });
    });
  });

  given('[case3] schema with default values', () => {
    const schema = z.object({
      name: z.string(),
      enabled: z.boolean().default(true),
    });

    when('[t0] validated without optional field', () => {
      then('it should apply default value', async () => {
        const result = await invokeMiddleware(schema, { name: 'alice' });
        expect(result).toEqual({ name: 'alice', enabled: true });
      });
    });
  });

  given('[case4] schema with transform', () => {
    const schema = z.object({
      email: z.string().transform((val) => val.toLowerCase()),
    });

    when('[t0] validated', () => {
      then('it should apply transform', async () => {
        const result = await invokeMiddleware(schema, {
          email: 'ALICE@Example.COM',
        });
        expect(result).toEqual({ email: 'alice@example.com' });
      });
    });
  });

  given('[case5] partially valid input', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    });

    when('[t0] validated with mixed valid/invalid fields', () => {
      then('it should throw ConstraintError', async () => {
        const error = await getError(
          invokeMiddleware(schema, {
            name: 'alice',
            age: 'not a number',
            email: 'invalid',
          }),
        );
        expect(error).toBeInstanceOf(ConstraintError);
      });
    });
  });
});
