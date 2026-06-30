import { given, then, when } from 'test-fns';

import { asUnprefixedErrorMessage } from './asUnprefixedErrorMessage';

describe('asUnprefixedErrorMessage', () => {
  given('[case1] message with helpful-errors prefix', () => {
    when('[t0] message has standard ConstraintError prefix', () => {
      then('strips the prefix', () => {
        const result = asUnprefixedErrorMessage({
          message: '✋ ConstraintError: validation failed: style is invalid',
        });
        expect(result).toBe('validation failed: style is invalid');
      });
    });

    when('[t1] message has bundler-suffixed class name', () => {
      then('strips the prefix with suffix', () => {
        const result = asUnprefixedErrorMessage({
          message: '✋ ConstraintError5: validation failed: style is invalid',
        });
        expect(result).toBe('validation failed: style is invalid');
      });
    });

    when('[t2] message has BadRequestError prefix', () => {
      then('strips the prefix', () => {
        const result = asUnprefixedErrorMessage({
          message: '✋ BadRequestError: invalid input',
        });
        expect(result).toBe('invalid input');
      });
    });

    when('[t3] message has MalfunctionError prefix', () => {
      then('strips the prefix', () => {
        const result = asUnprefixedErrorMessage({
          message: '✋ MalfunctionError: database connection failed',
        });
        expect(result).toBe('database connection failed');
      });
    });
  });

  given('[case2] message without prefix', () => {
    when('[t0] message is plain text', () => {
      then('returns message unchanged', () => {
        const result = asUnprefixedErrorMessage({
          message: 'validation failed: style is invalid',
        });
        expect(result).toBe('validation failed: style is invalid');
      });
    });

    when('[t1] message contains emoji but not prefix pattern', () => {
      then('returns message unchanged', () => {
        const result = asUnprefixedErrorMessage({
          message: '✋ this is not a prefix pattern',
        });
        expect(result).toBe('✋ this is not a prefix pattern');
      });
    });
  });

  given('[case3] edge cases', () => {
    when('[t0] message is empty', () => {
      then('returns empty string', () => {
        const result = asUnprefixedErrorMessage({ message: '' });
        expect(result).toBe('');
      });
    });

    when('[t1] message has nested prefix', () => {
      then('strips only the outermost prefix', () => {
        const result = asUnprefixedErrorMessage({
          message: '✋ ConstraintError: ✋ ConstraintError5: validation failed',
        });
        expect(result).toBe('✋ ConstraintError5: validation failed');
      });
    });
  });
});
