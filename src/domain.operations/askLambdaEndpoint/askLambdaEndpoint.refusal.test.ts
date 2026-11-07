import type { LambdaClient } from '@aws-sdk/client-lambda';
import {
  ConstraintError,
  MalfunctionError,
  UnexpectedCodePathError,
} from 'helpful-errors';
import { genContextLogTrail } from 'sdk-logs';
import { createCache } from 'simple-in-memory-cache';
import { getError, given, then, when } from 'test-fns';

import { LambdaEndpointRefusedError } from '../../domain.objects/LambdaEndpointRefusedError';
import { getIsConstraintError } from '../genLambdaEndpoint/middleware/getIsConstraintError';
import { askLambdaEndpoint } from './askLambdaEndpoint';

/**
 * .what = generates test log context
 * .why = provides valid ContextLogTrail for tests without trail propagation needs
 */
const genTestLog = (): ReturnType<typeof genContextLogTrail> =>
  genContextLogTrail({ trail: null, env: null });

/**
 * .what = a plain in-memory peer that answers a contemp refusal envelope, after a short wait
 * .why = injected through `context.aws.lambda.sdk`, so this file holds no module mock of the aws
 *        sdk (rule.forbid.unit.remote-boundaries): the command is the real `InvokeCommand`, and
 *        only the remote `send` is faked. the wait keeps the first ask in flight while a second
 *        one starts, as two concurrent asks would in a real consumer
 */
const genPeerThatRefuses = (): {
  aws: { lambda: { sdk: LambdaClient } };
  sends: unknown[];
} => {
  const sends: unknown[] = [];
  const sdk = {
    send: async (command: unknown) => {
      sends.push(command);
      await new Promise((wake) => setTimeout(wake, 50));
      return {
        StatusCode: 200,
        Payload: Buffer.from(
          JSON.stringify({
            error: {
              _serde: 'LambdaEndpointError::contemp@v1',
              class: 'ConstraintError',
              message: 'spot absent',
            },
          }),
        ),
      };
    },
  };
  // the fake implements only the `send` the ask road calls
  return { aws: { lambda: { sdk: sdk as unknown as LambdaClient } }, sends };
};

/**
 * .what = a peer refusal on the invoke road, under each refusal opt
 * .why = the opt is optional on `viaInvoke`, so a drop of it on the way to the cast would still
 *        compile, and the default would silently win. these read the class at the call itself
 *        (sdk-aws-lambda#77)
 */
describe('askLambdaEndpoint, when the peer refuses', () => {
  const which = { service: 'svc-surf', function: 'getForecast' };
  const event = { spot: 'pipeline' };

  given('[case1] the peer refuses the request', () => {
    when('[t0] the asker takes the default opt', () => {
      then(
        'it throws a LambdaEndpointRefusedError, a server fault',
        async () => {
          const { aws } = genPeerThatRefuses();
          const error = await getError(
            askLambdaEndpoint(
              { which, event },
              { ...genTestLog(), env: { access: 'test' }, aws },
            ),
          );
          expect(error).toBeInstanceOf(LambdaEndpointRefusedError);
          expect(getIsConstraintError({ error })).toEqual(false);
          expect(error.message).toContain('spot absent');
        },
      );
    });

    when('[t1] the asker opts into pass-through', () => {
      then('it throws a ConstraintError, the caller fault', async () => {
        const { aws } = genPeerThatRefuses();
        const error = await getError(
          askLambdaEndpoint(
            { which, event, refusal: { as: 'ConstraintError' } },
            { ...genTestLog(), env: { access: 'test' }, aws },
          ),
        );
        expect(error).toBeInstanceOf(ConstraintError);
        expect(error).not.toBeInstanceOf(LambdaEndpointRefusedError);
        expect(error.message).toContain('spot absent');
      });
    });

    when('[t2] the asker names an opt the sdk cannot honor', () => {
      then(
        'it fails before any invoke is sent, as the asker own defect',
        async () => {
          const { aws, sends } = genPeerThatRefuses();
          const error = await getError(
            askLambdaEndpoint(
              {
                which,
                event,
                refusal: { as: 'constraintError' } as unknown as {
                  as: 'ConstraintError';
                },
              },
              { ...genTestLog(), env: { access: 'test' }, aws },
            ),
          );
          expect(error).toBeInstanceOf(MalfunctionError);
          expect(error).toBeInstanceOf(UnexpectedCodePathError);
          expect(getIsConstraintError({ error })).toEqual(false);
          expect(sends).toEqual([]);
        },
      );
    });

    /**
     * .what = two concurrent asks of one event, one per opt, on a shared dedupe cache
     * .why = the dedupe cache shares one in-flight promise per key. were the two opts keyed alike,
     *        the second ask would await the first's rejection, and catch the class the other asker
     *        asked for — a 500 where a 400 was owed, or the reverse
     */
    when('[t3] two concurrent asks, one per opt, share a dedupe cache', () => {
      then(
        'each ask is sent, and each throws the class its own opt names',
        async () => {
          const { aws, sends } = genPeerThatRefuses();
          const cache = { response: createCache(), dedupe: createCache() };
          const context = {
            ...genTestLog(),
            env: { access: 'test' as const },
            aws,
          };
          const [errorDefault, errorPassThrough] = await Promise.all([
            getError(
              askLambdaEndpoint({ which, event }, { ...context, cache }),
            ),
            getError(
              askLambdaEndpoint(
                { which, event, refusal: { as: 'ConstraintError' } },
                { ...context, cache },
              ),
            ),
          ]);
          expect(sends).toHaveLength(2);
          expect(errorDefault).toBeInstanceOf(LambdaEndpointRefusedError);
          expect(errorPassThrough).toBeInstanceOf(ConstraintError);
          expect(errorPassThrough).not.toBeInstanceOf(
            LambdaEndpointRefusedError,
          );
        },
      );
    });
  });
});
