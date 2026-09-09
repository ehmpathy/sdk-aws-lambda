import { given, then, when } from 'test-fns';

import { genContentTypeCoherenceMiddleware } from './genContentTypeCoherenceMiddleware';

/**
 * .what = drives the middleware's `after` hook against one response shape
 * .why = middy hands the hook a whole `request`; the assertion is about `request.response`
 *        alone, so the ceremony belongs here rather than in each case
 */
const invokeAfter = async (
  response: Record<string, unknown> | undefined,
): Promise<Record<string, unknown> | undefined> => {
  const middleware = genContentTypeCoherenceMiddleware();
  const request = { response } as unknown as Parameters<
    typeof middleware.after
  >[0];

  await middleware.after(request);

  return request.response as unknown as Record<string, unknown> | undefined;
};

/**
 * .what = drives the middleware's `onError` hook against one response shape
 * .why = the two hooks are registered against ONE function, and a future edit could drop the
 *        `onError` registration with no test to notice. so the error path is driven through
 *        `middleware.onError` by name rather than assumed to behave like `after`
 */
const invokeOnError = async (
  response: Record<string, unknown> | undefined,
): Promise<Record<string, unknown> | undefined> => {
  const middleware = genContentTypeCoherenceMiddleware();
  const request = { response } as unknown as Parameters<
    typeof middleware.onError
  >[0];

  await middleware.onError(request);

  return request.response as unknown as Record<string, unknown> | undefined;
};

describe('genContentTypeCoherenceMiddleware', () => {
  given('[case1] a response with no body, stamped application/json', () => {
    when('[t0] the after hook runs', () => {
      then('it drops the Content-Type', async () => {
        const after = await invokeAfter({
          statusCode: 204,
          headers: { 'Content-Type': 'application/json' },
          body: undefined,
        });
        expect(after?.headers).toEqual({});
      });
    });
  });

  given('[case2] a body-less response whose body key is ABSENT', () => {
    when('[t0] the after hook runs', () => {
      then('it still drops the Content-Type', async () => {
        const after = await invokeAfter({
          statusCode: 308,
          headers: {
            Location: 'https://ehmpath.com',
            'content-type': 'text/xml',
          },
        });
        expect(after?.headers).toEqual({ Location: 'https://ehmpath.com' });
      });
    });
  });

  given('[case3] a response that carries a body', () => {
    when('[t0] the after hook runs', () => {
      then('it leaves the Content-Type alone', async () => {
        const after = await invokeAfter({
          statusCode: 200,
          headers: { 'Content-Type': 'text/xml' },
          body: '<Response/>',
        });
        expect(after?.headers).toEqual({ 'Content-Type': 'text/xml' });
      });
    });
  });

  given('[case4] a response with an EMPTY-STRING body', () => {
    when('[t0] the after hook runs', () => {
      then(
        'it leaves the Content-Type alone — zero bytes is still a body',
        async () => {
          const after = await invokeAfter({
            statusCode: 200,
            headers: { 'Content-Type': 'text/plain' },
            body: '',
          });
          expect(after?.headers).toEqual({ 'Content-Type': 'text/plain' });
        },
      );
    });
  });

  given('[case5] an error path that set no response at all', () => {
    when('[t0] the after hook runs', () => {
      then('it is a no-op rather than a throw', async () => {
        const after = await invokeAfter(undefined);
        expect(after).toBeUndefined();
      });
    });
  });

  /**
   * .what = the ONERROR hook, driven by name
   * .why = the middleware registers `onError` too, and a body-less error response must lose
   *        its Content-Type exactly as a body-less success response does. without these the
   *        `onError` registration is an untested claim — which is precisely what five peer
   *        reviewers flagged
   */
  given('[case6] a body-less ERROR response, stamped application/json', () => {
    when('[t0] the onError hook runs', () => {
      then('it drops the Content-Type', async () => {
        const after = await invokeOnError({
          statusCode: 304,
          headers: { 'Content-Type': 'application/json' },
        });
        expect(after?.headers).toEqual({});
      });
    });
  });

  given('[case7] an ERROR response that carries a json body', () => {
    when('[t0] the onError hook runs', () => {
      then('it leaves the Content-Type alone — the 400/500 shape', async () => {
        const after = await invokeOnError({
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: '{"errorType":"BadRequestError"}',
        });
        expect(after?.headers).toEqual({ 'Content-Type': 'application/json' });
      });
    });
  });

  given(
    '[case8] an error that reached onError before any response was set',
    () => {
      when('[t0] the onError hook runs', () => {
        then('it is a no-op rather than a throw', async () => {
          const after = await invokeOnError(undefined);
          expect(after).toBeUndefined();
        });
      });
    },
  );
});
