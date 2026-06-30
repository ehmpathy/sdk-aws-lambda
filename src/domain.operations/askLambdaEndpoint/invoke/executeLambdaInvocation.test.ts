/**
 * .what = unit tests for executeLambdaInvocation
 * .why = verifies error wrap and invocation behavior
 */
import type { LambdaClient } from '@aws-sdk/client-lambda';
import { getError, given, then, when } from 'test-fns';

import { LambdaEndpointError } from '../../../domain.objects/LambdaEndpointError';
import { asLambdaEndpoint } from '../../asLambdaEndpoint/asLambdaEndpoint';
import { executeLambdaInvocation } from './executeLambdaInvocation';

describe('executeLambdaInvocation', () => {
  given('[case1] sdkLambdaInvoke throws an error', () => {
    when('[t0] network error occurs', () => {
      then('error is wrapped with endpoint context', async () => {
        // arrange
        const networkError = new Error('network timeout after 30000ms');
        networkError.name = 'TimeoutError';

        const mockSdkLambda = {
          send: jest.fn().mockRejectedValue(networkError),
        } as unknown as LambdaClient;

        // act
        const error = await getError(async () =>
          executeLambdaInvocation(
            {
              endpoint: asLambdaEndpoint({
                service: 'svc-user',
                access: 'prep',
                function: 'getUser',
              }),
              payload: { userId: 'user-123' },
              exid: 'test-exid-123',
            },
            { sdkLambda: mockSdkLambda, log: null },
          ),
        );

        // assert
        expect(error).toBeInstanceOf(LambdaEndpointError);
        expect(error.message).toContain('lambda invocation threw');
        expect(error.message).toContain('network timeout');

        // verify error metadata includes endpoint context
        const lambdaError = error as LambdaEndpointError;
        expect(lambdaError.metadata.endpoint).toMatchObject({
          service: 'svc-user',
          access: 'prep',
          function: 'getUser',
          slug: 'svc-user-prep-getUser',
        });
        expect(lambdaError.metadata.exid).toEqual('test-exid-123');

        // verify original error is preserved as cause
        expect(lambdaError.cause).toBe(networkError);
      });

      then('error matches snapshot', async () => {
        // arrange
        const networkError = new Error('connection refused');
        const mockSdkLambda = {
          send: jest.fn().mockRejectedValue(networkError),
        } as unknown as LambdaClient;

        // act
        const error = await getError(async () =>
          executeLambdaInvocation(
            {
              endpoint: asLambdaEndpoint({
                service: 'svc-invoice',
                access: 'prep',
                function: 'createInvoice',
              }),
              payload: { customerId: 'cust-456' },
              exid: 'snapshot-exid',
            },
            { sdkLambda: mockSdkLambda, log: null },
          ),
        );

        // assert
        expect(error).toBeInstanceOf(LambdaEndpointError);
        // mask exid in snapshot since it's a test value
        const lambdaError = error as LambdaEndpointError;
        // filter out undefined values and convert cause to string for valid JSON snapshot
        const cleanMetadata = Object.fromEntries(
          Object.entries({ ...lambdaError.metadata, exid: '[masked]' }).filter(
            ([, v]) => v !== undefined,
          ),
        );
        expect({
          message: lambdaError.message,
          metadata: cleanMetadata,
          causeMessage: (lambdaError.cause as Error)?.message,
        }).toMatchSnapshot();
      });
    });

    when('[t1] sdk throws non-Error value', () => {
      then('non-Error value is rethrown directly', async () => {
        // arrange: sdk throws a string (unexpected but possible)
        const mockSdkLambda = {
          send: jest.fn().mockRejectedValue('unexpected string error'),
        } as unknown as LambdaClient;

        // act
        const error = await getError(async () =>
          executeLambdaInvocation(
            {
              endpoint: asLambdaEndpoint({
                service: 'svc-test',
                access: 'prep',
                function: 'fn',
              }),
              payload: {},
              exid: 'test-exid',
            },
            { sdkLambda: mockSdkLambda, log: null },
          ),
        );

        // assert: non-Error values are rethrown as-is
        expect(error).toBe('unexpected string error');
      });
    });
  });

  given('[case2] sdkLambdaInvoke returns non-200 status', () => {
    when('[t0] lambda returns 429 (throttled)', () => {
      then('error includes status code hint', async () => {
        // arrange
        const mockSdkLambda = {
          send: jest.fn().mockResolvedValue({
            StatusCode: 429,
            Payload: Buffer.from(''),
          }),
        } as unknown as LambdaClient;

        // act
        const error = await getError(async () =>
          executeLambdaInvocation(
            {
              endpoint: asLambdaEndpoint({
                service: 'svc-data',
                access: 'prep',
                function: 'getData',
              }),
              payload: { key: 'value' },
              exid: 'throttle-exid',
            },
            { sdkLambda: mockSdkLambda, log: null },
          ),
        );

        // assert
        expect(error).toBeInstanceOf(LambdaEndpointError);
        expect(error.message).toContain('lambda invocation failed');
        expect((error as LambdaEndpointError).metadata).toMatchObject({
          statusCode: 429,
        });
      });
    });
  });
});
