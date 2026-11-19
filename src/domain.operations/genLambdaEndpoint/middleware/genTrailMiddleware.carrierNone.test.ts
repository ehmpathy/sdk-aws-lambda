import type { ContextLogTrail } from 'sdk-logs';
import { given, then, useThen, when } from 'test-fns';

import { genTrailMiddleware } from './genTrailMiddleware';

/**
 * .what = the `none` carrier — an aws-delivered family that lifts no trail (`forSns`, `forKinesis.*`)
 * .why = a `{ event, trail }` wrapper is never honored at a family it was not named for
 *        (`invariant.ancient-vs-contemp-callers.md`), so a wrapped value must cross as is
 */
describe('genTrailMiddleware, carrier none', () => {
  const invokeMiddleware = async (
    event: unknown,
  ): Promise<{
    context: ContextLogTrail & { isContempCaller: boolean };
    event: unknown;
  }> => {
    const middleware = genTrailMiddleware({ carrier: 'none' });
    const request = {
      event,
      context: {} as Record<string, unknown>,
      response: undefined,
      error: undefined as unknown as Error,
      internal: {},
    } as unknown as Parameters<NonNullable<typeof middleware.before>>[0];

    await middleware.before(request);
    return {
      context: request.context as unknown as ContextLogTrail & {
        isContempCaller: boolean;
      },
      event: request.event,
    };
  };

  given('[case1] an sns event', () => {
    const event = { Records: [{ EventSource: 'aws:sns' }] };

    when('[t0] the middleware runs', () => {
      const result = useThen('it completes', async () =>
        invokeMiddleware(event),
      );

      then('a fresh exid is minted', () => {
        expect(result.context.log.trail?.exid).toMatch(/^exid:/);
      });

      then('the caller is ancient', () => {
        expect(result.context.isContempCaller).toEqual(false);
      });

      then('the event crosses as is', () => {
        expect(result.event).toBe(event);
      });
    });
  });

  given('[case2] a value shaped as a { event, trail } wrapper', () => {
    const payload = { event: { a: 1 }, trail: { exid: 'exid:forged' } };

    when('[t0] the middleware runs', () => {
      const result = useThen('it completes', async () =>
        invokeMiddleware(payload),
      );

      then('the wrapper is not honored: its exid is not adopted', () => {
        expect(result.context.log.trail?.exid).not.toEqual('exid:forged');
      });

      then('the value is not unwrapped', () => {
        expect(result.event).toBe(payload);
      });
    });
  });
});
