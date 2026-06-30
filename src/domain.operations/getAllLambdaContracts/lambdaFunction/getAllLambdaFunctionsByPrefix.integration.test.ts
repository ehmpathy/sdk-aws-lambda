/**
 * .what = real integration tests for getAllLambdaFunctionsByPrefix
 * .why = verifies lambda function discovery against real AWS infrastructure
 *
 * .prereq
 *   - rhx keyrack unlock --owner ehmpath --env test
 *   - svc-prep-getEventEcho lambda deployed (see provision/aws.infra/account=demo/)
 */
import { given, then, useThen, when } from 'test-fns';

import { genLambdaSdk } from '../../../access/sdks/lambda/genLambdaSdk';
import { getAllLambdaFunctionsByPrefix } from './getAllLambdaFunctionsByPrefix';

describe('getAllLambdaFunctionsByPrefix', () => {
  given('[case1] demo lambda exists', () => {
    when('[t0] prefix matches demo lambda', () => {
      // extract array details in callback (useThen proxy loses array prototype)
      const result = useThen('function list returned', async () => {
        const names = await getAllLambdaFunctionsByPrefix(
          { prefix: 'svc-prep-' },
          { sdkLambda: genLambdaSdk({ env: { region: 'us-east-1' } }) },
        );
        return {
          names,
          count: names.length,
          includesGetEventEcho: names.includes('svc-prep-getEventEcho'),
          allStartWithPrefix: names.every((name) =>
            name.startsWith('svc-prep-'),
          ),
        };
      });

      then('includes svc-prep-getEventEcho', () => {
        expect(result.includesGetEventEcho).toBe(true);
      });

      then('all names start with prefix', () => {
        expect(result.allStartWithPrefix).toBe(true);
      });

      then('result matches snapshot', () => {
        expect({
          count: result.count,
          includesGetEventEcho: result.includesGetEventEcho,
          allStartWithPrefix: result.allStartWithPrefix,
        }).toMatchSnapshot();
      });
    });
  });

  given('[case2] prefix matches no lambdas', () => {
    when('[t0] prefix has no matches', () => {
      // extract array length in callback (useThen proxy loses array prototype)
      const result = useThen('returns empty array', async () => {
        const names = await getAllLambdaFunctionsByPrefix(
          { prefix: 'nonexistent-prefix-xyz-' },
          { sdkLambda: genLambdaSdk({ env: { region: 'us-east-1' } }) },
        );
        return { names, isEmpty: names.length === 0 };
      });

      then('result is empty', () => {
        expect(result.isEmpty).toBe(true);
      });

      then('result matches snapshot', () => {
        expect({
          count: result.names.length,
          isEmpty: result.isEmpty,
        }).toMatchSnapshot();
      });
    });
  });
});
