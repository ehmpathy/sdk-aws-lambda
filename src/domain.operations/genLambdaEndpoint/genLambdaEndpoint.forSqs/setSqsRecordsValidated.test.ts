import { getError, given, then, when } from 'test-fns';
import { z } from 'zod';

import { asSqsEvent } from '../../../__test_assets__/asSqsEvent';
import type { SqsRecordDecoded } from './SqsEventDecoded';
import { setSqsRecordsValidated } from './setSqsRecordsValidated';

/**
 * .what = a log that records each warn and error call, injected through context
 * .why = which line fires is half of each disposition, so the test reads it beside the two lists
 * .note = deliberate mutation in a `const` box — the calls land from inside the operation
 */
const genLogFake = (): {
  context: {
    log: {
      warn: (message: string, metadata?: unknown) => void;
      error: (message: string, metadata?: unknown) => void;
    };
  };
  calls: { level: 'warn' | 'error'; message: string; id: unknown }[];
} => {
  const calls: { level: 'warn' | 'error'; message: string; id: unknown }[] = [];
  return {
    calls,
    context: {
      log: {
        warn: (message, metadata) => {
          calls.push({
            level: 'warn',
            message,
            id: (metadata as { id?: unknown }).id,
          });
        },
        error: (message, metadata) => {
          calls.push({
            level: 'error',
            message,
            id: (metadata as { id?: unknown }).id,
          });
        },
      },
    },
  };
};

/**
 * .what = decoded records whose payloads are the given values, ids `msg-0`, `msg-1`, …
 * .why = the operation reads `id`, `headers`, and `payload`; the vendor record rides on `_.raw`
 */
const genRecords = (input: { payloads: unknown[] }): SqsRecordDecoded[] =>
  asSqsEvent({
    messages: input.payloads.map((payload) => ({
      body: JSON.stringify(payload),
    })),
  }).Records.map((raw, index) => ({
    id: raw.messageId,
    headers: {},
    payload: input.payloads[index],
    _: { raw },
  }));

// no `headers` key: header enforcement is opt-in, and these records carry none
const SCHEMA = z.object({ payload: z.object({ orderId: z.string() }) });

describe('setSqsRecordsValidated', () => {
  given('[case1] a batch with one record of each disposition', () => {
    when('[t0] the batch is validated', () => {
      const { context, calls } = genLogFake();
      const output = setSqsRecordsValidated(
        {
          records: genRecords({
            payloads: [
              { orderId: 'ord-ok' },
              { orderId: 404 },
              { orderId: 'ord-boom' },
            ],
          }),
          schema: SCHEMA.refine((value) => {
            if (value.payload.orderId === 'ord-boom')
              throw new Error('the refine callback broke');
            return true;
          }),
        },
        context,
      );

      then('a valid record is handed on', () => {
        expect(output.recordsValidated.map((record) => record.id)).toEqual([
          'msg-0',
        ]);
      });

      then('a caller fault is named for acknowledgement, at warn', () => {
        expect([...output.idsRefused]).toEqual(['msg-1']);
        expect(calls).toContainEqual({
          level: 'warn',
          message: 'sqs.record.refused',
          id: 'msg-1',
        });
      });

      then(
        'a server fault is in neither list, so it alone redrives, at error',
        () => {
          expect(
            output.recordsValidated.map((record) => record.id),
          ).not.toContain('msg-2');
          expect([...output.idsRefused]).not.toContain('msg-2');
          expect(calls).toContainEqual({
            level: 'error',
            message: 'sqs.record.invalid',
            id: 'msg-2',
          });
        },
      );

      then('each record leaves exactly one line', () => {
        expect(calls).toHaveLength(2);
      });
    });
  });

  given(
    '[case2] a schema callback that throws a value which is not an Error',
    () => {
      when('[t0] the batch is validated', () => {
        then('the throw escapes, so the whole batch redrives', async () => {
          const { context, calls } = genLogFake();
          const error = await getError(async () =>
            setSqsRecordsValidated(
              {
                records: genRecords({ payloads: [{ orderId: 'ord-boom' }] }),
                schema: SCHEMA.refine(() => {
                  // a thrown string carries no verdict on any record
                  throw 'the refine callback broke';
                }),
              },
              context,
            ),
          );
          expect(String(error)).toContain('the refine callback broke');
          expect(calls).toEqual([]);
        });
      });
    },
  );
});
