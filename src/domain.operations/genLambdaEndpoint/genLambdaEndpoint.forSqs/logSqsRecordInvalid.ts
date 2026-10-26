import type { ContextLogTrail } from 'sdk-logs';

/**
 * .what = records that one sqs record met a fault of ours in validation, and is retried
 * .why = the record redrives, so without a loud line a schema defect hides behind retries. this
 *        names the message, the class, the cause, and the stack, so an on-call engineer can find it
 *
 * .note = error, not warn: the fault is ours — a schema whose own callback threw — never the
 *         producer's. the peer `logSqsRecordRefused` is the warn for a caller fault
 */
export const logSqsRecordInvalid = (
  input: { id: string; error: Error },
  context: { log: Pick<ContextLogTrail['log'], 'error'> },
): void => {
  context.log.error('sqs.record.invalid', {
    id: input.id,
    class: input.error.constructor.name,
    errorMessage: input.error.message,
    stack: input.error.stack ?? null,
    consequence:
      'redriven — a fault of ours, so sqs redrives this record alone',
  });
};
