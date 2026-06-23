/**
 * .what = real integration tests for askLambdaEndpoint
 * .why = verifies lambda invocation against real AWS infrastructure
 *
 * .prereq
 *   - rhx keyrack unlock --owner ehmpath --env test
 *   - svc-demo-getEventEcho lambda deployed (see provision/aws.infra/account=demo/)
 */
import { genContextLogTrail } from 'sdk-logs';
import { getError, given, then, useThen, when } from 'test-fns';

import { LambdaEndpointError } from '../../domain.objects/LambdaEndpointError';
import { askLambdaEndpoint } from './askLambdaEndpoint';

/**
 * .what = generates test log context
 * .why = provides valid ContextLogTrail for tests
 */
const genTestLog = (trail?: { exid: string; stack?: string[] }) =>
  genContextLogTrail({
    trail: trail ? { exid: trail.exid, stack: trail.stack ?? [] } : null,
    env: null,
  });

describe('askLambdaEndpoint', () => {
  given('[case1] svc-demo-getEventEcho lambda exists', () => {
    when('[t0] invoked with message and trail', () => {
      const response = useThen('invocation succeeds', async () =>
        askLambdaEndpoint<
          { message: string },
          {
            echo: { message: string; trail: { exid: string | null } };
            meta: { invokedAt: string; functionName: string };
          }
        >(
          {
            which: { service: 'svc', function: 'getEventEcho' },
            event: { message: 'hello' },
          },
          {
            ...genTestLog({ exid: 'exid:integration-test' }),
            env: { access: 'demo', region: 'us-east-1' },
          },
        ),
      );

      then('it echoes the message', () => {
        expect(response.echo.message).toBe('hello');
      });

      then('it echoes the trail exid', () => {
        expect(response.echo.trail.exid).toBe('exid:integration-test');
      });

      then('it returns function metadata', () => {
        expect(response.meta.functionName).toBe('svc-demo-getEventEcho');
        expect(response.meta.invokedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });

      then('response matches snapshot', () => {
        expect({
          echo: response.echo,
          meta: {
            functionName: response.meta.functionName,
            invokedAtPresent: !!response.meta.invokedAt,
          },
        }).toMatchSnapshot();
      });
    });

    when('[t1] invoked without trail', () => {
      const response = useThen('invocation succeeds', async () =>
        askLambdaEndpoint<
          { message: string },
          {
            echo: { message: string; trail: { exid: string | null } };
            meta: { invokedAt: string; functionName: string };
          }
        >(
          {
            which: { service: 'svc', function: 'getEventEcho' },
            event: { message: 'no trail' },
          },
          {
            ...genTestLog(),
            env: { access: 'demo', region: 'us-east-1' },
          },
        ),
      );

      then('it echoes the message', () => {
        expect(response.echo.message).toBe('no trail');
      });

      then('trail exid is injected by askLambdaEndpoint', () => {
        // askLambdaEndpoint generates an exid and injects it
        expect(response.echo.trail.exid).toMatch(/^exid:/);
      });
    });
  });

  given('[case2] lambda does not exist', () => {
    when('[t0] invoked', () => {
      // extract error properties in callback (useThen proxy loses Error prototype)
      const errorDetails = useThen('invocation fails', async () => {
        const caught = await getError(async () =>
          askLambdaEndpoint<{ message: string }, unknown>(
            {
              which: { service: 'svc-nonexistent', function: 'notReal' },
              event: { message: 'hello' },
            },
            {
              ...genTestLog(),
              env: { access: 'demo', region: 'us-east-1' },
            },
          ),
        );
        return {
          isLambdaEndpointError: caught instanceof LambdaEndpointError,
          name: caught instanceof Error ? caught.name : undefined,
          message: caught instanceof Error ? caught.message : undefined,
          metadata:
            caught instanceof LambdaEndpointError ? caught.metadata : undefined,
        };
      });

      then('error is LambdaEndpointError', () => {
        expect(errorDetails.isLambdaEndpointError).toBe(true);
        expect(errorDetails.name).toBe('LambdaEndpointError');
      });

      then('error message indicates function not found', () => {
        expect(errorDetails.message).toContain('svc-nonexistent-demo-notReal');
      });

      then('error matches snapshot', () => {
        expect({
          name: errorDetails.name,
          messageContains: errorDetails.message?.includes('not found')
            ? 'not found'
            : errorDetails.message?.includes('invoke')
              ? 'invocation error'
              : 'other',
          hasMetadata: !!errorDetails.metadata,
        }).toMatchSnapshot();
      });
    });
  });
});
