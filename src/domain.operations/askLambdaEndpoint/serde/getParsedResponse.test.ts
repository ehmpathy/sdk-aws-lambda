import { BadRequestError, getError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import { LambdaEndpointError } from '../../../domain.objects/LambdaEndpointError';
import { getParsedResponse } from './getParsedResponse';

const toPayload = (obj: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(obj));

describe('getParsedResponse', () => {
  given('[case1] valid response payload', () => {
    when('[t0] parsed', () => {
      const result = getParsedResponse<{ data: string }>({
        payload: toPayload({ data: 'hello' }),
        functionError: undefined,
        service: 'svc-orders',
        function: 'getOrder',
        exid: 'exid:abc123',
      });

      then('it should return parsed response', () => {
        expect(result).toEqual({ data: 'hello' });
      });
    });
  });

  given('[case2] payload is undefined', () => {
    when('[t0] parsed', () => {
      then('it should throw LambdaEndpointError', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: undefined,
            functionError: undefined,
            service: 'svc-orders',
            function: 'getOrder',
            exid: 'exid:abc123',
          }),
        );
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('it should include empty payload message', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: undefined,
            functionError: undefined,
            service: 'svc-orders',
            function: 'getOrder',
            exid: 'exid:abc123',
          }),
        );
        expect(error.message).toContain('empty payload');
      });
    });
  });

  given('[case3] payload is invalid json', () => {
    when('[t0] parsed', () => {
      then('it should throw LambdaEndpointError', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: new TextEncoder().encode('not json'),
            functionError: undefined,
            service: 'svc-orders',
            function: 'getOrder',
            exid: 'exid:abc123',
          }),
        );
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('it should include invalid json message', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: new TextEncoder().encode('not json'),
            functionError: undefined,
            service: 'svc-orders',
            function: 'getOrder',
            exid: 'exid:abc123',
          }),
        );
        expect(error.message).toContain('invalid json');
      });
    });
  });

  given('[case4] payload contains error response', () => {
    when('[t0] parsed with errorMessage', () => {
      then('it should throw LambdaEndpointError', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'something went wrong',
              errorType: 'ValidationError',
              stackTrace: ['at handler', 'at process'],
            }),
            functionError: undefined,
            service: 'svc-orders',
            function: 'getOrder',
            exid: 'exid:abc123',
          }),
        );
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('it should include the error message', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'something went wrong',
              errorType: 'ValidationError',
              stackTrace: ['at handler', 'at process'],
            }),
            functionError: undefined,
            service: 'svc-orders',
            function: 'getOrder',
            exid: 'exid:abc123',
          }),
        );
        expect(error.message).toContain('something went wrong');
      });

      then('it should include errorType in metadata', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'something went wrong',
              errorType: 'ValidationError',
              stackTrace: ['at handler', 'at process'],
            }),
            functionError: undefined,
            service: 'svc-orders',
            function: 'getOrder',
            exid: 'exid:abc123',
          }),
        );
        const lambdaError = error as LambdaEndpointError;
        expect(lambdaError.metadata.errorType).toEqual('ValidationError');
      });

      then('it should include stackTrace in metadata', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'something went wrong',
              errorType: 'ValidationError',
              stackTrace: ['at handler', 'at process'],
            }),
            functionError: undefined,
            service: 'svc-orders',
            function: 'getOrder',
            exid: 'exid:abc123',
          }),
        );
        const lambdaError = error as LambdaEndpointError;
        expect(lambdaError.metadata.stackTrace).toContain('at handler');
      });
    });

    when('[t1] parsed with errorMessage only', () => {
      then('it should throw LambdaEndpointError', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'minimal error',
            }),
            functionError: undefined,
            service: 'svc-orders',
            function: 'getOrder',
            exid: null,
          }),
        );
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('it should handle null exid', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'minimal error',
            }),
            functionError: undefined,
            service: 'svc-orders',
            function: 'getOrder',
            exid: null,
          }),
        );
        const lambdaError = error as LambdaEndpointError;
        expect(lambdaError.metadata.exid).toBeNull();
      });
    });
  });

  given('[case5] complex nested response', () => {
    when('[t0] parsed', () => {
      const result = getParsedResponse<{
        user: { id: string; email: string };
        items: string[];
      }>({
        payload: toPayload({
          user: { id: 'user-123', email: 'test@example.com' },
          items: ['a', 'b', 'c'],
        }),
        functionError: undefined,
        service: 'svc-users',
        function: 'getUser',
        exid: 'exid:xyz',
      });

      then('it should preserve nested structure', () => {
        expect(result.user.id).toEqual('user-123');
        expect(result.items).toEqual(['a', 'b', 'c']);
      });
    });
  });

  given('[case6] BadRequestError response with validation details', () => {
    const parseWithBadRequest = () =>
      getParsedResponse({
        payload: toPayload({
          errorMessage: 'validation failed',
          errorType: 'BadRequestError',
          stackTrace: 'at handler',
          details: {
            issues: [
              {
                path: 'email',
                message: 'invalid email',
                code: 'invalid_string',
              },
            ],
          },
          causeMessage: 'zod validation failed',
        }),
        functionError: undefined,
        service: 'svc-users',
        function: 'createUser',
        exid: 'exid:abc123',
      });

    when('[t0] parsed with errorType BadRequestError', () => {
      then('it should throw BadRequestError', async () => {
        const error = await getError(parseWithBadRequest);
        expect(error).toBeInstanceOf(BadRequestError);
      });

      then('it should include validation details in metadata', async () => {
        const error = (await getError(parseWithBadRequest)) as BadRequestError;
        expect(error.metadata).toHaveProperty('details');
        expect((error.metadata as { details: unknown }).details).toEqual({
          issues: [
            { path: 'email', message: 'invalid email', code: 'invalid_string' },
          ],
        });
      });

      then('it should include causeMessage in metadata', async () => {
        const error = (await getError(parseWithBadRequest)) as BadRequestError;
        expect(
          (error.metadata as { causeMessage: string }).causeMessage,
        ).toEqual('zod validation failed');
      });

      then('it should include service and function in metadata', async () => {
        const error = (await getError(parseWithBadRequest)) as BadRequestError;
        expect((error.metadata as { service: string }).service).toEqual(
          'svc-users',
        );
        expect((error.metadata as { function: string }).function).toEqual(
          'createUser',
        );
      });

      then('it should match snapshot', async () => {
        const error = await getError(parseWithBadRequest);
        expect(error).toMatchSnapshot();
      });
    });
  });

  given('[case7] LambdaEndpointError with details', () => {
    const parseWithDatabaseError = () =>
      getParsedResponse({
        payload: toPayload({
          errorMessage: 'internal error',
          errorType: 'DatabaseError',
          stackTrace: 'at query',
          details: { table: 'users', operation: 'insert' },
          causeMessage: 'connection timeout',
        }),
        functionError: undefined,
        service: 'svc-users',
        function: 'createUser',
        exid: 'exid:xyz789',
      });

    when('[t0] parsed with error details', () => {
      then('it should throw LambdaEndpointError', async () => {
        const error = await getError(parseWithDatabaseError);
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('it should include details in metadata', async () => {
        const error = (await getError(
          parseWithDatabaseError,
        )) as LambdaEndpointError;
        expect(error.metadata.details).toEqual({
          table: 'users',
          operation: 'insert',
        });
      });

      then('it should include causeMessage in metadata', async () => {
        const error = (await getError(
          parseWithDatabaseError,
        )) as LambdaEndpointError;
        expect(error.metadata.causeMessage).toEqual('connection timeout');
      });

      then('it should match snapshot', async () => {
        const error = await getError(parseWithDatabaseError);
        expect(error).toMatchSnapshot();
      });
    });
  });
});
