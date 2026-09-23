import { ConstraintError, getError } from 'helpful-errors';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { getValidatedInput } from './getValidatedInput';

/**
 * .what = the primitive's OWN contract, clamped in the primitive's own vocabulary
 * .why = both families clamp it through their middy request shape, at 4 and 6 casts each. this
 *        file reaches it directly, at zero, so the guarantees below survive a family that moves
 *        its slot — which the subject's `.note` names as the next step (the 🚧 F31 fulcrum)
 *
 * .note = there is deliberately NO domain-object here. the subject imports `zod` and its peer
 *         error builder, and no third dependency, so its test carries the same set. the
 *         POST-parse claim is proven by a plain `.transform()`; that a `X.contract()` position
 *         yields a live instance is one INSTANCE of that claim, and it is clamped at both
 *         families where the dobj vocabulary actually lives
 *
 * .note = the caselist-inside-given shape is this repo's paved form for a pure transformer —
 *         `asServiceSymbols.test.ts` and `asGenArgs.test.ts` both split a VALID table from an
 *         INVALID one and vary each under one `given`. reused rather than improvised, so a
 *         fifth case is a row rather than a block (rule.prefer.data-driven)
 */
describe('getValidatedInput', () => {
  // .note = each row is declared at `unknown`, deliberately. the rows carry DIFFERENT schemas,
  //         so an inferred table widens to a union that the subject's one type parameter cannot
  //         unify. `unknown` is what the subject's own `value` slot already takes, and the
  //         assertion is structural — so this costs no guarantee and needs no cast
  //         (rule.forbid.as-cast). the asServiceSymbols table needs none of this because its
  //         every row is one `service: string`
  interface CaseValid {
    description: string;
    schema: z.ZodSchema<unknown>;
    value: unknown;
    expect: unknown;
  }

  // the VALID class: the schema accepts the value, so the parsed result comes back
  const CASES_VALID: CaseValid[] = [
    {
      description: 'a plain shape, where the two parse faces are equal',
      schema: z.object({ name: z.string(), age: z.number() }),
      value: { name: 'alice', age: 30 },
      expect: { name: 'alice', age: 30 },
    },
    {
      // .why = the subject's `.note` claims the result is the POST-parse shape. a transform is
      //        the smallest schema whose two faces DIFFER, so it settles the claim without a
      //        dobj — and it is the only row here that goes red if the subject returns its input
      description: 'a schema that TRANSFORMS, where the two faces differ',
      schema: z.object({
        handle: z.string().transform((raw) => raw.toUpperCase()),
      }),
      value: { handle: 'crush' },
      expect: { handle: 'CRUSH' },
    },
  ];

  given('[case1] a value its schema accepts', () => {
    CASES_VALID.map((thisCase) =>
      when(`[t0] ${thisCase.description}`, () => {
        then('the POST-parse value comes back', () => {
          const result = getValidatedInput({
            schema: thisCase.schema,
            value: thisCase.value,
          });
          expect(result).toEqual(thisCase.expect);
        });
      }),
    );
  });

  /**
   * .what = the parsed value keeps its PROTOTYPE, not merely its fields
   * .why = every assertion in `[case1]` is `toEqual`, which compares STRUCTURE and is blind to
   *        identity. so a subject that deep-copied its result — the sort of edit a redaction, a
   *        freeze, or a serialize-roundtrip invites — would pass every row above and silently
   *        strip the class off every `X.contract()` position the two families depend on
   *
   * ⚠️ .what this clamp DOES and DOES NOT catch, measured by revert rather than reasoned:
   *
   *      `return JSON.parse(JSON.stringify(result.data))`  -> 🔴 2 red. the class is gone
   *      `return { ...result.data }`                       -> 🟢 GREEN. it does NOT bite
   *
   *      the shallow spread copies only the OUTERMOST object, which is a plain `z.object`
   *      result either way — every instance below it rides across by reference. so this case
   *      guards the DEEP-copy class and no other, and a reader must not read it as proof that
   *      any copy is caught (rule.require.clamp-edge-cases — prove the clamp bites, and say
   *      which class it bites)
   *
   * .why a plain class and NOT a domain object = the gap this closes is `Object.getPrototypeOf`,
   *        and a bare class exercises it exactly. a dobj would prove the same one bit while it
   *        added a third dependency this file's header deliberately excludes — and the dobj
   *        vocabulary is already clamped at both families, where it belongs
   *
   * .note = this is the one guarantee the primitive owns that a STRUCTURAL assertion cannot
   *         reach. the shapes beneath it — an array, a `.nested` rebuild, a constructor that
   *         rejects — are zod's and domain-objects', never this subject's: it holds no branch
   *         for any of them, so there is no path here for such a regression to land in
   */
  given('[case3] a schema whose parse yields a CLASS instance', () => {
    class Surfboard {
      constructor(public readonly fins: number) {}
    }

    const schema = z.object({
      board: z
        .object({ fins: z.number() })
        .transform((raw) => new Surfboard(raw.fins)),
      boards: z.array(
        z
          .object({ fins: z.number() })
          .transform((raw) => new Surfboard(raw.fins)),
      ),
    });

    when('[t0] the value is validated', () => {
      const result = getValidatedInput({
        schema,
        value: { board: { fins: 3 }, boards: [{ fins: 1 }, { fins: 4 }] },
      });

      then('the instance survives, prototype intact', () => {
        expect(result.board).toBeInstanceOf(Surfboard);
      });

      then('every element of an array survives too', () => {
        expect(result.boards).toHaveLength(2);
        for (const board of result.boards)
          expect(board).toBeInstanceOf(Surfboard);
      });

      then('and the fields are what the parse produced', () => {
        expect(result.board.fins).toEqual(3);
        expect(result.boards.map((board) => board.fins)).toEqual([1, 4]);
      });
    });
  });

  /**
   * .what = a schema the value SATISFIES, whose post-parse step then THROWS
   * .why = both families clamp a domain object whose constructor guards a value its own zod
   *        `schema` accepts (`GuardedSpot`, twice), and each measures a `ConstraintError`. a
   *        reviewer noted the primitive they share carried no such case. it does now — and the
   *        answer it returns is NOT the one the two families' behavior predicts
   *
   * ⚠️ .why NO domain object here = this file's header states the subject imports `zod` and its
   *         peer error builder and no third dependency, so its test carries the same set. the
   *         fixture is therefore a bare `.transform()` that throws — the smallest post-parse
   *         rejection zod alone can express
   *
   * 🔴 .MEASURED, and it overturned the assumption this case was written to confirm = a bare
   *    `.transform()` that throws does NOT reach the subject's `!result.success` branch. zod
   *    propagates the throw, so it escapes `getValidatedInput` as a plain `Error`:
   *      expected ConstraintError · received Error
   *    ⇒ so the two post-parse rejections are NOT one behavior:
   *        · a `domain-objects` constructor throw → caught by `.contract()`, reported as a zod
   *          issue → `!result.success` → `ConstraintError` (clamped at both families)
   *        · a bare `.transform()` throw          → propagates raw, uncaught
   *    the funnel belongs to `domain-objects`, never to zod and never to this subject. that
   *    split was undocumented, and a reader who met only the two family cases would infer the
   *    wrong rule — which is exactly what the author of this case did
   *
   * ⛔ .the consequence — and it was RULED 2026-09-21 as CORRECT, never as a deferred defect =
   *    at `forApiGateway` a raw `Error` from the validation middleware reaches
   *    `genInternalServiceErrorMiddleware`, so a consumer whose own `.transform()` guards a
   *    caller's bad value gets a **500**. that reads as a defect and is not one: a bare guard
   *    `throw` and a genuine null-deref inside a transform are INDISTINGUISHABLE — same plain
   *    `Error`, same `inst._zod.parse` frame — so a server fault is the only honest read
   *
   *    ⇒ the repair a reader reaches for first (catch arbitrary throws) is the one
   *      `rule.forbid.failhide` refuses, for the SAME reason: it cannot part the two either
   *
   *    ⇒ and a consumer who MEANS a caller fault has two zod-native forms, clamped at both
   *      families' `[t2]` (`.refine()`) and `[t3]` (`ctx.addIssue` + `z.NEVER`)
   *
   *    ⚠️ itemized as `F35`, which is now closed NO REPAIR OWED. this case pins correct
   *      behavior; to re-open it, show a schema shape where the two throws differ
   */
  given(
    '[case4] a value its schema accepts and its POST-PARSE step throws',
    () => {
      // .note = the message deliberately names NO field. a first draft threw 'a surf spot must
      //         carry a name', and a `.toContain('spot')` row passed on the word in the PROSE
      //         rather than on any field the error builder named — an incidental match that would
      //         have read as evidence the throw was funneled
      const schema = z.object({
        spot: z.string().transform((raw) => {
          if (raw.trim() === '') throw new Error('blank is not allowed here');
          return raw;
        }),
      });

      when('[t0] the post-parse step throws', () => {
        then(
          'the throw ESCAPES as a plain Error, never a ConstraintError',
          () => {
            const error = getError(() =>
              getValidatedInput({ schema, value: { spot: '   ' } }),
            );
            expect(error).toBeInstanceOf(Error);
            expect(error).not.toBeInstanceOf(ConstraintError);
          },
        );

        then('and it carries the thrower message, unwrapped', () => {
          const error = getError(() =>
            getValidatedInput({ schema, value: { spot: '   ' } }),
          );
          expect(error.message).toEqual('blank is not allowed here');
        });
      });

      // .why the POSITIVE CONTROL = the rows above assert a THROW, so each would stay green if
      //      this schema rejected every value for some unrelated reason. this row proves the same
      //      schema accepts a real name, so the throw above is scoped to the guard rather than
      //      broadly coupled (rule.require.clamp-edge-cases)
      when(
        '[t1] the same schema meets a value its post-parse step accepts',
        () => {
          then('it returns the parsed value', () => {
            expect(
              getValidatedInput({ schema, value: { spot: 'pipeline' } }),
            ).toEqual({ spot: 'pipeline' });
          });
        },
      );
    },
  );

  // the INVALID class: the schema rejects the value, so it throws and the message names why
  // .note = the expectation reads off `.message` rather than `.metadata`, because helpful-errors
  //         serializes metadata INTO the message — so this clamps the string a human actually
  //         meets, and it needs no cast (rule.forbid.as-cast)
  interface CaseInvalid {
    description: string;
    schema: z.ZodSchema<unknown>;
    value: unknown;
    expect: { messageNames: string[] };
  }

  const CASES_INVALID: CaseInvalid[] = [
    {
      description: 'one field at fault',
      schema: z.object({ name: z.string(), age: z.number() }),
      value: { name: 123, age: 30 },
      expect: { messageNames: ['name'] },
    },
    {
      // .why = the error builder joins EVERY issue into the message. one that reported only the
      //        first would make a two-field mistake cost two round trips to find
      description: 'SEVERAL fields at fault at once',
      schema: z.object({ name: z.string(), age: z.number() }),
      value: { name: 123, age: 'nope' },
      expect: { messageNames: ['name', 'age'] },
    },
  ];

  given('[case2] a value its schema rejects', () => {
    CASES_INVALID.map((thisCase) =>
      when(`[t0] ${thisCase.description}`, () => {
        const error = getError(() =>
          getValidatedInput({
            schema: thisCase.schema,
            value: thisCase.value,
          }),
        );

        then('it throws a ConstraintError', () => {
          expect(error).toBeInstanceOf(ConstraintError);
        });

        then('the message names every field at fault', () => {
          for (const field of thisCase.expect.messageNames)
            expect(error.message).toContain(field);
        });

        // .why = the assertion above reaches two field-name fragments; a reviewer at PR sees
        //        those two and not the string a caller actually meets, so every word around
        //        them can drift with the suite green. `helpful-errors` serializes metadata INTO
        //        the message, so ONE snapshot of `.message` is the whole surface
        //        (rule.require.snapshots — the snapshot for review observability, the
        //        assertion above for functional verification; both, never one)
        then('the whole surface a caller meets is snapped', () => {
          expect(error.message).toMatchSnapshot();
        });
      }),
    );
  });
});
