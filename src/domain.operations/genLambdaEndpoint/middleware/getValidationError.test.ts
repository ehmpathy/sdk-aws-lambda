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
   * .what = the `.strict()` HEADER footgun, clamped on both arms
   * .why = the sdk parses the WHOLE wire header bag against `schema.input`, so a strict header
   *        schema refuses EVERY real request — api gateway always injects `host`,
   *        `x-forwarded-for`, `x-amzn-trace-id`, and cloudfront's own keys. zod names the
   *        symptom and never the cure, so the sdk names the cure
   *
   * .why the payload arm is not optional = it is the POSITIVE CONTROL. the hint must fire on
   *        exactly one path, and a one-arm test cannot tell a correctly-scoped hint from one
   *        that fires on every `unrecognized_keys` issue
   *        (`rule.require.positive-control-before-absence-claims`)
   */
  given('[case5] a schema that declares its HEADERS strict', () => {
    const schema = z.object({
      headers: z.object({ authorization: z.string() }).strict(),
      payload: z.object({ to: z.string() }),
    });

    when('[t0] a real api-gateway bag is parsed against it', () => {
      const result = schema.safeParse({
        headers: {
          authorization: 'Bearer tok',
          host: 'abc.execute-api.us-east-1.amazonaws.com',
          'x-forwarded-for': '1.2.3.4',
          'x-amzn-trace-id': 'Root=1-abc',
        },
        payload: { to: 'kai' },
      });
      if (result.success)
        throw new Error('expected a strict header bag to refuse the request');

      const error = getValidationError({ error: result.error });

      then('the message names the fix, not only the symptom', () => {
        expect(error.message).toContain('must NOT be `.strict()`');
        expect(error.message).toContain('drop `.strict()`');
      });

      then('it still names the symptom zod found', () => {
        expect(error.message).toContain('host');
      });

      /**
       * .why a snapshot BESIDE the assertions = this string is the one surface that rescues
       *        an author from a 100%-outage footgun, and `toContain` renders none of it. a
       *        reviewer could read both assertions above and still not know whether the message
       *        a human meets is legible, ordered, or merely a wall
       *        (`rule.require.snapshots` — the snapshot is for review observability, the
       *        assertions for functional verification; this test had only the second half)
       * .note = deterministic by construction — a pure function of the schema and the bag above.
       *         no clock, no uuid, no path, so it denies no volatile field
       *         (`rule.require.snapshots-deny-volatile-not-allow-expected`)
       */
      then('and the whole message reads well to the human who meets it', () => {
        expect(error.message).toMatchSnapshot();
      });
    });
  });

  given(
    '[case6] a schema that declares its PAYLOAD strict — the control',
    () => {
      const schema = z.object({
        headers: z.object({ authorization: z.string() }),
        payload: z.object({ to: z.string() }).strict(),
      });

      when('[t0] a body with an undeclared key is parsed against it', () => {
        const result = schema.safeParse({
          headers: { authorization: 'Bearer tok', host: 'abc.amazonaws.com' },
          payload: { to: 'kai', surprise: 1 },
        });
        if (result.success)
          throw new Error('expected a strict payload to refuse the extra key');

        const error = getValidationError({ error: result.error });

        then('the hint does NOT fire — a strict payload is correct', () => {
          expect(error.message).not.toContain('.strict()');
        });

        then('the refusal itself still stands', () => {
          expect(error.message).toContain('validation failed');
          expect(error.metadata.issues[0]!.code).toEqual('unrecognized_keys');
        });

        /**
         * .why the CONTROL earns a snapshot more than its twin does = `not.toContain` is the
         *        least legible assertion a reviewer can read. it proves an absence and shows
         *        none of what IS there, so a message that silently degraded — or that grew a
         *        DIFFERENT wrong hint — would satisfy it untouched. the snapshot renders the
         *        whole string, so the absence is visible rather than merely asserted
         */
        then(
          'and the message a payload author meets holds no header advice',
          () => {
            expect(error.message).toMatchSnapshot();
          },
        );
      });
    },
  );

  /**
   * .what = the two arms of the hint fork, clamped as a PAIR
   * .why = the generic hint makes a claim — *"the value you sent does not satisfy the schema"* —
   *        and on the constructor-reject path that claim is false: `X.contract()` coerces, so
   *        the schema ACCEPTED the payload and the constructor refused it afterward. two
   *        reviewers converged on it in one round (`i004.r005.nitpick.2`, `i004.r010.nitpick.2`)
   *
   * 🔴 .why BOTH arms are clamped, and why `[case8]` is the one that matters = the discriminator
   *        proposed with the find was `code === 'custom'`, and it is MEASURED over-broad — a
   *        constructor reject and a plain `.refine()` emit byte-identical issue shapes. so
   *        `[case8]` is the POSITIVE CONTROL: it is a `custom`-coded issue that MUST still take
   *        the generic hint, and it goes red the moment anyone simplifies the check to the code
   *        (rule.require.clamp-edge-cases — clamp the class, and prove the clamp bites)
   */
  given('[case7] every issue already names its own fix', () => {
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
    '[case8] a plain .refine() — custom-coded, and a real CALLER fault',
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
