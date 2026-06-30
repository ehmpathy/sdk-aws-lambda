import { getError, HelpfulError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import { asLambdaEndpoint } from '../domain.operations/asLambdaEndpoint/asLambdaEndpoint';
import { LambdaEndpointError } from './LambdaEndpointError';

const exampleEndpoint = asLambdaEndpoint({
  service: 'svc-orders',
  access: 'prep',
  function: 'getOrderByUuid',
});

describe('LambdaEndpointError', () => {
  given('[case1] error is constructed with full metadata', () => {
    const error = new LambdaEndpointError('lambda invocation failed', {
      endpoint: exampleEndpoint,
      exid: 'exid:abc123',
      errorType: 'ValidationError',
      stackTrace: 'Error: validation failed\n  at handler...',
    });

    when('[t0] error is thrown', () => {
      then('it should be instanceof HelpfulError', () => {
        expect(error).toBeInstanceOf(HelpfulError);
      });

      then('it should be instanceof LambdaEndpointError', () => {
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('it should have correct code.http', () => {
        expect(error.code?.http).toEqual(502);
      });

      then('it should have correct code.slug', () => {
        expect(error.code?.slug).toEqual('LAMBDA_ENDPOINT_ERROR');
      });

      then('it should include endpoint service in metadata', () => {
        expect(error.metadata.endpoint.service).toEqual('svc-orders');
      });

      then('it should include endpoint function in metadata', () => {
        expect(error.metadata.endpoint.function).toEqual('getOrderByUuid');
      });

      then('it should include exid in metadata', () => {
        expect(error.metadata.exid).toEqual('exid:abc123');
      });

      then('it should include errorType in metadata', () => {
        expect(error.metadata.errorType).toEqual('ValidationError');
      });

      then('it should include message content', () => {
        expect(error.message).toContain('lambda invocation failed');
      });
    });
  });

  given('[case2] error is constructed with null exid', () => {
    const error = new LambdaEndpointError('lambda invocation failed', {
      endpoint: exampleEndpoint,
      exid: null,
    });

    when('[t0] error is inspected', () => {
      then('exid should be null', () => {
        expect(error.metadata.exid).toBeNull();
      });
    });
  });

  given('[case3] error message includes metadata', () => {
    const error = new LambdaEndpointError('lambda invocation failed', {
      endpoint: exampleEndpoint,
      exid: 'exid:abc123',
    });

    when('[t0] error is inspected', () => {
      then('message should include the original text', () => {
        expect(error.message).toContain('lambda invocation failed');
      });

      then('message should include metadata details', () => {
        expect(error.message).toContain('svc-orders');
      });
    });
  });

  given('[case4] error is thrown and caught', () => {
    when('[t0] error is caught via getError', () => {
      const thrownError = getError(() => {
        throw new LambdaEndpointError('test error', {
          endpoint: asLambdaEndpoint({
            service: 'svc-test',
            access: 'prep',
            function: 'testFn',
          }),
          exid: null,
        });
      });

      then('it should be catchable', () => {
        expect(thrownError).toBeInstanceOf(LambdaEndpointError);
      });
    });
  });

  given('[case5] error has name property', () => {
    const error = new LambdaEndpointError('lambda invocation failed', {
      endpoint: exampleEndpoint,
      exid: 'exid:abc123',
    });

    when('[t0] error.name is accessed', () => {
      then('it should be LambdaEndpointError', () => {
        expect(error.name).toEqual('LambdaEndpointError');
      });
    });
  });

  given('[case6] error serializes to json', () => {
    const error = new LambdaEndpointError('lambda invocation failed', {
      endpoint: exampleEndpoint,
      exid: 'exid:abc123',
    });

    when('[t0] error is serialized via JSON.stringify', () => {
      const jsonString = JSON.stringify(error);
      const json = JSON.parse(jsonString);

      then('it should have message property', () => {
        expect(json.message).toContain('lambda invocation failed');
      });

      then('it should have code property', () => {
        expect(json.code).toEqual({
          http: 502,
          slug: 'LAMBDA_ENDPOINT_ERROR',
        });
      });
    });
  });
});
