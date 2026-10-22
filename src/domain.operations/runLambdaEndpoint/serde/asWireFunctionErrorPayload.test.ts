import { ConstraintError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import { getIsAncientErrorResponse } from '../../lambdaEndpointWire/error/getIsLambdaErrorResponse';
import { isLambdaEndpointErrorEnvelopeAncient } from '../dialect/isLambdaEndpointErrorEnvelope';
import { asWireFunctionErrorPayload } from './asWireFunctionErrorPayload';

describe('asWireFunctionErrorPayload', () => {
  given('[case1] a real Error thrown by a handler', () => {
    when('[t0] the throw is cast into a wire payload', () => {
      then('the three aws fields are carried, labelled by .name', () => {
        // a named ConstraintError — `genLambdaEndpoint` names every throw that
        // escapes it, so this is the shape that reaches the serde in practice
        const error = new ConstraintError('the uuid is malformed');
        Object.defineProperty(error, 'name', {
          value: 'ConstraintError',
          enumerable: false,
          writable: true,
          configurable: true,
        });
        const payload = asWireFunctionErrorPayload(error);

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
      name: 'MalfunctionError',
    });

    when('[t0] the foreign error is cast', () => {
      then('it is NOT an instanceof Error — the premise of the clamp', () => {
        expect(foreign instanceof Error).toBe(false);
      });

      then(
        'its .name survives across the realm, rather than collapse to a typeof',
        () => {
          // 🔴 the degradation this guards: an `instanceof` miss would answer
          //    `errorType: 'object'`, and `getParsedResponse` hydrates from that
          //    field — so a named fault would come back as a generic one.
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

    when('[t1] a foreign helpful-errors class that never set .name', () => {
      then('it reads the inherited Error, exactly as the cloud does', () => {
        // a real foreign `ConstraintError` on helpful-errors 1.7.3: `.name` is the inherited
        // 'Error' and the class lives only on `constructor` — which the runtime never reads
        const foreignUnnamed = Object.assign(Object.create(null) as object, {
          message: 'the uuid is malformed',
          stack: 'Error: the uuid is malformed\n    at handler',
          name: 'Error',
          constructor: { name: 'ConstraintError' },
        });
        expect(asWireFunctionErrorPayload(foreignUnnamed).errorType).toEqual(
          'Error',
        );
      });
    });
  });

  given('[case3] a thrown value that is not error-like at all', () => {
    when('[t0] a bare string is thrown', () => {
      then('it is labelled by its typeof, as the aws runtime labels it', () => {
        // a handler may `throw 'oops'`. the runtime's `toRapidResponse` answers
        // `errorType: typeof error` for a non-error, so the local cast does too.
        const payload = asWireFunctionErrorPayload('oops');
        expect(payload).toEqual({
          errorMessage: 'oops',
          errorType: 'string',
          stackTrace: [],
        });
      });
    });

    when('[t1] each other non-error kind is thrown', () => {
      then('each is labelled by its typeof, its message by String()', () => {
        const thrown = [
          404,
          false,
          null,
          undefined,
          10n,
          Symbol('quota'),
          function quota() {},
        ];
        const rows = thrown.map((value) => ({
          value: String(value),
          ...asWireFunctionErrorPayload(value),
        }));
        expect(rows.map((row) => row.errorType)).toEqual([
          'number',
          'boolean',
          'object', // `typeof null`, as the runtime writes it
          'undefined',
          'bigint',
          'symbol',
          'function',
        ]);
        expect(rows).toMatchSnapshot();
      });
    });

    when('[t2] a plain object is thrown', () => {
      then('its message is lost to String(), exactly as on the cloud', () => {
        // the documented loss: a bag carries no cause the runtime can print
        expect(asWireFunctionErrorPayload({ code: 500 })).toEqual({
          errorMessage: '[object Object]',
          errorType: 'object',
          stackTrace: [],
        });
      });
    });
  });

  /**
   * 🔴 the LOCUS-AGREEMENT clamp (sdk-aws-lambda#73).
   *
   * the aws runtime labels a throw by `.name`. a cast that read the class
   * instead labelled a helpful-errors `ConstraintError` — `.name` inherited as
   * `'Error'` — as a caller fault locally while the cloud labelled it a server
   * fault, so the local gate stayed green over a red prod.
   */
  given('[case5] an error whose .name differs from its class name', () => {
    when('[t0] the .name was set by the thrower', () => {
      then('errorType is the .name, never the class', () => {
        const error = new Error('Could not load credentials');
        error.name = 'CredentialsProviderError';
        expect(asWireFunctionErrorPayload(error).errorType).toEqual(
          'CredentialsProviderError',
        );
      });
    });

    when('[t1] the class never set a .name (helpful-errors 1.7.3)', () => {
      then(
        'errorType is the inherited Error, exactly as the cloud reads',
        () => {
          const error = new ConstraintError('the uuid is malformed');
          expect(error.name).toEqual('Error'); // the premise of the clamp
          expect(asWireFunctionErrorPayload(error).errorType).toEqual('Error');
        },
      );
    });

    when('[t2] an error-like value carries no string .name', () => {
      then('errorType is its typeof, as the runtime answers', () => {
        // the runtime's `_isError` needs a string `.name`; without it, `toRapidResponse`
        // falls to `typeof error`
        const nameless = { message: 'no name here', stack: 'at handler' };
        expect(asWireFunctionErrorPayload(nameless).errorType).toEqual(
          'object',
        );
      });
    });

    when('[t3] an error-like bag carries a .name but no stack', () => {
      then('errorType is its typeof, as the runtime answers', () => {
        // `_isError` needs a string `.stack` too; a `{ name, message }` bag is `'object'` on the cloud
        const bag = {
          name: 'ConstraintError',
          message: 'the uuid is malformed',
        };
        expect(asWireFunctionErrorPayload(bag).errorType).toEqual('object');
      });
    });

    when('[t4] a function carries a .message and a .stack', () => {
      then('errorType is its typeof, as the runtime answers', () => {
        // `_isError` needs `typeof error === 'object'`; a function is `'function'` on the cloud
        const fault = Object.assign(() => undefined, {
          message: 'a function fault',
          stack: 'at handler',
        });
        expect(asWireFunctionErrorPayload(fault).errorType).toEqual('function');
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
