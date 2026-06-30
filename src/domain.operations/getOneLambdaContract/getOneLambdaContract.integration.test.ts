/**
 * .what = real integration tests for getOneLambdaContract error contracts
 * .why = verifies the fail-fast contracts against real AWS infrastructure
 *
 * .prereq
 *   - rhx keyrack unlock --owner ehmpath --env test
 *
 * .note
 *   - the positive round-trip (deployed introspectable lambda → real schema) is
 *     covered by blackbox/deployed.introspection.acceptance.test.ts
 *   - here we cover the error contracts: blocked outside prep, absent function
 */
import { genContextLogTrail } from 'sdk-logs';
import { getError, given, then, useThen, when } from 'test-fns';

import { LambdaFunctionNotFoundError } from '../../domain.objects/LambdaFunctionNotFoundError';
import { LambdaIntrospectionBlockedError } from '../../domain.objects/LambdaIntrospectionBlockedError';
import { getOneLambdaContract } from './getOneLambdaContract';

const { log } = genContextLogTrail({ trail: null, env: null });

describe('getOneLambdaContract', () => {
  given('[case1] introspection blocked outside prep', () => {
    when('[t0] called with non-prep access', () => {
      // capture a plain summary (useThen stores enumerable own props only)
      const caught = useThen(
        'throws LambdaIntrospectionBlockedError',
        async () => {
          const error = await getError(
            getOneLambdaContract(
              { which: { service: 'svc-demo', function: 'getEventEcho' } },
              { log, env: { access: 'prod', region: 'us-east-1' } },
            ),
          );
          return {
            isExpectedType: error instanceof LambdaIntrospectionBlockedError,
            message: error instanceof Error ? error.message : String(error),
          };
        },
      );

      then('error is LambdaIntrospectionBlockedError', () => {
        expect(caught.isExpectedType).toBe(true);
      });

      then('error message names the blocked access', () => {
        expect(caught.message).toContain('prod');
      });
    });
  });

  given('[case2] lambda does not exist in prep', () => {
    when('[t0] introspect request sent for an absent function', () => {
      const caught = useThen('throws LambdaFunctionNotFoundError', async () => {
        const error = await getError(
          getOneLambdaContract(
            {
              which: { service: 'svc-demo', function: 'nonexistentFunction' },
            },
            { log, env: { access: 'prep', region: 'us-east-1' } },
          ),
        );
        return {
          isExpectedType: error instanceof LambdaFunctionNotFoundError,
          message: error instanceof Error ? error.message : String(error),
        };
      });

      then('error is LambdaFunctionNotFoundError', () => {
        expect(caught.isExpectedType).toBe(true);
      });

      then('error message names the function', () => {
        expect(caught.message).toContain('svc-demo-prep-nonexistentFunction');
      });
    });
  });
});
