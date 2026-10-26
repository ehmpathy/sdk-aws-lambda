import { given, then, when } from 'test-fns';

import { logSqsRecordInvalid } from './logSqsRecordInvalid';

/**
 * .what = an error log that records each call, injected through context
 * .why = the line is how an on-call engineer finds a schema defect of ours, so its shape is pinned
 * .note = deliberate mutation in a `const` box — the calls land from inside the operation
 */
const genLogFake = (): {
  context: { log: { error: (message: string, metadata?: unknown) => void } };
  calls: { message: string; metadata: Record<string, unknown> }[];
} => {
  const calls: { message: string; metadata: Record<string, unknown> }[] = [];
  return {
    calls,
    context: {
      log: {
        error: (message, metadata) => {
          calls.push({ message, metadata: { ...(metadata as object) } });
        },
      },
    },
  };
};

describe('logSqsRecordInvalid', () => {
  given('[case1] a record whose schema callback threw a raw Error', () => {
    when('[t0] the fault is logged', () => {
      const { context, calls } = genLogFake();
      const error = new Error('the refine callback broke');
      logSqsRecordInvalid({ id: 'msg-3', error }, context);

      then(
        'one error line names the id, the class, the cause, and the fate',
        () => {
          expect(calls).toHaveLength(1);
          expect(calls[0]).toMatchObject({
            message: 'sqs.record.invalid',
            metadata: {
              id: 'msg-3',
              class: 'Error',
              errorMessage: 'the refine callback broke',
              consequence:
                'redriven — a fault of ours, so sqs redrives this record alone',
            },
          });
        },
      );

      then('it carries the stack, for diagnosis', () => {
        expect(calls[0]?.metadata.stack).toEqual(error.stack);
      });

      // the stack holds absolute paths and line numbers, so it is masked before the snap
      then('the line an on-call engineer reads is pinned', () => {
        expect(
          calls.map((call) => ({
            ...call,
            metadata: { ...call.metadata, stack: '<stack>' },
          })),
        ).toMatchSnapshot();
      });
    });
  });

  given('[case2] an Error that carries no stack', () => {
    when('[t0] the fault is logged', () => {
      const { context, calls } = genLogFake();
      const error = new Error('the refine callback broke');
      delete error.stack; // `stack` is optional on an Error; a host may omit it

      logSqsRecordInvalid({ id: 'msg-3', error }, context);

      then('the stack field reads null, never undefined', () => {
        expect(calls[0]?.metadata.stack).toEqual(null);
      });
    });
  });
});
