import { ConstraintError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { asTrailExidHeaders } from './asTrailExidHeaders';
import { getOneTrailExidFromHeaders } from './getOneTrailExidFromHeaders';

describe('asTrailExidHeaders', () => {
  given('[case1] a trail with an exid', () => {
    when('[t0] cast to headers', () => {
      const headers = asTrailExidHeaders({ trail: { exid: 'exid:ord-7' } });

      then('the one key carries the exid', () => {
        expect(headers).toEqual({ 'x-trail-exid': 'exid:ord-7' });
      });

      then('the reader recovers the exid from what the cast emits', () => {
        expect(getOneTrailExidFromHeaders({ headers })).toEqual('exid:ord-7');
      });
    });
  });

  given(
    '[case2] a trail with an exid the endpoint would read as absent',
    () => {
      const INVALID = [
        { description: 'an empty exid', exid: '' },
        { description: 'a page of text', exid: 'a'.repeat(5014) },
        { description: 'an exid with a newline', exid: 'exid:a\nforged' },
        { description: 'an exid past the length bound', exid: 'a'.repeat(129) },
      ];

      INVALID.map((thisCase, index) =>
        when(`[t${index}] cast to headers with ${thisCase.description}`, () => {
          then(
            'it refuses, since the request would opt out in silence',
            async () => {
              const error = await getError(async () =>
                asTrailExidHeaders({ trail: { exid: thisCase.exid } }),
              );
              expect(error).toBeInstanceOf(ConstraintError);
              expect(error.message).toContain('no opt-in');
            },
          );
        }),
      );
    },
  );
});
