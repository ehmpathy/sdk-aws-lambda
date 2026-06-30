import type { ContextLogTrail } from 'sdk-logs';
import { given, then, useThen, when } from 'test-fns';

import { genTrailMiddleware } from './genTrailMiddleware';

describe('genTrailMiddleware', () => {
  const invokeMiddleware = async (
    event: unknown,
  ): Promise<{ context: ContextLogTrail; event: unknown }> => {
    const middleware = genTrailMiddleware();
    const request = {
      event,
      context: {} as Record<string, unknown>,
      response: undefined,
      error: undefined as unknown as Error,
      internal: {},
    } as unknown as Parameters<NonNullable<typeof middleware.before>>[0];

    await middleware.before!(request);
    return {
      context: request.context as unknown as ContextLogTrail,
      event: request.event,
    };
  };

  given('[case1] wrapped format { event, trail } with exid', () => {
    const payload = {
      event: { message: 'hello' },
      trail: { exid: 'exid:from-caller' },
    };

    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(payload),
      );

      then('context should have log with trail from payload', () => {
        expect(result.context.log.trail?.exid).toEqual('exid:from-caller');
      });

      then('event should be unwrapped', () => {
        expect(result.event).toEqual({ message: 'hello' });
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          outputEvent: result.event,
          outputExid: result.context.log.trail?.exid,
        }).toMatchSnapshot();
      });
    });
  });

  given('[case2] wrapped format { event, trail } without exid', () => {
    const payload = {
      event: { message: 'hello' },
      trail: {},
    };

    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(payload),
      );

      then('context should have log with generated exid', () => {
        expect(result.context.log.trail?.exid).toMatch(/^exid:/);
      });

      then('event should be unwrapped', () => {
        expect(result.event).toEqual({ message: 'hello' });
      });

      then('result structure matches snapshot', () => {
        expect({
          input: payload,
          outputEvent: result.event,
          exidGenerated: typeof result.context.log.trail?.exid === 'string',
        }).toMatchSnapshot();
      });
    });
  });

  given('[case3] raw format (legacy caller)', () => {
    const payload = { message: 'hello' };

    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(payload),
      );

      then('context should have log with generated exid', () => {
        expect(result.context.log.trail?.exid).toMatch(/^exid:/);
      });

      then('event should remain as-is', () => {
        expect(result.event).toEqual({ message: 'hello' });
      });

      then('result structure matches snapshot', () => {
        expect({
          input: payload,
          outputEvent: result.event,
          exidGenerated: typeof result.context.log.trail?.exid === 'string',
        }).toMatchSnapshot();
      });
    });
  });

  given('[case4] context log has methods', () => {
    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware({}),
      );

      then('context.log should have debug method', () => {
        expect(typeof result.context.log.debug).toBe('function');
      });

      then('context.log should have info method', () => {
        expect(typeof result.context.log.info).toBe('function');
      });

      then('context.log should have warn method', () => {
        expect(typeof result.context.log.warn).toBe('function');
      });

      then('context.log should have error method', () => {
        expect(typeof result.context.log.error).toBe('function');
      });

      then('log methods snapshot', () => {
        expect({
          hasDebug: typeof result.context.log.debug === 'function',
          hasInfo: typeof result.context.log.info === 'function',
          hasWarn: typeof result.context.log.warn === 'function',
          hasError: typeof result.context.log.error === 'function',
        }).toMatchSnapshot();
      });
    });
  });

  given('[case5] trail has empty stack initially', () => {
    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware({}),
      );

      then('trail.stack should be empty array', () => {
        expect(result.context.log.trail?.stack).toEqual([]);
      });

      then('trail structure matches snapshot', () => {
        expect({
          stack: result.context.log.trail?.stack,
          hasExid: typeof result.context.log.trail?.exid === 'string',
        }).toMatchSnapshot();
      });
    });
  });

  given('[case6] event has trail = null (explicit null)', () => {
    const payload = { trail: null };

    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(payload),
      );

      then('context should have log with generated exid', () => {
        expect(result.context.log.trail?.exid).toMatch(/^exid:/);
      });

      then('event should be the raw payload (not unwrapped)', () => {
        expect(result.event).toEqual({ trail: null });
      });

      then('result structure matches snapshot', () => {
        expect({
          input: payload,
          outputEvent: result.event,
          exidGenerated: typeof result.context.log.trail?.exid === 'string',
        }).toMatchSnapshot();
      });
    });
  });

  given('[case7] SQS-style event (Records array, no trail)', () => {
    const sqsEvent = {
      Records: [
        {
          messageId: 'msg-123',
          body: '{"data": "test"}',
          eventSource: 'aws:sqs',
        },
      ],
    };

    when('[t0] middleware invoked with SQS event', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(sqsEvent),
      );

      then('context should have log with generated exid', () => {
        expect(result.context.log.trail?.exid).toMatch(/^exid:/);
      });

      then('event should remain as-is (SQS Records)', () => {
        expect(result.event).toEqual(sqsEvent);
      });

      then('result structure matches snapshot', () => {
        expect({
          input: sqsEvent,
          outputEvent: result.event,
          exidGenerated: typeof result.context.log.trail?.exid === 'string',
        }).toMatchSnapshot();
      });
    });
  });

  given('[case8] ancient caller payload (raw event, no trail wrapper)', () => {
    const legacyPayload = {
      uuid: '123e4567-e89b-12d3-a456-426614174000',
      action: 'get',
    };

    when('[t0] middleware invoked with legacy payload', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(legacyPayload),
      );

      then('context should have log with generated exid', () => {
        expect(result.context.log.trail?.exid).toMatch(/^exid:/);
      });

      then('event should remain as-is', () => {
        expect(result.event).toEqual(legacyPayload);
      });

      then('result structure matches snapshot', () => {
        expect({
          input: legacyPayload,
          outputEvent: result.event,
          exidGenerated: typeof result.context.log.trail?.exid === 'string',
        }).toMatchSnapshot();
      });
    });
  });

  given('[case9] user payload with trail string (collision case)', () => {
    const payload = { trail: 'mountain path', destination: 'summit' };

    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(payload),
      );

      then('context should have log with generated exid', () => {
        expect(result.context.log.trail?.exid).toMatch(/^exid:/);
      });

      then('event should remain as-is (user data preserved)', () => {
        expect(result.event).toEqual(payload);
      });

      then('result structure matches snapshot', () => {
        expect({
          input: payload,
          outputEvent: result.event,
          exidGenerated: typeof result.context.log.trail?.exid === 'string',
        }).toMatchSnapshot();
      });
    });
  });

  given('[case10] API Gateway v1 event', () => {
    const apiGatewayEvent = {
      httpMethod: 'POST',
      path: '/api/test',
      body: '{"message": "hello"}',
      headers: { 'content-type': 'application/json' },
    };

    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(apiGatewayEvent),
      );

      then('context should have log with generated exid', () => {
        expect(result.context.log.trail?.exid).toMatch(/^exid:/);
      });

      then('event should remain as-is (API Gateway event)', () => {
        expect(result.event).toEqual(apiGatewayEvent);
      });

      then('result structure matches snapshot', () => {
        expect({
          input: apiGatewayEvent,
          outputEvent: result.event,
          exidGenerated: typeof result.context.log.trail?.exid === 'string',
        }).toMatchSnapshot();
      });
    });
  });

  given('[case11] wrapped event with nested complex data', () => {
    const payload = {
      event: {
        users: [
          { id: 1, name: 'alice' },
          { id: 2, name: 'bob' },
        ],
        metadata: { version: '1.0', timestamp: '2026-01-01T00:00:00Z' },
      },
      trail: { exid: 'exid:complex-data' },
    };

    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(payload),
      );

      then('exid should be extracted', () => {
        expect(result.context.log.trail?.exid).toEqual('exid:complex-data');
      });

      then('nested event data should be unwrapped correctly', () => {
        expect(result.event).toEqual(payload.event);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          outputEvent: result.event,
          outputExid: result.context.log.trail?.exid,
        }).toMatchSnapshot();
      });
    });
  });

  given('[case12] payload with extra keys beyond event and trail', () => {
    const payload = {
      event: { message: 'hello' },
      trail: { exid: 'exid:test' },
      extra: 'field',
    };

    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(payload),
      );

      then('context should have generated exid (not wrapped format)', () => {
        expect(result.context.log.trail?.exid).toMatch(/^exid:/);
        expect(result.context.log.trail?.exid).not.toEqual('exid:test');
      });

      then('event should be the full payload (not unwrapped)', () => {
        expect(result.event).toEqual(payload);
      });

      then('result structure matches snapshot', () => {
        expect({
          input: payload,
          outputEvent: result.event,
          exidGenerated: typeof result.context.log.trail?.exid === 'string',
        }).toMatchSnapshot();
      });
    });
  });

  given('[case13] wrapped event where event is null', () => {
    const payload = {
      event: null,
      trail: { exid: 'exid:null-event' },
    };

    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(payload),
      );

      then('exid should be extracted', () => {
        expect(result.context.log.trail?.exid).toEqual('exid:null-event');
      });

      then('event should be null (unwrapped)', () => {
        expect(result.event).toBeNull();
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          outputEvent: result.event,
          outputExid: result.context.log.trail?.exid,
        }).toMatchSnapshot();
      });
    });
  });

  given('[case14] wrapped event where event is an array', () => {
    const payload = {
      event: [1, 2, 3, 'batch', 'items'],
      trail: { exid: 'exid:array-event' },
    };

    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(payload),
      );

      then('exid should be extracted', () => {
        expect(result.context.log.trail?.exid).toEqual('exid:array-event');
      });

      then('event should be the array (unwrapped)', () => {
        expect(result.event).toEqual([1, 2, 3, 'batch', 'items']);
      });

      then('result matches snapshot', () => {
        expect({
          input: payload,
          outputEvent: result.event,
          outputExid: result.context.log.trail?.exid,
        }).toMatchSnapshot();
      });
    });
  });
});
