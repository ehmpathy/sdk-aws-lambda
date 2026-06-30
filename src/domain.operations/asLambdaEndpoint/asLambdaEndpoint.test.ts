import { UnexpectedCodePathError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { LambdaEndpoint } from '../../domain.objects/LambdaEndpoint';
import { asLambdaEndpoint } from './asLambdaEndpoint';

describe('asLambdaEndpoint', () => {
  given('[case1] parts form', () => {
    when('[t0] built from service+access+function', () => {
      const endpoint = asLambdaEndpoint({
        service: 'svc-invoice',
        access: 'prep',
        function: 'getInvoice',
      });

      then('it is a LambdaEndpoint', () => {
        expect(endpoint).toBeInstanceOf(LambdaEndpoint);
      });

      then('it computes the slug', () => {
        expect(endpoint.slug).toEqual('svc-invoice-prep-getInvoice');
      });

      then('it carries the parts', () => {
        expect(endpoint.service).toEqual('svc-invoice');
        expect(endpoint.access).toEqual('prep');
        expect(endpoint.function).toEqual('getInvoice');
      });
    });
  });

  given('[case2] slug form', () => {
    when('[t0] parsed from a well-formed slug', () => {
      const endpoint = asLambdaEndpoint({
        slug: 'svc-invoice-prep-getInvoice',
      });

      then('it recovers the parts', () => {
        expect(endpoint.service).toEqual('svc-invoice');
        expect(endpoint.access).toEqual('prep');
        expect(endpoint.function).toEqual('getInvoice');
        expect(endpoint.slug).toEqual('svc-invoice-prep-getInvoice');
      });
    });

    when('[t1] the function itself contains dashes', () => {
      const endpoint = asLambdaEndpoint({
        slug: 'svc-user-prep-get-user-by-id',
      });

      then('it keeps the function remainder verbatim', () => {
        expect(endpoint.service).toEqual('svc-user');
        expect(endpoint.access).toEqual('prep');
        expect(endpoint.function).toEqual('get-user-by-id');
      });
    });
  });

  given('[case3] malformed slug', () => {
    when('[t0] slug lacks enough parts', () => {
      then('it throws UnexpectedCodePathError', () => {
        const error = getError(() =>
          asLambdaEndpoint({ slug: 'svc-invoice-getInvoice' }),
        );
        expect(error).toBeInstanceOf(UnexpectedCodePathError);
      });
    });

    when('[t1] slug does not start with svc', () => {
      then('it throws UnexpectedCodePathError', () => {
        const error = getError(() =>
          asLambdaEndpoint({ slug: 'app-invoice-prep-getInvoice' }),
        );
        expect(error).toBeInstanceOf(UnexpectedCodePathError);
      });
    });
  });
});
