import { given, then, when } from 'test-fns';

import { asLambdaEvent } from '../../asLambdaEvent/asLambdaEvent';
import { getIsKinesisEvent } from './getIsKinesisEvent';

describe('getIsKinesisEvent', () => {
  given('[case1] a kinesis event with one record', () => {
    when('[t0] checked', () => {
      then('it is identified as kinesis', () => {
        expect(
          getIsKinesisEvent(asLambdaEvent.fromKinesis({ records: ['{}'] })),
        ).toEqual(true);
      });
    });
  });

  given('[case2] a kinesis event with no records', () => {
    when('[t0] checked', () => {
      /**
       * .what = an empty batch carries no record to attribute it by
       * .why = the count rule belongs to `forKinesis.perRecord`, which states it as its own
       *        constraint
       */
      then('it is identified as kinesis', () => {
        expect(
          getIsKinesisEvent(asLambdaEvent.fromKinesis({ records: [] })),
        ).toEqual(true);
      });
    });
  });

  given(
    '[case3] an sqs event — the same `Records` envelope, a different source',
    () => {
      when('[t0] checked', () => {
        /**
         * .what = the clamp on the `eventSource` read
         * .why = sqs and kinesis spell the stamp the same way, so only its value tells them
         *        apart. a `Records`-only check would decode an sqs body as base64 data
         */
        then('it is refused', () => {
          expect(
            getIsKinesisEvent(asLambdaEvent.fromSqs({ messages: ['{}'] })),
          ).toEqual(false);
        });
      });
    },
  );

  given('[case4] values that are not a kinesis event at all', () => {
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
        description: 'an sns record',
        value: { Records: [{ EventSource: 'aws:sns' }] },
      },
      {
        description: 'a kinesis stamp with no kinesis bag',
        value: { Records: [{ eventSource: 'aws:kinesis' }] },
      },
    ];

    cases.map((thisCase, index) =>
      when(`[t${index}] checked — ${thisCase.description}`, () => {
        then('it is refused', () => {
          expect(getIsKinesisEvent(thisCase.value)).toEqual(false);
        });
      }),
    );
  });
});
