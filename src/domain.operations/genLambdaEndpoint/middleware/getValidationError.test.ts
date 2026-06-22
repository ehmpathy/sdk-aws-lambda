import { ConstraintError } from 'helpful-errors';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { getValidationError } from './getValidationError';

describe('getValidationError', () => {
  given('[case1] zod error with single issue', () => {
    const schema = z.object({
      name: z.string(),
    });

    when('[t0] transformed', () => {
      const result = schema.safeParse({ name: 123 });
      if (result.success) throw new Error('expected parse to fail');

      const error = getValidationError({ error: result.error });

      then('it should return ConstraintError', () => {
        expect(error).toBeInstanceOf(ConstraintError);
      });

      then('it should include validation failed message', () => {
        expect(error.message).toContain('validation failed');
      });

      then('it should include issues in metadata', () => {
        expect(error.metadata.issues).toBeDefined();
        expect(error.metadata.issues).toHaveLength(1);
      });
    });
  });

  given('[case2] zod error with multiple issues', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    });

    when('[t0] transformed', () => {
      const result = schema.safeParse({
        name: 123,
        age: 'not a number',
        email: 'invalid',
      });
      if (result.success) throw new Error('expected parse to fail');

      const error = getValidationError({ error: result.error });

      then('it should include all issues', () => {
        expect(error.metadata.issues.length).toBeGreaterThanOrEqual(3);
      });

      then('it should include path for each issue', () => {
        const paths = error.metadata.issues.map(
          (issue: { path: string }) => issue.path,
        );
        expect(paths).toContain('name');
        expect(paths).toContain('age');
        expect(paths).toContain('email');
      });
    });
  });

  given('[case3] zod error with nested path', () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string(),
        }),
      }),
    });

    when('[t0] transformed', () => {
      const result = schema.safeParse({
        user: { profile: { name: 123 } },
      });
      if (result.success) throw new Error('expected parse to fail');

      const error = getValidationError({ error: result.error });

      then('it should join path with dots', () => {
        const paths = error.metadata.issues.map(
          (issue: { path: string }) => issue.path,
        );
        expect(paths).toContain('user.profile.name');
      });
    });
  });

  given('[case4] zod error with array index in path', () => {
    const schema = z.object({
      items: z.array(z.string()),
    });

    when('[t0] transformed', () => {
      const result = schema.safeParse({
        items: ['valid', 123, 'also valid'],
      });
      if (result.success) throw new Error('expected parse to fail');

      const error = getValidationError({ error: result.error });

      then('it should include array index in path', () => {
        const paths = error.metadata.issues.map(
          (issue: { path: string }) => issue.path,
        );
        expect(paths).toContain('items.1');
      });
    });
  });
});
