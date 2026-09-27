import { given, then, when } from 'test-fns';

import { asSqsEvent } from '../../../__test_assets__/asSqsEvent';
import { getIsSqsEvent } from './getIsSqsEvent';

describe('getIsSqsEvent', () => {
  given('[case1] an sqs event with one record', () => {
    when('[t0] checked', () => {
      then('it is identified as sqs', () => {
        expect(
          getIsSqsEvent(asSqsEvent({ messages: [{ body: '{}' }] })),
        ).toEqual(true);
      });
    });
  });

  given('[case2] an sqs event with no records', () => {
    when('[t0] checked', () => {
      /**
       * .what = an empty batch is a legitimate sqs shape
       * .why = refusal would be a guess about a value the guard cannot see. the batch-size
       *        rule belongs to `perRecord`, which states it as its own constraint
       */
      then('it is identified as sqs', () => {
        expect(getIsSqsEvent(asSqsEvent({ messages: [] }))).toEqual(true);
      });
    });
  });

  given(
    '[case3] an s3 event — the same `Records` envelope, a different source',
    () => {
      when('[t0] checked', () => {
        /**
         * .what = the clamp on the `eventSource` read
         * .why = `{ Records: [...] }` is also what s3, sns, dynamodb-streams, and kinesis
         *        deliver. a `Records`-only check accepts all four and decodes each one wrong —
         *        an s3 record has no `body`, so `payload` would silently be `null`
         */
        then('it is refused', () => {
          expect(
            getIsSqsEvent({
              Records: [
                { eventSource: 'aws:s3', s3: { object: { key: 'a.txt' } } },
              ],
            }),
          ).toEqual(false);
        });
      });
    },
  );

  given('[case4] values that are not an sqs event at all', () => {
    const cases = [
      { description: 'null', value: null },
      { description: 'undefined', value: undefined },
      { description: 'a string', value: 'Records' },
      { description: 'an api-gateway event', value: { httpMethod: 'POST' } },
      {
        description: 'a Records key that is not an array',
        value: { Records: {} },
      },
    ];

    cases.map((thisCase) =>
      when(`[t0] checked — ${thisCase.description}`, () => {
        then('it is refused', () => {
          expect(getIsSqsEvent(thisCase.value)).toEqual(false);
        });
      }),
    );
  });
});
