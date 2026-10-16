import type { ContextLogTrail } from 'sdk-logs';
import { given, then, useThen, when } from 'test-fns';

import { genTrailMiddleware } from './genTrailMiddleware';

describe('genTrailMiddleware × carrier headers', () => {
  const invokeMiddleware = async (
    event: unknown,
  ): Promise<{
    context: ContextLogTrail & { isContempCaller: boolean };
    event: unknown;
  }> => {
    const middleware = genTrailMiddleware({ carrier: 'headers' });
    const request = {
      event,
      context: {} as Record<string, unknown>,
      response: undefined,
      error: undefined as unknown as Error,
      internal: {},
    } as unknown as Parameters<NonNullable<typeof middleware.before>>[0];

    await middleware.before!(request);
    return {
      context: request.context as unknown as ContextLogTrail & {
        isContempCaller: boolean;
      },
      event: request.event,
    };
  };

  given('[case1] a reconciled event whose headers carry x-trail-exid', () => {
    const event = {
      method: 'POST',
      headers: {
        'x-trail-exid': 'exid:from-header',
        accept: 'application/json',
      },
    };

    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(event),
      );

      then('the caller is contemp', () => {
        expect(result.context.isContempCaller).toEqual(true);
      });

      then('the trail carries the header exid', () => {
        expect(result.context.log.trail?.exid).toEqual('exid:from-header');
      });

      then('the event is left as is — never rewrapped or unwrapped', () => {
        expect(result.event).toBe(event);
      });
    });
  });

  given('[case2] a reconciled event with no x-trail-exid', () => {
    const event = { method: 'POST', headers: { accept: 'application/json' } };

    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(event),
      );

      then('the caller is ancient', () => {
        expect(result.context.isContempCaller).toEqual(false);
      });

      then('a fresh exid is minted', () => {
        expect(result.context.log.trail?.exid).toMatch(/^exid:/);
      });
    });
  });

  given('[case3] generic correlation headers and an empty opt-in', () => {
    const cases = [
      {
        description: 'x-amzn-trace-id',
        headers: { 'x-amzn-trace-id': 'Root=1-a' },
      },
      { description: 'traceparent', headers: { traceparent: '00-a-b-01' } },
      { description: 'x-request-id', headers: { 'x-request-id': 'r1' } },
      { description: 'an empty x-trail-exid', headers: { 'x-trail-exid': '' } },
      {
        description: 'an x-trail-exid with a newline',
        headers: { 'x-trail-exid': 'exid:a\nforged' },
      },
      {
        description: 'an x-trail-exid past the length bound',
        headers: { 'x-trail-exid': 'a'.repeat(5014) },
      },
    ];

    cases.map((thisCase, index) =>
      when(`[t${index}] the only header is ${thisCase.description}`, () => {
        const result = useThen('middleware completes', async () =>
          invokeMiddleware({ method: 'GET', headers: thisCase.headers }),
        );

        then('the caller stays ancient', () => {
          expect(result.context.isContempCaller).toEqual(false);
        });
      }),
    );
  });

  given('[case4] a { event, trail } wrapper', () => {
    const wrapper = {
      event: { method: 'GET', headers: {} },
      trail: { exid: 'exid:w' },
    };

    when('[t0] middleware invoked', () => {
      const result = useThen('middleware completes', async () =>
        invokeMiddleware(wrapper),
      );

      then(
        'the wrapper is not honored: ancient, fresh exid, event untouched',
        () => {
          expect(result.context.isContempCaller).toEqual(false);
          expect(result.context.log.trail?.exid).not.toEqual('exid:w');
          expect(result.event).toBe(wrapper);
        },
      );
    });
  });
});
