import { ConstraintError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP } from '../../../domain.objects/LambdaEndpointErrorResponseBody';
import { asLambdaEndpointOutput } from './asLambdaEndpointOutput';

/**
 * .what = the unit clamp on the success-side narrow
 * .why = 🔴 this narrow's whole job is to REFUSE an envelope, and where it fails
 *        to recognize one it does not throw — it returns the envelope typed as
 *        the handler's output, so the author reads `res.someField` and gets
 *        `undefined` with no error anywhere.
 *
 * ⇒ so BOTH dialect arms are clamped here, explicitly.
 */
describe('asLambdaEndpointOutput', () => {
  given('[case1] the endpoint answered with the handler output', () => {
    when('[t0] the output is narrowed', () => {
      then('it is handed back unchanged', () => {
        const output = { scheduledAt: '2026-09-03T14:00:00.000Z', found: true };

        expect(asLambdaEndpointOutput(output)).toEqual(output);
      });

      then('a field read compiles and reads through', () => {
        // the whole point of the narrow — a union refuses this without it
        expect(asLambdaEndpointOutput({ found: true }).found).toEqual(true);
      });
    });

    when('[t1] the output merely resembles an envelope', () => {
      then('a bare `error` key is not enough to be refused', () => {
        // 🔴 a handler may legitimately RETURN a field named `error`. only the
        //    `_serde` tag marks a real contemp envelope, so this must pass through
        const output = { error: 'the surfer wiped out' };

        expect(asLambdaEndpointOutput(output)).toEqual(output);
      });

      then('a partial ancient pair is not enough either', () => {
        // ancient needs BOTH errorMessage and errorType, as strings
        const output = { errorMessage: 'a message, and no type beside it' };

        expect(asLambdaEndpointOutput(output)).toEqual(output);
      });
    });
  });

  given('[case2] the endpoint answered with a CONTEMP envelope', () => {
    // 🟡 typed `unknown` for the same type fact [case3] records below: with the
    //    real `_serde` constant (a literal type, not a widened string) this shape
    //    matches `LambdaEndpointErrorEnvelope<'contemp'>` exactly, so `Exclude`
    //    subtracts it and the return type collapses to `never` — correct, and it
    //    defeats `getError`'s sync/async overload pick.
    const envelope: unknown = {
      error: {
        _serde: LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP,
        class: 'ConstraintError',
        message: 'the uuid names no known surfer',
      },
    };

    when('[t0] the envelope is narrowed as an output', () => {
      then('it throws rather than hand back an envelope', () => {
        const error = getError(() => asLambdaEndpointOutput(envelope));

        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('never an output');

        expect({
          class: error.constructor.name,
          messageNamesNeverOutput: error.message.includes('never an output'),
        }).toMatchSnapshot();
      });

      then('the error names the fix', () => {
        const error = getError(() => asLambdaEndpointOutput(envelope));

        // rule.require.errors-name-the-fix — the author needs the other narrow
        expect(error.message).toContain('asLambdaEndpointErrorEnvelope');
      });
    });
  });

  /**
   * 🔴 [case3] — the arm `advertisedExamples` never reached.
   *
   * a miss here is SILENT: the narrow would return the envelope typed as the
   * handler's output, so every field read yields `undefined` and no error is
   * raised anywhere in the stack.
   */
  given('[case3] the endpoint answered with an ANCIENT envelope', () => {
    when('[t0] the envelope is narrowed as an output', () => {
      // the ancient wire carries no tag — the flat string pair IS the signal
      //
      // 🟡 it is typed `unknown` on purpose, and the reason is a real type fact:
      //    as a literal, this shape matches `LambdaEndpointErrorEnvelope<'ancient'>`
      //    exactly, so `Exclude` subtracts it and the return type collapses to
      //    `never` — which is CORRECT (the call always throws) and defeats
      //    `getError`'s sync/async overload pick. `unknown` is also what a real
      //    consumer holds, since the value arrives off a run boundary.
      const envelope: unknown = {
        errorMessage: 'the uuid names no known surfer',
        errorType: 'BadRequestError',
      };

      then('it throws, exactly as the contemp arm does', () => {
        const error = getError(() => asLambdaEndpointOutput(envelope));

        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('never an output');

        expect({
          class: error.constructor.name,
          messageNamesNeverOutput: error.message.includes('never an output'),
        }).toMatchSnapshot();
      });
    });

    when('[t1] the pair is present but not of strings', () => {
      then(
        'it is treated as an output, since the wire never sends that',
        () => {
          const output = { errorMessage: 404, errorType: 500 };

          expect(asLambdaEndpointOutput(output)).toEqual(output);
        },
      );
    });
  });

  given('[case4] the endpoint answered with a non-object', () => {
    when('[t0] a void handler yields undefined', () => {
      then('it passes through — undefined is a legal referenced answer', () => {
        // define.lambda-endpoint-run-boundary: the referenced boundary is
        // HOST-faithful, so a void handler answers `undefined` rather than null
        expect(asLambdaEndpointOutput(undefined)).toEqual(undefined);
      });
    });

    when('[t1] the wire answered null', () => {
      then('it passes through', () => {
        expect(asLambdaEndpointOutput(null)).toEqual(null);
      });
    });

    when('[t2] the handler returned a primitive', () => {
      then('it passes through', () => {
        expect(asLambdaEndpointOutput('a bare string')).toEqual(
          'a bare string',
        );
        expect(asLambdaEndpointOutput(42)).toEqual(42);
      });
    });
  });
});
