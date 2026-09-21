import { ConstraintError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import { getIsAncientErrorResponse } from '../../lambdaEndpointWire/error/getIsLambdaErrorResponse';
import { isLambdaEndpointErrorEnvelopeAncient } from '../dialect/isLambdaEndpointErrorEnvelope';
import { asWireFunctionErrorPayload } from './asWireFunctionErrorPayload';

describe('asWireFunctionErrorPayload', () => {
  given('[case1] a real Error thrown by a handler', () => {
    when('[t0] the throw is cast into a wire payload', () => {
      then('the three aws fields are carried, class name intact', () => {
        const payload = asWireFunctionErrorPayload(
          new ConstraintError('the uuid is malformed'),
        );

        expect(payload.errorMessage).toContain('the uuid is malformed');
        expect(payload.errorType).toEqual('ConstraintError');
        expect(payload.stackTrace.length).toBeGreaterThan(0);
      });
    });

    when('[t1] the error carries no stack', () => {
      then('stackTrace is an empty array rather than undefined', () => {
        // `stack` is optional on a real Error, so the read is checked rather
        // than assumed — and the wire shape stays an array either way.
        const stackless = new Error('no stack here');
        // biome-ignore lint/performance/noDelete: the absent-stack case is the subject
        delete (stackless as { stack?: string }).stack;

        expect(asWireFunctionErrorPayload(stackless).stackTrace).toEqual([]);
      });
    });
  });

  /**
   * 🔴 the CROSS-REALM clamp, and it is the whole reason this function
   *    duck-types rather than reaches for `instanceof Error`.
   *
   * the local locus loads the handler through `getOneHandlerFromServerlessYml`
   * and jest runs each module in its own vm context, so the `Error` a handler
   * throws is not this realm's `Error`. an `instanceof` read would miss it —
   * silently, and the payload would degrade rather than throw.
   */
  given('[case2] an error-like value from ANOTHER realm', () => {
    // shaped exactly as a foreign-realm Error arrives: right fields, wrong
    // prototype chain. `instanceof Error` is false for this value.
    const foreign = Object.assign(Object.create(null) as object, {
      message: 'the upstream refused',
      stack: 'MalfunctionError: the upstream refused\n    at handler',
      constructor: { name: 'MalfunctionError' },
    });

    when('[t0] the foreign error is cast', () => {
      then('it is NOT an instanceof Error — the premise of the clamp', () => {
        expect(foreign instanceof Error).toBe(false);
      });

      then(
        'the real class name survives, rather than collapse to Error',
        () => {
          // 🔴 the degradation this guards: an `instanceof` miss would answer
          //    `errorType: 'Error'`, and `getParsedResponse` hydrates from that
          //    field — so a caller fault would come back as a generic one.
          expect(asWireFunctionErrorPayload(foreign).errorType).toEqual(
            'MalfunctionError',
          );
        },
      );

      then('the message is carried without a String() prefix glued on', () => {
        expect(asWireFunctionErrorPayload(foreign).errorMessage).toEqual(
          'the upstream refused',
        );
      });

      then('the stack survives rather than drops', () => {
        expect(
          asWireFunctionErrorPayload(foreign).stackTrace.length,
        ).toBeGreaterThan(0);
      });
    });
  });

  given('[case3] a thrown value that is not error-like at all', () => {
    when('[t0] a bare string is thrown', () => {
      then('it degrades to a stated fallback rather than a throw', () => {
        // a handler may `throw 'oops'`. the wire still needs three fields, so
        // the fallback is explicit rather than a crash inside the serde.
        const payload = asWireFunctionErrorPayload('oops');
        expect(payload).toEqual({
          errorMessage: 'oops',
          errorType: 'Error',
          stackTrace: [],
        });
      });
    });
  });

  /**
   * 🔴 the BOUNDARY-AGREEMENT clamp.
   *
   * this function's output is exactly what `getParsedResponse` classifies on
   * the serialized boundary. so the payload it emits and the predicate that
   * reads it are two halves of one claim, and this file is the only place the
   * two halves are asserted against each other.
   *
   * ⚠️ **and the two detectors DISAGREE on shape**, which is F19/F20:
   *
   * | detector | what it requires |
   * |---|---|
   * | `getIsAncientErrorResponse` (wire) | `'errorMessage' in parsed` — no type check |
   * | `isLambdaEndpointErrorEnvelopeAncient` (run) | both fields, both typed `string` |
   *
   * ⇒ the pair below asserts they AGREE on this function's real output, which
   *   is the property that matters — and the divergence is clamped as a KNOWN
   *   limit in `isLambdaEndpointErrorEnvelope.test.ts`, never here. F22 makes
   *   the CONTEMP narrow exact; this ancient pair is the half that stays a wire
   *   heuristic, so the agreement clamp earns its place.
   */
  given('[case4] the payload as the wire boundary will classify it', () => {
    const payload = asWireFunctionErrorPayload(
      new ConstraintError('the uuid is malformed'),
    );

    when('[t0] both ancient detectors read the same payload', () => {
      then('the wire detector classifies it as an ancient error', () => {
        expect(getIsAncientErrorResponse(payload)).toBe(true);
      });

      then('the stricter run detector agrees', () => {
        // the stricter predicate needs `errorType` to be a typed string. this
        // function always supplies one, so the two boundaries cannot disagree
        // about a payload THIS function produced.
        expect(isLambdaEndpointErrorEnvelopeAncient(payload)).toBe(true);
      });

      then('a SUCCESS output is refused by both — the other direction', () => {
        // without this line the pair above would pass on a predicate that
        // answered `true` for every input.
        const success = { found: true, slug: 'abc' };
        expect(getIsAncientErrorResponse(success)).toBe(false);
        expect(isLambdaEndpointErrorEnvelopeAncient(success)).toBe(false);
      });
    });
  });
});
