/**
 * .what = real integration tests for getAllLambdaContracts error contracts
 * .why = verifies the fail-fast contracts against real AWS infrastructure
 *
 * .prereq
 *   - rhx keyrack unlock --owner ehmpath --env test
 *
 * .note
 *   - the positive round-trip (deployed introspectable lambda → real schemas) is
 *     covered by blackbox/deployed.introspection.acceptance.test.ts
 *   - here we cover the error contracts: blocked outside prep, absent service
 */
import { genContextLogTrail } from 'sdk-logs';
import { getError, given, then, useThen, when } from 'test-fns';

import { LambdaIntrospectionBlockedError } from '../../domain.objects/LambdaIntrospectionBlockedError';
import { LambdaServiceNotFoundError } from '../../domain.objects/LambdaServiceNotFoundError';
import { getAllLambdaContracts } from './getAllLambdaContracts';

const { log } = genContextLogTrail({ trail: null, env: null });

describe('getAllLambdaContracts', () => {
  given('[case1] introspection blocked outside prep', () => {
    when('[t0] called with non-prep access', () => {
      // capture a plain summary (useThen stores enumerable own props only)
      const caught = useThen(
        'throws LambdaIntrospectionBlockedError',
        async () => {
          const error = await getError(
            getAllLambdaContracts(
              { which: { service: 'svc-demo' } },
              { log, env: { access: 'test', region: 'us-east-1' } },
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
        expect(caught.message).toContain('test');
      });
    });
  });

  given('[case2] no lambdas match service in prep', () => {
    when('[t0] called with prep access for an absent service', () => {
      const caught = useThen('throws LambdaServiceNotFoundError', async () => {
        const error = await getError(
          getAllLambdaContracts(
            { which: { service: 'svc-nonexistent-xyz' } },
            { log, env: { access: 'prep', region: 'us-east-1' } },
          ),
        );
        return {
          isExpectedType: error instanceof LambdaServiceNotFoundError,
          message: error instanceof Error ? error.message : String(error),
        };
      });

      then('error is LambdaServiceNotFoundError', () => {
        expect(caught.isExpectedType).toBe(true);
      });

      then('error message names the service', () => {
        expect(caught.message).toContain('svc-nonexistent-xyz');
      });
    });
  });
});
