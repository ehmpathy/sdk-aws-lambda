import { given, then, when } from 'test-fns';

import { getLambdaFunctionName } from './getLambdaFunctionName';

describe('getLambdaFunctionName', () => {
  given('[case1] service, access, and function provided', () => {
    when('[t0] transformed', () => {
      const result = getLambdaFunctionName({
        service: 'svc-orders',
        access: 'prod',
        function: 'getOrderByUuid',
      });

      then('it should return ${service}-${access}-${function} format', () => {
        expect(result).toEqual('svc-orders-prod-getOrderByUuid');
      });
    });
  });

  given('[case2] different access values', () => {
    when('[t0] access is prep', () => {
      const result = getLambdaFunctionName({
        service: 'svc-users',
        access: 'prep',
        function: 'getUserByUuid',
      });

      then('it should include prep in the name', () => {
        expect(result).toEqual('svc-users-prep-getUserByUuid');
      });
    });

    when('[t1] access is test', () => {
      const result = getLambdaFunctionName({
        service: 'svc-users',
        access: 'test',
        function: 'getUserByUuid',
      });

      then('it should include test in the name', () => {
        expect(result).toEqual('svc-users-test-getUserByUuid');
      });
    });
  });

  given('[case3] function with camelCase name', () => {
    when('[t0] transformed', () => {
      const result = getLambdaFunctionName({
        service: 'svc-invoices',
        access: 'prod',
        function: 'generateMonthlyInvoice',
      });

      then('it should preserve the function name case', () => {
        expect(result).toEqual('svc-invoices-prod-generateMonthlyInvoice');
      });
    });
  });
});
