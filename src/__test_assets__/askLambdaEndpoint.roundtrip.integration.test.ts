/**
 * .what = round-trip tests for caller/handler combinations that use contemp utils
 * .why = verifies error format compatibility across ancient/contemp boundaries
 *
 * combinations tested:
 * - [ancient caller, contemp handler] - contemp returns flat format for ancient caller
 * - [contemp caller, ancient handler] - contemp uses struct.payload: 'ancient' to send flat event
 * - [contemp caller, contemp handler] - both use contemp format with _serde discriminator
 *
 * combinations skipped:
 * - [ancient caller, ancient handler] - no contemp utils involved, not our concern
 *
 * .prereq
 *   - rhx keyrack unlock --owner ehmpath --env test
 *   - svc-prep-echoAncient lambda deployed
 *   - svc-prep-echoContemp lambda deployed
 */
import { ConstraintError } from 'helpful-errors';
import { genContextLogTrail } from 'sdk-logs';
import { getError, given, then, useThen, when } from 'test-fns';

import { LambdaEndpointError } from '../domain.objects/LambdaEndpointError';
import { askLambdaEndpoint } from '../domain.operations/askLambdaEndpoint/askLambdaEndpoint';
import { askLambdaEndpointAncient } from './askLambdaEndpointAncient';

type EchoInput = {
  action: 'echo' | 'throwConstraintError' | 'throwInternalError';
  message?: string;
};

type EchoOutput = {
  result: string;
};

const genTestLog = () =>
  genContextLogTrail({
    trail: { exid: 'exid:roundtrip-test', stack: [] },
    env: null,
  });

const ENV = { access: 'prep' as const, region: 'us-east-1' };

describe('askLambdaEndpoint round-trip', () => {
  /**
   * [ancient caller, contemp handler]
   * - caller sends raw event
   * - handler detects ancient caller (no trail wrapper)
   * - handler returns flat errorMessage format for backwards compat
   */
  describe('[ancient, contemp]', () => {
    given('[case1] echo action', () => {
      when('[t0] ancient caller invokes contemp handler', () => {
        const response = useThen('invocation succeeds', async () =>
          askLambdaEndpointAncient<EchoInput, EchoOutput>(
            {
              which: {
                service: 'svc',
                function: 'echoContemp',
              },
              event: { action: 'echo', message: 'hello' },
            },
            { env: ENV },
          ),
        );

        then('returns result', () => {
          expect(response.result).toBe('contemp: hello');
        });
      });
    });

    given('[case2] constraint error', () => {
      when('[t0] ancient caller invokes contemp handler', () => {
        const errorDetails = useThen('invocation fails', async () => {
          const caught = await getError(async () =>
            askLambdaEndpointAncient<EchoInput, EchoOutput>(
              {
                which: {
                  service: 'svc',
                  function: 'echoContemp',
                },
                event: { action: 'throwConstraintError' },
              },
              { env: ENV },
            ),
          );
          return {
            isLambdaEndpointError: caught instanceof LambdaEndpointError,
            name: caught instanceof Error ? caught.name : undefined,
            message: caught instanceof Error ? caught.message : undefined,
            metadata:
              caught instanceof LambdaEndpointError
                ? caught.metadata
                : undefined,
          };
        });

        then('error is LambdaEndpointError', () => {
          expect(errorDetails.isLambdaEndpointError).toBe(true);
        });

        then('contemp handler returns flat format for ancient caller', () => {
          expect(errorDetails.message).toContain('contemp constraint error');
          // contemp handler returns BadRequestError for ancient callers
          expect(errorDetails.metadata?.errorType).toBe('BadRequestError');
        });
      });
    });
  });

  /**
   * [contemp caller, ancient handler]
   * - caller uses struct.payload: 'ancient' to send flat event (no wrapper)
   * - handler returns flat errorMessage format
   * - caller handles flat format via getIsAncientErrorResponse
   */
  describe('[contemp, ancient]', () => {
    given('[case1] echo action', () => {
      when('[t0] contemp caller invokes ancient handler', () => {
        const response = useThen('invocation succeeds', async () =>
          askLambdaEndpoint<EchoInput, EchoOutput>(
            {
              which: {
                service: 'svc',
                function: 'echoAncient',
              },
              event: { action: 'echo', message: 'hello' },
              struct: { payload: 'ancient' },
            },
            { ...genTestLog(), env: ENV },
          ),
        );

        then('returns result', () => {
          expect(response.result).toBe('ancient: hello');
        });
      });
    });

    given('[case2] constraint error', () => {
      when('[t0] contemp caller invokes ancient handler', () => {
        const errorDetails = useThen('invocation fails', async () => {
          const caught = await getError(async () =>
            askLambdaEndpoint<EchoInput, EchoOutput>(
              {
                which: {
                  service: 'svc',
                  function: 'echoAncient',
                },
                event: { action: 'throwConstraintError' },
                struct: { payload: 'ancient' },
              },
              { ...genTestLog(), env: ENV },
            ),
          );
          return {
            isConstraintError: caught instanceof ConstraintError,
            isLambdaEndpointError: caught instanceof LambdaEndpointError,
            name: caught instanceof Error ? caught.name : undefined,
            message: caught instanceof Error ? caught.message : undefined,
          };
        });

        then('error is ConstraintError (not LambdaEndpointError)', () => {
          // ancient handler returns BadRequestError, contemp caller converts to ConstraintError
          expect(errorDetails.isConstraintError).toBe(true);
          expect(errorDetails.isLambdaEndpointError).toBe(false);
        });

        then('error message preserved', () => {
          expect(errorDetails.message).toContain('ancient constraint error');
        });
      });
    });
  });

  /**
   * [contemp caller, contemp handler]
   * - caller sends wrapped event { event, trail }
   * - handler detects contemp caller, returns contemp format with _serde
   * - caller handles contemp format via getIsContempErrorResponse
   */
  describe('[contemp, contemp]', () => {
    given('[case1] echo action', () => {
      when('[t0] contemp caller invokes contemp handler', () => {
        const response = useThen('invocation succeeds', async () =>
          askLambdaEndpoint<EchoInput, EchoOutput>(
            {
              which: {
                service: 'svc',
                function: 'echoContemp',
              },
              event: { action: 'echo', message: 'hello' },
            },
            { ...genTestLog(), env: ENV },
          ),
        );

        then('returns result', () => {
          expect(response.result).toBe('contemp: hello');
        });
      });
    });

    given('[case2] constraint error', () => {
      when('[t0] contemp caller invokes contemp handler', () => {
        const errorDetails = useThen('invocation fails', async () => {
          const caught = await getError(async () =>
            askLambdaEndpoint<EchoInput, EchoOutput>(
              {
                which: {
                  service: 'svc',
                  function: 'echoContemp',
                },
                event: { action: 'throwConstraintError' },
              },
              { ...genTestLog(), env: ENV },
            ),
          );
          return {
            isConstraintError: caught instanceof ConstraintError,
            isLambdaEndpointError: caught instanceof LambdaEndpointError,
            name: caught instanceof Error ? caught.name : undefined,
            message: caught instanceof Error ? caught.message : undefined,
          };
        });

        then('error is ConstraintError (not LambdaEndpointError)', () => {
          // contemp handler returns ConstraintError via contemp format
          expect(errorDetails.isConstraintError).toBe(true);
          expect(errorDetails.isLambdaEndpointError).toBe(false);
        });

        then('error message preserved', () => {
          expect(errorDetails.message).toContain('contemp constraint error');
        });
      });
    });
  });
});
