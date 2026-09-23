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

      /**
       * .what = the FIX half of the message, clamped at the surface a caller actually meets
       * .why = `rule.require.errors-name-the-fix` asks for what + why + the next move. the zod
       *        summary carries the first two; the hint is the third, and before this round it
       *        was absent — the message ended at `expected object, received string`
       *
       * .why read off `.message` and NOT `.metadata` = helpful-errors serializes metadata INTO
       *      the message, so `.message` is what a caller reads. a metadata-only assertion would
       *      pass even where the serialization stopped to carry it
       *      (rule.require.measure-the-value-you-emit)
       */
      then('the message names the fix, not only the symptom', () => {
        expect(error.message).toContain('send a value that satisfies');
        expect(error.message).toContain('correct each path named in');
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

  /**
   * .what = the two arms of the hint fork, clamped as a PAIR
   * .why = the generic hint makes a claim — *"the value you sent does not satisfy the schema"* —
   *        and on the constructor-reject path that claim is false: `X.contract()` coerces, so
   *        the schema ACCEPTED the payload and the constructor refused it afterward. two
   *        reviewers converged on it in one round (`i004.r005.nitpick.2`, `i004.r010.nitpick.2`)
   *
   * 🔴 .why BOTH arms are clamped, and why `[case6]` is the one that matters = the discriminator
   *        proposed with the find was `code === 'custom'`, and it is MEASURED over-broad — a
   *        constructor reject and a plain `.refine()` emit byte-identical issue shapes. so
   *        `[case6]` is the POSITIVE CONTROL: it is a `custom`-coded issue that MUST still take
   *        the generic hint, and it goes red the moment anyone simplifies the check to the code
   *        (rule.require.clamp-edge-cases — clamp the class, and prove the clamp bites)
   */
  given('[case5] every issue already names its own fix', () => {
    // the shape `domain-objects` emits when a ctor rejects what the schema accepted
    const schema = z.object({
      spot: z.custom<{ name: string }>().superRefine((_, ctx) => {
        ctx.addIssue(
          'GuardedSpot.contract(): the props satisfied the schema, but `GuardedSpot.build(props)` threw — a surf spot must carry a name. fix: align `static schema` with what the constructor demands',
        );
      }),
    });

    when('[t0] transformed', () => {
      const result = schema.safeParse({ spot: { name: '  ' } });
      if (result.success) throw new Error('expected parse to fail');

      const error = getValidationError({ error: result.error });

      then('the hint defers to the fix each issue already names', () => {
        expect(error.metadata.hint).toContain('names its own fix');
      });

      then(
        'it does NOT tell the caller to re-send what the schema took',
        () => {
          expect(error.metadata.hint).not.toContain(
            'send a value that satisfies',
          );
        },
      );

      then('it names whose fault it is, since the caller has no move', () => {
        expect(error.metadata.hint).toContain('endpoint author');
      });
    });
  });

  given(
    '[case6] a plain .refine() — custom-coded, and a real CALLER fault',
    () => {
      const schema = z.object({
        name: z.string().refine((value) => value.length > 3, 'too short'),
      });

      when('[t0] transformed', () => {
        const result = schema.safeParse({ name: 'ab' });
        if (result.success) throw new Error('expected parse to fail');

        const error = getValidationError({ error: result.error });

        then(
          'the issue carries zod`s custom code, same as a ctor reject',
          () => {
            expect(error.metadata.issues[0]!.code).toEqual('custom');
          },
        );

        then(
          'and the GENERIC hint is still correct, so it is what lands',
          () => {
            expect(error.metadata.hint).toContain(
              'send a value that satisfies',
            );
          },
        );
      });
    },
  );
});
