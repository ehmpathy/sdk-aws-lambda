import { given, then, when } from 'test-fns';

import {
  getIsAncientErrorResponse,
  getIsContempErrorResponse,
} from './getIsLambdaErrorResponse';

describe('getIsContempErrorResponse', () => {
  given('[case1] contemp error with _serde discriminator', () => {
    when('[t0] parsed has { error: { _serde: "LambdaEndpointError::contemp" } }', () => {
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
    });
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
  given('[case1] object with errorMessage', () => {
    when('[t0] parsed has errorMessage property', () => {
      then('returns true', () => {
        const result = getIsAncientErrorResponse({
          errorMessage: 'an error occurred',
        });
        expect(result).toBe(true);
      });
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
