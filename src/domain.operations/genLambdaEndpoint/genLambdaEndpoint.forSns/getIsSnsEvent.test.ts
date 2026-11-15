import { given, then, when } from 'test-fns';

import { asLambdaEvent } from '../../asLambdaEvent/asLambdaEvent';
import { getIsSnsEvent } from './getIsSnsEvent';

describe('getIsSnsEvent', () => {
  given('[case1] an sns event with one record', () => {
    when('[t0] checked', () => {
      then('it is identified as sns', () => {
        expect(
          getIsSnsEvent(asLambdaEvent.fromSns({ messages: ['{}'] })),
        ).toEqual(true);
      });
    });
  });

  given('[case2] an sns event with no records', () => {
    when('[t0] checked', () => {
      /**
       * .what = an empty batch carries no record to attribute it by
       * .why = the count rule belongs to `forSns`, which refuses any count but one, loudly
       */
      then('it is identified as sns', () => {
        expect(getIsSnsEvent({ Records: [] })).toEqual(true);
      });
    });
  });

  given(
    '[case3] an sqs event — the same `Records` envelope, a different source',
    () => {
      when('[t0] checked', () => {
        /**
         * .what = the clamp on the `EventSource` read
         * .why = sqs spells its stamp `eventSource`, lowercase `e`, so a guard that read the wrong
         *        case, or read `Records` alone, would decode an sqs record as sns
         */
        then('it is refused', () => {
          expect(
            getIsSnsEvent(asLambdaEvent.fromSqs({ messages: ['{}'] })),
          ).toEqual(false);
        });
      });
    },
  );

  given('[case4] values that are not an sns event at all', () => {
    const cases = [
      { description: 'null', value: null },
      { description: 'undefined', value: undefined },
      { description: 'a string', value: 'Records' },
      { description: 'an api-gateway event', value: { httpMethod: 'POST' } },
      {
        description: 'a Records key that is not an array',
        value: { Records: {} },
      },
      {
        description: 'a kinesis record',
        value: { Records: [{ eventSource: 'aws:kinesis' }] },
      },
      {
        description: 'an sns stamp with no Sns bag',
        value: { Records: [{ EventSource: 'aws:sns' }] },
      },
    ];

    cases.map((thisCase, index) =>
      when(`[t${index}] checked — ${thisCase.description}`, () => {
        then('it is refused', () => {
          expect(getIsSnsEvent(thisCase.value)).toEqual(false);
        });
      }),
    );
  });
});
