import { ConstraintError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { asLambdaEndpointDialect } from './asLambdaEndpointDialect';

/**
 * .what = clamps the dialect guard
 * .why = 🔴 the branch reads `if (dialect === 'contemp') … else ancient`, so
 *        absent this guard every non-contemp value — a typo, a stale config,
 *        an `as any` call site — falls to ancient unasserted.
 *
 * 🟡 the peer guard for `at` is the model: a published sdk boundary is
 *    validated at runtime or it is not validated.
 */
describe('asLambdaEndpointDialect', () => {
  given('[case2] a dialect the caller declared', () => {
    when('[t0] it is one this util can send', () => {
      then('contemp passes through', () => {
        expect(asLambdaEndpointDialect({ declared: 'contemp' })).toEqual(
          'contemp',
        );
      });

      then('ancient passes through', () => {
        expect(asLambdaEndpointDialect({ declared: 'ancient' })).toEqual(
          'ancient',
        );
      });
    });

    when('[t1] it is absent', () => {
      // contemp is the default, per rule.require.contemp-contracts-default —
      // and an absent dialect is LEGAL, so it must not reach the refusal
      then('undefined defaults to contemp', () => {
        expect(asLambdaEndpointDialect({ declared: undefined })).toEqual(
          'contemp',
        );
      });

      then('an absent key defaults to contemp', () => {
        expect(asLambdaEndpointDialect({})).toEqual('contemp');
      });

      then('null defaults to contemp', () => {
        expect(asLambdaEndpointDialect({ declared: null })).toEqual('contemp');
      });
    });

    when('[t2] it is not one this util can send', () => {
      // 🔴 absent the guard each of these reaches the endpoint as ANCIENT — a
      //    flat event and an `{ errorMessage, errorType }` envelope, from a
      //    call that asked for neither.
      then('a near-miss typo is refused by name', () => {
        const error = getError(() =>
          asLambdaEndpointDialect({ declared: 'contmep' }),
        );

        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('dialect');
      });

      then('it names BOTH options, so the fix needs no doc read', () => {
        const error = getError(() =>
          asLambdaEndpointDialect({ declared: 'contmep' }),
        );

        const serialized = JSON.stringify(error);
        expect(serialized).toContain('contemp');
        expect(serialized).toContain('ancient');
      });

      then('it reports the value it was given', () => {
        const error = getError(() =>
          asLambdaEndpointDialect({ declared: 'contmep' }),
        );

        // without this the author reads "not one this util can send" and cannot
        // see WHICH value they sent — the whole point of the guard is that the
        // typo is invisible in their own source (rule.require.errors-name-the-fix)
        expect(JSON.stringify(error)).toContain('contmep');

        const serialized = JSON.stringify(error);
        expect({
          class: error.constructor.name,
          messageNamesDialect: error.message.includes('dialect'),
          namesBothOptions:
            serialized.includes('contemp') && serialized.includes('ancient'),
          carriesDeclared: serialized.includes('contmep'),
        }).toMatchSnapshot();
      });

      then('a CASED variant is refused rather than coerced', () => {
        // the peer locus guard refuses `'CLOUD'` for the same reason
        const error = getError(() =>
          asLambdaEndpointDialect({ declared: 'CONTEMP' }),
        );

        expect(error).toBeInstanceOf(ConstraintError);

        // the ECHO is what makes a cased typo visible — a refusal that dropped
        // `declared` would leave the author to re-read source that looks right
        expect({
          class: error.constructor.name,
          carriesDeclared: JSON.stringify(error).includes('CONTEMP'),
        }).toMatchSnapshot();
      });

      then('a non-string reaches the refusal rather than the branch', () => {
        // a js consumer or an `as any` call site can send any shape at all. the
        // branch it used to hit compared with `===`, so an object fell to
        // ancient exactly as a typo did.
        const error = getError(() =>
          asLambdaEndpointDialect({ declared: { payload: 'contemp' } }),
        );

        expect(error).toBeInstanceOf(ConstraintError);

        // 🟡 the object must SERIALIZE into the metadata, never render as
        //    `[object Object]` — which is what an author would otherwise read
        expect({
          class: error.constructor.name,
          carriesDeclared: JSON.stringify(error).includes('payload'),
          notStringCoerced: !JSON.stringify(error).includes('[object Object]'),
        }).toMatchSnapshot();
      });
    });
  });
});
