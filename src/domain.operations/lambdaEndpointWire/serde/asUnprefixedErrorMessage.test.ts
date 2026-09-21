import { BadRequestError, ConstraintError } from 'helpful-errors';
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

    when('[t2] message has a BadRequestError prefix, the REAL shape', () => {
      then('strips the prefix, with no emoji present', () => {
        // 🔴 no emoji, because `BadRequestError` declares no static one. a
        //    mimic that added `✋` would assert a shape nobody emits.
        const result = asUnprefixedErrorMessage({
          message: 'BadRequestError: invalid input',
        });
        expect(result).toBe('invalid input');
      });
    });

    when('[t3] message has a MalfunctionError prefix, the REAL shape', () => {
      then('strips the prefix, whichever emoji it carries', () => {
        // 🔴 `MalfunctionError.emoji` is `💥`, never `✋`.
        const result = asUnprefixedErrorMessage({
          message: '💥 MalfunctionError: database connection failed',
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

  given('[case4] the REAL helpful-errors output, never a mimic of it', () => {
    /**
     * 🔴 every other case here hand-writes the string it asserts on, so the
     * suite could stay green against a `helpful-errors` that changed its format
     * — it would assert the regex still matches a shape nobody emits.
     *
     * ⇒ so this case constructs a REAL error and reads its REAL `.message`. it
     *   is the only one here that can fail on a dependency bump, which is why it
     *   earns its place (`rule.require.external-contract-integration-tests`).
     */
    when('[t0] a real ConstraintError is constructed', () => {
      then('its message carries the shape the regex expects', () => {
        const real = new ConstraintError('validation failed: style is invalid');

        // the contract, asserted rather than assumed: the library prefixes.
        expect(real.message).toContain('ConstraintError');
        expect(real.message).not.toBe('validation failed: style is invalid');

        // and the transformer recovers the original from the REAL output.
        expect(asUnprefixedErrorMessage({ message: real.message })).toBe(
          'validation failed: style is invalid',
        );
      });
    });

    when('[t1] a real BadRequestError is constructed', () => {
      then('the same recovery holds across classes', () => {
        const real = new BadRequestError('invalid input');
        expect(asUnprefixedErrorMessage({ message: real.message })).toBe(
          'invalid input',
        );
      });
    });

    when('[t2] a real error whose message holds a colon', () => {
      then('only the prefix is stripped, never the payload colon', () => {
        // the sharpest real case: the regex is `^✋\s+\w+:\s*`, so a message
        // that itself contains `word:` must keep it. a greedier pattern would
        // eat the caller's own text and the mimic cases would never show it.
        const real = new ConstraintError('field: uuid must be a uuid');
        expect(asUnprefixedErrorMessage({ message: real.message })).toBe(
          'field: uuid must be a uuid',
        );
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
