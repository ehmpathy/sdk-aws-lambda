import { getError } from 'helpful-errors';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import type { RecordDecodedOfSource } from './RecordDecoded';
import { setRecordValidated } from './setRecordValidated';

// the json default every record-source variant ships
const DESERIALIZE_JSON = { payload: true };

describe('setRecordValidated', () => {
  given('[case1] a record whose source carries a header bag', () => {
    const schema = z.object({
      headers: z.object({ orderGroup: z.string() }),
      payload: z.object({ orderId: z.string() }),
    });

    when('[t0] validated', () => {
      const record: RecordDecodedOfSource = {
        id: 'msg-1',
        payload: { orderId: 'o-1', extra: 'stripped' },
        headers: { orderGroup: 'g-1', sentBy: 'invoice-svc' },
        _: { raw: {} },
      };
      const result = setRecordValidated({
        record,
        schema,
        deserialize: DESERIALIZE_JSON,
      });

      then('it answers the same record, in place', () => {
        expect(result).toBe(record);
      });

      /**
       * .what = the merge arm
       * .why = zod strips the undeclared `sentBy`; a replace would delete it with no error
       */
      then('the declared header is kept, and every other one survives', () => {
        expect(result.headers).toEqual({
          orderGroup: 'g-1',
          sentBy: 'invoice-svc',
        });
      });

      then("the payload is replaced by the schema's output", () => {
        expect(result.payload).toEqual({ orderId: 'o-1' });
      });
    });
  });

  given('[case2] a record whose source carries no header bag', () => {
    when('[t0] validated against a schema that declares no headers', () => {
      const record: RecordDecodedOfSource = {
        id: '49590',
        payload: { url: '/a' },
        _: { raw: {} },
      };
      const result = setRecordValidated({
        record,
        schema: z.object({ payload: z.object({ url: z.string() }) }),
        deserialize: DESERIALIZE_JSON,
      });

      /**
       * .what = the clamp on the `'headers' in record` fork
       * .why = a kinesis record has no metadata bag, so a `headers: {}` slot must never appear
       */
      then('no headers slot appears on it', () => {
        expect('headers' in result).toEqual(false);
      });

      then('the payload is still validated', () => {
        expect(result.payload).toEqual({ url: '/a' });
      });
    });

    /**
     * .what = the clamp on the read-in half of the fork
     * .why = a strict schema refuses an unknown key. had the record's schema been handed
     *        `{ headers: undefined, payload }`, every valid kinesis record would be refused, and a
     *        refusal is acknowledged, so the shard would advance past good data
     */
    when('[t1] validated against a strict schema', () => {
      const record: RecordDecodedOfSource = {
        id: '49591',
        payload: { url: '/b' },
        _: { raw: {} },
      };

      then('the valid record passes', () => {
        const result = setRecordValidated({
          record,
          schema: z.object({ payload: z.object({ url: z.string() }) }).strict(),
          deserialize: DESERIALIZE_JSON,
        });
        expect(result.payload).toEqual({ url: '/b' });
      });
    });
  });

  given('[case3] a record the schema refuses', () => {
    when('[t0] validated', () => {
      const record: RecordDecodedOfSource = {
        id: 'msg-2',
        payload: { order: 2 },
        headers: {},
        _: { raw: {} },
      };

      then('it throws, and leaves the payload untouched', async () => {
        const error = await getError(() =>
          setRecordValidated({
            record,
            schema: z.object({ payload: z.object({ orderId: z.string() }) }),
            deserialize: DESERIALIZE_JSON,
          }),
        );
        expect(error).toBeInstanceOf(Error);
        expect(record.payload).toEqual({ order: 2 });
      });
    });
  });
});
