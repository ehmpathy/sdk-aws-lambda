import { given, then, when } from 'test-fns';

import { asRecordSlots } from './asRecordSlots';

describe('asRecordSlots', () => {
  given('[case1] a record whose source carries a header bag', () => {
    when('[t0] its slots are read', () => {
      then('the schema is handed the headers and the payload', () => {
        expect(
          asRecordSlots({
            record: {
              id: 'msg-1',
              payload: { orderId: 'o-1' },
              headers: { sentBy: 'invoice-svc' },
              _: { raw: {} },
            },
          }),
        ).toEqual({
          headers: { sentBy: 'invoice-svc' },
          payload: { orderId: 'o-1' },
        });
      });
    });
  });

  given('[case2] a record whose source carries no header bag', () => {
    when('[t0] its slots are read', () => {
      /**
       * .why = a `headers: undefined` key would make a strict schema refuse every valid kinesis
       *        record, and a refusal is acknowledged, so the shard would advance past good data
       */
      then('the schema is handed the payload alone, no headers key', () => {
        const slots = asRecordSlots({
          record: { id: '49590', payload: { url: '/a' }, _: { raw: {} } },
        });
        expect(slots).toEqual({ payload: { url: '/a' } });
        expect('headers' in slots).toEqual(false);
      });
    });
  });
});
