import { given, then, when } from 'test-fns';

import type { LambdaErrorResponseAncient } from './getIsLambdaErrorResponse';
import { getLambdaErrorMetadata } from './getLambdaErrorMetadata';

describe('getLambdaErrorMetadata', () => {
  given('[case1] error response with both details and causeMessage', () => {
    when('[t0] metadata extracted', () => {
      then('returns both fields', () => {
        const errorResponse: LambdaErrorResponseAncient = {
          errorMessage: 'test error',
          errorType: 'TestError',
          details: { foo: 'bar' },
          causeMessage: 'cause error message',
        };
        const result = getLambdaErrorMetadata({ errorResponse });
        expect(result).toEqual({
          details: { foo: 'bar' },
          causeMessage: 'cause error message',
        });
      });
    });
  });

  given('[case2] error response with details only', () => {
    when('[t0] metadata extracted', () => {
      then('returns only details', () => {
        const errorResponse: LambdaErrorResponseAncient = {
          errorMessage: 'test error',
          details: ['issue1', 'issue2'],
        };
        const result = getLambdaErrorMetadata({ errorResponse });
        expect(result).toEqual({
          details: ['issue1', 'issue2'],
        });
      });
    });
  });

  given('[case3] error response with causeMessage only', () => {
    when('[t0] metadata extracted', () => {
      then('returns only causeMessage', () => {
        const errorResponse: LambdaErrorResponseAncient = {
          errorMessage: 'test error',
          causeMessage: 'original cause',
        };
        const result = getLambdaErrorMetadata({ errorResponse });
        expect(result).toEqual({
          causeMessage: 'original cause',
        });
      });
    });
  });

  given('[case4] error response with no optional fields', () => {
    when('[t0] metadata extracted', () => {
      then('returns empty object', () => {
        const errorResponse: LambdaErrorResponseAncient = {
          errorMessage: 'test error',
        };
        const result = getLambdaErrorMetadata({ errorResponse });
        expect(result).toEqual({});
      });
    });
  });
});
