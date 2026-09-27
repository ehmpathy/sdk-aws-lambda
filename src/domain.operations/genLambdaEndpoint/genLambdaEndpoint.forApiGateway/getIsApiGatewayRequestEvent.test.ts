import { given, then, when } from 'test-fns';

import { getIsV1ApiGatewayRequestEvent } from './getIsV1ApiGatewayRequestEvent';
import { getIsV2ApiGatewayRequestEvent } from './getIsV2ApiGatewayRequestEvent';

describe('getIsV1ApiGatewayRequestEvent', () => {
  given('[case1] v1 REST API event', () => {
    const event = {
      httpMethod: 'POST',
      path: '/users',
      body: '{"name":"alice"}',
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      requestContext: {
        requestId: 'abc123',
      },
    };

    when('[t0] tested', () => {
      then('it should return true', () => {
        expect(getIsV1ApiGatewayRequestEvent(event)).toBe(true);
      });
    });
  });

  given('[case2] v2 HTTP API event', () => {
    const event = {
      version: '2.0',
      requestContext: {
        http: {
          method: 'POST',
          path: '/users',
        },
      },
      body: '{"name":"alice"}',
      headers: {},
    };

    when('[t0] tested', () => {
      then('it should return false', () => {
        expect(getIsV1ApiGatewayRequestEvent(event)).toBe(false);
      });
    });
  });

  given('[case3] non-object input', () => {
    when('[t0] tested with null', () => {
      then('it should return false', () => {
        expect(getIsV1ApiGatewayRequestEvent(null)).toBe(false);
      });
    });

    when('[t1] tested with string', () => {
      then('it should return false', () => {
        expect(getIsV1ApiGatewayRequestEvent('not an event')).toBe(false);
      });
    });
  });
});

describe('getIsV2ApiGatewayRequestEvent', () => {
  given('[case1] v2 HTTP API event', () => {
    const event = {
      version: '2.0',
      requestContext: {
        http: {
          method: 'POST',
          path: '/users',
        },
      },
      body: '{"name":"alice"}',
      headers: {},
    };

    when('[t0] tested', () => {
      then('it should return true', () => {
        expect(getIsV2ApiGatewayRequestEvent(event)).toBe(true);
      });
    });
  });

  given('[case2] v1 REST API event', () => {
    const event = {
      httpMethod: 'POST',
      path: '/users',
      body: '{"name":"alice"}',
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      requestContext: {
        requestId: 'abc123',
      },
    };

    when('[t0] tested', () => {
      then('it should return false', () => {
        expect(getIsV2ApiGatewayRequestEvent(event)).toBe(false);
      });
    });
  });

  given('[case3] non-object input', () => {
    when('[t0] tested with null', () => {
      then('it should return false', () => {
        expect(getIsV2ApiGatewayRequestEvent(null)).toBe(false);
      });
    });

    when('[t1] tested with undefined', () => {
      then('it should return false', () => {
        expect(getIsV2ApiGatewayRequestEvent(undefined)).toBe(false);
      });
    });
  });
});
