import { MalfunctionError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { getAccessFromContext } from './getAccessFromContext';

describe('getAccessFromContext', () => {
  given('[case1] access in env context', () => {
    when('[t0] access is provided', () => {
      then('returns the provided access', () => {
        const result = getAccessFromContext({ env: { access: 'prod' } });
        expect(result).toEqual('prod');
      });
    });
  });

  given('[case2] no access provided', () => {
    when('[t0] env is null', () => {
      then('throws MalfunctionError', async () => {
        const error = await getError(() => getAccessFromContext({ env: null }));
        expect(error).toBeInstanceOf(MalfunctionError);
        expect(error.message).toContain('access not provided');
      });
    });

    when('[t1] env.access is null', () => {
      then('throws MalfunctionError', async () => {
        const error = await getError(() =>
          getAccessFromContext({ env: { access: null } }),
        );
        expect(error).toBeInstanceOf(MalfunctionError);
        expect(error.message).toContain('access not provided');
      });
    });
  });
});
