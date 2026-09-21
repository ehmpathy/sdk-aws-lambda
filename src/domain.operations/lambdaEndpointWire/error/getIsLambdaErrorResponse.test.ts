import { given, then, when } from 'test-fns';

import type {
  LambdaEndpointErrorResponseBodyAncient,
  LambdaEndpointErrorResponseBodyContemp,
} from '../../../domain.objects/LambdaEndpointErrorResponseBody';
import { LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP } from '../../../domain.objects/LambdaEndpointErrorResponseBody';
import type {
  LambdaErrorResponseAncient,
  LambdaErrorResponseContemp,
} from './getIsLambdaErrorResponse';
import {
  getIsAncientErrorResponse,
  getIsContempErrorResponse,
} from './getIsLambdaErrorResponse';

/**
 * 🔴 the two wire types are DERIVED from the canonical domain objects, and these
 *    assertions are what keeps them so — a derivation nobody exercises is one
 *    the next author re-hand-declares.
 *
 * ⇒ three claims, at the type gate: the contemp pair is ONE type · the ancient
 *   pair shares every field but two · those two diverge as the wire needs.
 */
describe('the wire types derive from the canonical domain objects', () => {
  given('[case1] the contemp pair', () => {
    when(
      '[t0] a canonical body is used where the wire type is required',
      () => {
        then('they are ONE type — the alias, not a copy', () => {
          const canonical: LambdaEndpointErrorResponseBodyContemp = {
            error: {
              _serde: LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP,
              class: 'ConstraintError',
              message: 'the uuid names no known surfer',
            },
          };

          // assignable BOTH ways. a re-hand-declaration that drops or renames a
          // field breaks one direction or the other at the type gate.
          const wire: LambdaErrorResponseContemp = canonical;
          const back: LambdaEndpointErrorResponseBodyContemp = wire;

          expect(back.error.class).toEqual('ConstraintError');
        });
      },
    );
  });

  given('[case2] the ancient pair, which legitimately DIFFERS', () => {
    when('[t0] a canonical body crosses into the wire type', () => {
      then('every shared field survives the derivation', () => {
        const canonical: LambdaEndpointErrorResponseBodyAncient = {
          errorMessage: 'the uuid names no known surfer',
          errorType: 'BadRequestError',
          causeMessage: 'no row matched',
          details: { uuid: 'abc' },
        };

        // 🔴 THIS is what binds the two. `Omit<Canonical, 'errorType'> & { … }`
        //    means a field added to the canonical shape lands here for free —
        //    where two hand-written declarations would have forked in silence.
        const wire: LambdaErrorResponseAncient = canonical;

        expect(wire.causeMessage).toEqual('no row matched');
        expect(wire.details).toEqual({ uuid: 'abc' });
      });
    });

    when('[t1] the two documented divergences are exercised', () => {
      then('errorType is OPTIONAL and stackTrace is PRESENT', () => {
        // aws's duration-exceeded shape: a message, no type. the canonical type
        // requires `errorType`, so this value is legal ONLY on the wire side —
        // which is the whole reason the two are not one type.
        const awsShaped: LambdaErrorResponseAncient = {
          errorMessage: 'Task timed out',
          stackTrace: ['at handler'],
        };

        expect(awsShaped.errorType).toBeUndefined();
        expect(getIsAncientErrorResponse(awsShaped)).toEqual(true);
      });
    });
  });
});

describe('getIsContempErrorResponse', () => {
  given('[case1] contemp error with _serde discriminator', () => {
    when(
      '[t0] parsed has { error: { _serde: "LambdaEndpointError::contemp" } }',
      () => {
        then('returns true', () => {
          const result = getIsContempErrorResponse({
            error: {
              _serde: 'LambdaEndpointError::contemp',
              class: 'ConstraintError',
              message: 'validation failed',
            },
          });
          expect(result).toBe(true);
        });
      },
    );
  });

  given('[case2] contemp error with optional fields', () => {
    when('[t0] parsed has cause and details', () => {
      then('returns true', () => {
        const result = getIsContempErrorResponse({
          error: {
            _serde: 'LambdaEndpointError::contemp',
            class: 'Error',
            message: 'operation failed',
            cause: 'root cause',
            details: { foo: 'bar' },
          },
        });
        expect(result).toBe(true);
      });
    });
  });

  given('[case3] ancient error response (no _serde)', () => {
    when('[t0] parsed has errorMessage format', () => {
      then('returns false', () => {
        const result = getIsContempErrorResponse({
          errorMessage: 'an error occurred',
          errorType: 'Error',
        });
        expect(result).toBe(false);
      });
    });
  });

  given('[case4] error without _serde discriminator', () => {
    when('[t0] parsed has error but no _serde', () => {
      then('returns false', () => {
        const result = getIsContempErrorResponse({
          error: {
            class: 'Error',
            message: 'absent serde',
          },
        });
        expect(result).toBe(false);
      });
    });
  });

  given('[case5] wrong _serde value', () => {
    when('[t0] parsed has different _serde value', () => {
      then('returns false', () => {
        const result = getIsContempErrorResponse({
          error: {
            _serde: 'SomeOtherType',
            class: 'Error',
            message: 'wrong serde',
          },
        });
        expect(result).toBe(false);
      });
    });
  });

  given('[case6] null parsed value', () => {
    when('[t0] parsed is null', () => {
      then('returns false', () => {
        const result = getIsContempErrorResponse(null);
        expect(result).toBe(false);
      });
    });
  });

  given('[case7] primitive parsed value', () => {
    when('[t0] parsed is a string', () => {
      then('returns false', () => {
        const result = getIsContempErrorResponse('hello');
        expect(result).toBe(false);
      });
    });
  });
});

describe('getIsAncientErrorResponse', () => {
  /**
   * 🔴 this case is AWS's, and a reader who takes the wire predicate for DRIFT
   *    against its stricter run-side peer will delete it.
   *
   * ⚠️ `LambdaErrorResponseAncient` declares `errorType?: string` because a
   *    lambda that exceeds its duration answers with an `errorMessage` and no
   *    type — so a both-fields check refuses a payload this package's own type
   *    calls legal. the labels carry that reason, deliberately.
   */
  given('[case1] an aws-shaped fault — errorMessage with NO errorType', () => {
    when('[t0] the payload carries the message alone', () => {
      then(
        'it IS an ancient error — the wire predicate is loose ON PURPOSE',
        () => {
          // the duration-exceeded shape. `errorType` is optional on this type
          // precisely so this payload matches; a both-fields check would drop it
          // to `getParsedResponse`'s generic fall-through and lose the message.
          const result = getIsAncientErrorResponse({
            errorMessage: 'an error occurred',
          });
          expect(result).toBe(true);
        },
      );
    });
  });

  given('[case2] full ancient error response shape', () => {
    when('[t0] parsed has errorMessage, errorType, and stackTrace', () => {
      then('returns true', () => {
        const result = getIsAncientErrorResponse({
          errorMessage: 'error occurred',
          errorType: 'Error',
          stackTrace: ['at foo', 'at bar'],
        });
        expect(result).toBe(true);
      });
    });
  });

  given('[case3] ancient error with causeMessage and details', () => {
    when('[t0] parsed has optional metadata fields', () => {
      then('returns true', () => {
        const result = getIsAncientErrorResponse({
          errorMessage: 'validation failed',
          errorType: 'BadRequestError',
          causeMessage: 'invalid phone',
          details: { field: 'phone' },
        });
        expect(result).toBe(true);
      });
    });
  });

  given('[case4] regular success response', () => {
    when('[t0] parsed is a normal object without errorMessage', () => {
      then('returns false', () => {
        const result = getIsAncientErrorResponse({ id: '123', name: 'test' });
        expect(result).toBe(false);
      });
    });
  });

  given('[case5] contemp error response', () => {
    when('[t0] parsed has contemp format (no errorMessage)', () => {
      then('returns false', () => {
        const result = getIsAncientErrorResponse({
          error: {
            _serde: 'LambdaEndpointError::contemp',
            class: 'Error',
            message: 'contemp error',
          },
        });
        expect(result).toBe(false);
      });
    });
  });

  given('[case6] null parsed value', () => {
    when('[t0] parsed is null', () => {
      then('returns false', () => {
        const result = getIsAncientErrorResponse(null);
        expect(result).toBe(false);
      });
    });
  });

  given('[case7] primitive parsed value', () => {
    when('[t0] parsed is a string', () => {
      then('returns false', () => {
        const result = getIsAncientErrorResponse('hello');
        expect(result).toBe(false);
      });
    });
  });

  given('[case8] array parsed value', () => {
    when('[t0] parsed is an array', () => {
      then('returns false', () => {
        const result = getIsAncientErrorResponse([1, 2, 3]);
        expect(result).toBe(false);
      });
    });
  });
});
