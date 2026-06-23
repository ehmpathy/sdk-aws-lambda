import { given, then, when } from 'test-fns';

import { getIsWrappedPayload } from './getIsWrappedPayload';

describe('getIsWrappedPayload', () => {
  given('[case1] valid wrapped payload with exid', () => {
    const payload = {
      event: { message: 'hello' },
      trail: { exid: 'exid:from-caller' },
    };

    when('[t0] checked', () => {
      then('returns true', () => {
        expect(getIsWrappedPayload(payload)).toBe(true);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case2] valid wrapped payload without exid', () => {
    const payload = {
      event: { message: 'hello' },
      trail: {},
    };

    when('[t0] checked', () => {
      then('returns true', () => {
        expect(getIsWrappedPayload(payload)).toBe(true);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case3] raw payload (no trail property)', () => {
    const payload = { message: 'hello' };

    when('[t0] checked', () => {
      then('returns false', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case4] payload with trail = null', () => {
    const payload = { event: { message: 'hello' }, trail: null };

    when('[t0] checked', () => {
      then('returns false (null is not valid trail)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case5] payload with trail = string (user data collision)', () => {
    const payload = { trail: 'mountain path', location: 'alps' };

    when('[t0] checked', () => {
      then('returns false (trail is string, not object)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case6] payload with more than 2 keys', () => {
    const payload = {
      event: { message: 'hello' },
      trail: { exid: 'exid:abc' },
      extra: 'field',
    };

    when('[t0] checked', () => {
      then('returns false (must have exactly 2 keys)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case7] payload with only trail key (no event)', () => {
    const payload = { trail: { exid: 'exid:abc' } };

    when('[t0] checked', () => {
      then('returns false (must have event key)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case8] payload with only event key (no trail)', () => {
    const payload = { event: { message: 'hello' } };

    when('[t0] checked', () => {
      then('returns false (must have trail key)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case9] payload with trail.exid = number (invalid type)', () => {
    const payload = {
      event: { message: 'hello' },
      trail: { exid: 12345 },
    };

    when('[t0] checked', () => {
      then('returns false (exid must be string if present)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case10] SQS event (Records array)', () => {
    const payload = {
      Records: [
        {
          messageId: 'msg-123',
          body: '{"data": "test"}',
          eventSource: 'aws:sqs',
        },
      ],
    };

    when('[t0] checked', () => {
      then('returns false (not wrapped format)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case11] API Gateway v1 event', () => {
    const payload = {
      httpMethod: 'POST',
      path: '/api/test',
      body: '{"message": "hello"}',
      headers: { 'content-type': 'application/json' },
    };

    when('[t0] checked', () => {
      then('returns false (not wrapped format)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case12] API Gateway v2 event', () => {
    const payload = {
      requestContext: { http: { method: 'POST', path: '/api/test' } },
      body: '{"message": "hello"}',
      headers: { 'content-type': 'application/json' },
    };

    when('[t0] checked', () => {
      then('returns false (not wrapped format)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case13] null payload', () => {
    const payload = null;

    when('[t0] checked', () => {
      then('returns false', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case14] undefined payload', () => {
    const payload = undefined;

    when('[t0] checked', () => {
      then('returns false', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case15] array payload', () => {
    const payload = [{ event: {}, trail: {} }];

    when('[t0] checked', () => {
      then('returns false (arrays are not wrapped payloads)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case16] string payload', () => {
    const payload = '{"event": {}, "trail": {}}';

    when('[t0] checked', () => {
      then('returns false (strings are not wrapped payloads)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case17] empty object payload', () => {
    const payload = {};

    when('[t0] checked', () => {
      then('returns false (needs event and trail keys)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case18] trail with extra properties', () => {
    const payload = {
      event: { message: 'hello' },
      trail: { exid: 'exid:abc', extra: 'data' },
    };

    when('[t0] checked', () => {
      then('returns true (extra trail props allowed)', () => {
        expect(getIsWrappedPayload(payload)).toBe(true);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case19] event is null (valid wrapped)', () => {
    const payload = {
      event: null,
      trail: { exid: 'exid:abc' },
    };

    when('[t0] checked', () => {
      then('returns true (event can be any value)', () => {
        expect(getIsWrappedPayload(payload)).toBe(true);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case20] event is array (valid wrapped)', () => {
    const payload = {
      event: [1, 2, 3],
      trail: {},
    };

    when('[t0] checked', () => {
      then('returns true (event can be array)', () => {
        expect(getIsWrappedPayload(payload)).toBe(true);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case21] trail is array (invalid)', () => {
    const payload = {
      event: { message: 'hello' },
      trail: [],
    };

    when('[t0] checked', () => {
      then('returns false (trail must be object, not array)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });

  given('[case22] legacy client payload (uuid action pattern)', () => {
    const payload = {
      uuid: '123e4567-e89b-12d3-a456-426614174000',
      action: 'get',
    };

    when('[t0] checked', () => {
      then('returns false (not wrapped format)', () => {
        expect(getIsWrappedPayload(payload)).toBe(false);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          result: getIsWrappedPayload(payload),
        }).toMatchSnapshot();
      });
    });
  });
});
