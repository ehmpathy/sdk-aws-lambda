import {
  BadRequestError,
  ConstraintError,
  HelpfulError,
  UnexpectedCodePathError,
} from 'helpful-errors';
import { given, then, when } from 'test-fns';

import { getIsConstraintError } from './getIsConstraintError';

describe('getIsConstraintError', () => {
  given('[case1] error is BadRequestError instance', () => {
    when('[t0] checked', () => {
      const error = new BadRequestError('bad input');
      const result = getIsConstraintError({ error });

      then('it should return true', () => {
        expect(result).toBe(true);
      });
    });
  });

  given('[case2] error is ConstraintError instance', () => {
    when('[t0] checked', () => {
      const error = new ConstraintError('constraint violated');
      const result = getIsConstraintError({ error });

      then('it should return true', () => {
        expect(result).toBe(true);
      });
    });
  });

  given('[case3] error is plain Error', () => {
    when('[t0] checked', () => {
      const error = new Error('plain error');
      const result = getIsConstraintError({ error });

      then('it should return false', () => {
        expect(result).toBe(false);
      });
    });
  });

  given('[case4] error is UnexpectedCodePathError', () => {
    when('[t0] checked', () => {
      const error = new UnexpectedCodePathError('unexpected');
      const result = getIsConstraintError({ error });

      then('it should return false', () => {
        expect(result).toBe(false);
      });
    });
  });

  given(
    '[case5] error is HelpfulError without BadRequestError ancestry',
    () => {
      when('[t0] checked', () => {
        const error = new HelpfulError('helpful but not bad request');
        const result = getIsConstraintError({ error });

        then('it should return false', () => {
          expect(result).toBe(false);
        });
      });
    },
  );

  given('[case6] error has name "BadRequestError" but is not instance', () => {
    when('[t0] checked', () => {
      const error = new Error('fake');
      error.name = 'BadRequestError';
      const result = getIsConstraintError({ error });

      then('it should return true (name check)', () => {
        expect(result).toBe(true);
      });
    });
  });

  given('[case7] error has name "ConstraintError" but is not instance', () => {
    when('[t0] checked', () => {
      const error = new Error('fake');
      error.name = 'ConstraintError';
      const result = getIsConstraintError({ error });

      then('it should return true (name check)', () => {
        expect(result).toBe(true);
      });
    });
  });

  given('[case8] input is not an Error', () => {
    when('[t0] checked with string', () => {
      const result = getIsConstraintError({ error: 'not an error' });

      then('it should return false', () => {
        expect(result).toBe(false);
      });
    });

    when('[t1] checked with null', () => {
      const result = getIsConstraintError({ error: null });

      then('it should return false', () => {
        expect(result).toBe(false);
      });
    });

    when('[t2] checked with object', () => {
      const result = getIsConstraintError({
        error: { message: 'fake error' },
      });

      then('it should return false', () => {
        expect(result).toBe(false);
      });
    });
  });

  given('[case9] error extends BadRequestError', () => {
    class CustomBadRequestError extends BadRequestError {}

    when('[t0] checked', () => {
      const error = new CustomBadRequestError('custom bad request');
      const result = getIsConstraintError({ error });

      then('it should return true', () => {
        expect(result).toBe(true);
      });
    });
  });
});
