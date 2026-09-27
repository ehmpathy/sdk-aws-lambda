import { getError, MalfunctionError } from 'helpful-errors';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import {
  getValidatedOutput,
  type OutputValidationErrorMetadata,
} from './getValidatedOutput';

/**
 * .what = the TITLE line of a helpful-error — the part before its serialized metadata
 * .why = ⚠️ `error.message` is NOT the title. `helpful-errors` appends the whole metadata
 *        block to it, so `expect(error.message).toContain('balance')` is satisfied by the
 *        `"path": "balance"` inside that JSON and says NOT ONE WORD about the title
 *
 * ⚠️ .measured, by revert = with the title reverted to a bare `'output validation failed'`,
 *        both message assertions in this file stayed GREEN. only once they read the title
 *        alone did they bite. a clamp that cannot fail is a clamp a later reader over-trusts
 *        (rule.require.clamp-edge-cases)
 *
 * .why the title is the half that matters = it is the only part a log line, a stack trace, or
 *        an alarm subject shows without a decode of the metadata. a title that names no path
 *        costs a debug session even though the path is technically present
 */
const asErrorTitle = (input: { error: Error }): string =>
  input.error.message.split('\n')[0] ?? '';

/**
 * .what = the OUTPUT-side primitive's own contract, clamped in its own vocabulary
 * .why = it is the peer of `getValidatedInput`. `forAsk` and `forApiGateway` call it DIRECTLY in
 *        their `logic` — never through `genZodOutputValidationMiddleware`, which no shipped chain
 *        registers — so a regression here is a regression at both borders
 */
describe('getValidatedOutput', () => {
  given('[case1] a response the schema accepts', () => {
    const schema = z.object({ name: z.string(), balance: z.number() });

    when('[t0] the response is validated', () => {
      const result = getValidatedOutput({
        schema,
        response: { name: 'kai', balance: 12 },
      });

      then('the parsed value comes back', () => {
        expect(result).toEqual({ name: 'kai', balance: 12 });
      });
    });
  });

  given('[case2] a response the schema refuses', () => {
    const schema = z.object({ name: z.string(), balance: z.number() });

    when('[t0] the response is validated', () => {
      const error = getError(() =>
        getValidatedOutput({ schema, response: { name: 'kai' } }),
      );

      then('it throws rather than hands back a half-built value', () => {
        expect(error).toBeDefined();
      });

      then('the TITLE names the path — not a bare count of issues', () => {
        // ⚠️ read the TITLE, never `error.message`: see `asErrorTitle`'s note. the metadata
        //    block inside `.message` already holds this path, so an assertion against the whole
        //    string passes under a bare title and proves no guarantee at all
        expect(asErrorTitle({ error })).toContain('balance');
      });

      then('the metadata carries the issue summary', () => {
        const metadata = (
          error as MalfunctionError<OutputValidationErrorMetadata>
        ).metadata;
        expect(metadata.issues).toHaveLength(1);
        expect(metadata.issues[0]?.path).toEqual('balance');
      });

      then(
        'and it carries a HINT that names an act the reader can perform',
        () => {
          const metadata = (
            error as MalfunctionError<OutputValidationErrorMetadata>
          ).metadata;
          expect(metadata.hint).toBeDefined();
          expect(metadata.hint).toContain('new X(');
        },
      );

      /**
       * ⚠️ .why the whole `.message` is SNAPPED beside those three fragments = the fragments are
       *         an ALLOWLIST. each names a field someone already thought of, so together they
       *         can only ever confirm what this round expected — a drift in the serialized
       *         phrasing, or in the hint's own text, keeps all three green and the reviewer
       *         unaware (rule.require.snapshots-deny-volatile-not-allow-expected)
       *
       *         ⇒ the twin `getValidatedInput.test.ts` `[case2]` already snaps `.message` for
       *           exactly this reason, and `genZodBodyValidationMiddleware`'s `[case5]`/`[case6]`
       *           do it at the body border. this file was the one member of that family that
       *           verified by fragments, so the asymmetry sat INSIDE one diff
       *
       * .why a snapshot is safe here = the message holds no timestamp, uuid, or path — it is a
       *      pure function of the schema and the response, both literals above
       */
      then('and the whole surface a handler author meets is snapped', () => {
        expect(error.message).toMatchSnapshot();
      });
    });
  });

  given(
    '[case3] the error CLASS, which must not drift toward the input twin',
    () => {
      const schema = z.object({ name: z.string() });

      when('[t0] the handler returns a value its own schema refuses', () => {
        const error = getError(() =>
          getValidatedOutput({ schema, response: { name: 42 } }),
        );

        then(
          'it is a MalfunctionError — the server is at fault, never the caller',
          () => {
            expect(error).toBeInstanceOf(MalfunctionError);
          },
        );

        // ⚠️ .what this clamp guards, stated as the edit it refuses: a later author who reaches for
        //    `getValidationError.ts` next door as the nearest pattern would throw a
        //    `ConstraintError` here. that inverts the contract — the lambda would SUCCEED with a
        //    BadRequestError body, so a broken handler would read to every caller, every dashboard,
        //    and every alarm as the CALLER's bad request. no extant assertion anywhere caught it
        then(
          'and never a ConstraintError, which would blame the caller',
          () => {
            expect(error.constructor.name).toEqual('MalfunctionError');
          },
        );
      });
    },
  );

  given('[case4] a ROOT-level fault, where zod reports an EMPTY path', () => {
    // .as = the schema wants one type at the root and meets another, so zod's `path` array is
    //       empty and a naive render prints a bare `::`
    //
    // 🔴 .why this given was RENAMED = it read *"the shape a prop-bag return produces"*, which
    //    is false. `[case5]` measures that a prop bag whose fields are correct PARSES, so a
    //    plain object is not the cause of any fault here — the DATA is. this case's real
    //    subject is the root-path render, and it clamps that alone
    const schema = z.string();

    when('[t0] the response is a whole wrong-shaped value', () => {
      const error = getError(() =>
        getValidatedOutput({ schema, response: { uuid: 'abc' } }),
      );

      then(
        'the path renders as the root token, never as a bare empty string',
        () => {
          const metadata = (
            error as MalfunctionError<OutputValidationErrorMetadata>
          ).metadata;
          expect(metadata.issues[0]?.path).toEqual('(root)');
        },
      );

      then('and the TITLE carries that token too', () => {
        expect(asErrorTitle({ error })).toContain('(root)');
      });

      // .why snapped HERE too = a root fault is the one row whose path is EMPTY, so it is the
      //    row a render regression breaks first and the only one where `(root)` can appear at
      //    all. the fragment above pins one token of it; the snapshot shows the whole string
      then('and the whole root-fault surface is snapped', () => {
        expect(error.message).toMatchSnapshot();
      });
    });
  });

  given('[case5] a schema that COERCES — the headline output shape', () => {
    class SurfTrophy {
      constructor(public readonly uuid: string) {}
    }
    const schema = z
      .object({ uuid: z.string() })
      .transform((raw) => new SurfTrophy(raw.uuid));

    when('[t0] the handler hands back the plain shape', () => {
      const result = getValidatedOutput({
        schema,
        response: { uuid: 'trophy-1' },
      });

      // ⚠️ the identity half, and it is NOT redundant with a `toEqual`: a subject that
      //    deep-copied its result — the edit a redaction, a freeze, or a serialize-roundtrip
      //    invites — would satisfy a structural assertion and silently strip the class off every
      //    coerced output position. measured by revert on the INPUT twin, where
      //    `JSON.parse(JSON.stringify(...))` went red and a shallow spread did NOT
      //    (rule.require.clamp-edge-cases)
      then('the coerced instance survives, prototype intact', () => {
        expect(result).toBeInstanceOf(SurfTrophy);
      });

      then('and the fields are what the parse produced', () => {
        expect(result.uuid).toEqual('trophy-1');
      });
    });
  });
});
