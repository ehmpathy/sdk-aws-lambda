import { ConstraintError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import { logSqsRecordRefused } from './logSqsRecordRefused';

/**
 * .what = a warn that records each call, injected through context
 * .why = the refusal line is the one durable trace of a deleted message, so its exact shape is
 *        the operator's contract; a fake keeps the read pure and deterministic
 * .note = deliberate mutation in a `const` box — the calls land from inside the operation
 */
const genLogFake = (): {
  context: { log: { warn: (message: string, metadata?: unknown) => void } };
  calls: { message: string; metadata: unknown }[];
} => {
  const calls: { message: string; metadata: unknown }[] = [];
  return {
    calls,
    context: {
      log: {
        warn: (message, metadata) => {
          calls.push({ message, metadata });
        },
      },
    },
  };
};

describe('logSqsRecordRefused', () => {
  given('[case1] a message refused with a ConstraintError', () => {
    when('[t0] the refusal is logged', () => {
      const { context, calls } = genLogFake();
      logSqsRecordRefused(
        { id: 'msg-7', error: new ConstraintError('order withdrawn') },
        context,
      );

      then(
        'one warn line names the id, the class, the cause, and the fate',
        () => {
          expect(calls).toEqual([
            {
              message: 'sqs.record.refused',
              metadata: {
                id: 'msg-7',
                class: 'ConstraintError',
                errorMessage: '✋ ConstraintError: order withdrawn', // helpful-errors heads its message with the class
                consequence:
                  'deleted only if this invoke succeeds; redriven if it fails',
              },
            },
          ]);
        },
      );

      // the same line as a reviewable artifact, beside its peer `logSqsRecordInvalid`'s snapshot
      then('the line an operator reads is pinned', () => {
        expect(calls).toMatchSnapshot();
      });
    });
  });
});
