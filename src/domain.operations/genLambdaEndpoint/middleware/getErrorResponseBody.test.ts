import { BadRequestError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import {
  getErrorResponseBodyAncient,
  getErrorResponseBodyContemp,
} from './getErrorResponseBody';

describe('getErrorResponseBodyAncient', () => {
  given('[case1] error with metadata and cause', () => {
    when('[t0] body is constructed', () => {
      then('includes all fields', () => {
        const cause = new Error('original error');
        const error = new BadRequestError('validation failed', {
          metadata: { field: 'email', issue: 'invalid' },
        });
        (error as any).cause = cause;

        const result = getErrorResponseBodyAncient({
          error,
          errorType: 'BadRequestError',
        });

        expect(result.errorType).toEqual('BadRequestError');
        expect(result.causeMessage).toEqual('original error');
        expect(result.errorMessage).toContain('validation failed');
        expect(result.details).toEqual({
          metadata: { field: 'email', issue: 'invalid' },
        });
      });

      then('snapshot for contract visibility', () => {
        const cause = new Error('original error');
        const error = new BadRequestError('validation failed', {
          metadata: { field: 'email', issue: 'invalid' },
        });
        (error as any).cause = cause;

        const result = getErrorResponseBodyAncient({
          error,
          errorType: 'BadRequestError',
        });

        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case2] error with metadata only', () => {
    when('[t0] body is constructed', () => {
      then('includes details but not causeMessage', () => {
        const error = new BadRequestError('validation failed', {
          metadata: { issues: ['a', 'b'] },
        });

        const result = getErrorResponseBodyAncient({
          error,
          errorType: 'BadRequestError',
        });

        expect(result.errorType).toEqual('BadRequestError');
        expect(result.causeMessage).toBeUndefined();
        expect(result.errorMessage).toContain('validation failed');
        expect(result.details).toEqual({ metadata: { issues: ['a', 'b'] } });
      });
    });
  });

  given('[case3] error with cause only', () => {
    when('[t0] body is constructed', () => {
      then('includes causeMessage but not details', () => {
        const cause = new Error('the cause');
        const error = new Error('main error');
        (error as any).cause = cause;

        const result = getErrorResponseBodyAncient({
          error,
          errorType: 'TestError',
        });

        expect(result).toEqual({
          errorMessage: 'main error',
          errorType: 'TestError',
          causeMessage: 'the cause',
        });
      });
    });
  });

  given('[case4] plain error', () => {
    when('[t0] body is constructed', () => {
      then('includes only message and type', () => {
        const error = new Error('simple error');

        const result = getErrorResponseBodyAncient({
          error,
          errorType: 'Error',
        });

        expect(result).toEqual({
          errorMessage: 'simple error',
          errorType: 'Error',
        });
      });
    });
  });
});

describe('getErrorResponseBodyContemp', () => {
  given('[case1] error with metadata and cause', () => {
    when('[t0] body is constructed', () => {
      then('includes all fields nested under error with _serde tag', () => {
        const cause = new Error('original error');
        const error = new BadRequestError('validation failed', {
          metadata: { field: 'email', issue: 'invalid' },
        });
        (error as any).cause = cause;

        const result = getErrorResponseBodyContemp({
          error,
          errorClass: 'ConstraintError',
        });

        expect(result.error._serde).toEqual('LambdaEndpointError::contemp');
        expect(result.error.class).toEqual('ConstraintError');
        expect(result.error.cause).toEqual('original error');
        expect(result.error.message).toContain('validation failed');
        expect(result.error.details).toEqual({
          metadata: { field: 'email', issue: 'invalid' },
        });
      });

      then('snapshot for contract visibility', () => {
        const cause = new Error('original error');
        const error = new BadRequestError('validation failed', {
          metadata: { field: 'email', issue: 'invalid' },
        });
        (error as any).cause = cause;

        const result = getErrorResponseBodyContemp({
          error,
          errorClass: 'ConstraintError',
        });

        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case2] error with metadata only', () => {
    when('[t0] body is constructed', () => {
      then('includes details but not cause', () => {
        const error = new BadRequestError('validation failed', {
          metadata: { issues: ['a', 'b'] },
        });

        const result = getErrorResponseBodyContemp({
          error,
          errorClass: 'ConstraintError',
        });

        expect(result.error._serde).toEqual('LambdaEndpointError::contemp');
        expect(result.error.class).toEqual('ConstraintError');
        expect(result.error.cause).toBeUndefined();
        expect(result.error.message).toContain('validation failed');
        expect(result.error.details).toEqual({
          metadata: { issues: ['a', 'b'] },
        });
      });
    });
  });

  given('[case3] error with cause only', () => {
    when('[t0] body is constructed', () => {
      then('includes cause but not details', () => {
        const cause = new Error('the cause');
        const error = new Error('main error');
        (error as any).cause = cause;

        const result = getErrorResponseBodyContemp({
          error,
          errorClass: 'TestError',
        });

        expect(result).toEqual({
          error: {
            _serde: 'LambdaEndpointError::contemp',
            class: 'TestError',
            message: 'main error',
            cause: 'the cause',
          },
        });
      });
    });
  });

  given('[case4] plain error', () => {
    when('[t0] body is constructed', () => {
      then('includes only _serde, class and message', () => {
        const error = new Error('simple error');

        const result = getErrorResponseBodyContemp({
          error,
          errorClass: 'Error',
        });

        expect(result).toEqual({
          error: {
            _serde: 'LambdaEndpointError::contemp',
            class: 'Error',
            message: 'simple error',
          },
        });
      });

      then('snapshot for contract visibility', () => {
        const error = new Error('simple error');

        const result = getErrorResponseBodyContemp({
          error,
          errorClass: 'Error',
        });

        expect(result).toMatchSnapshot();
      });
    });
  });
});
