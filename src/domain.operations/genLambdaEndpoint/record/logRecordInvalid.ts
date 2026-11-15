import type { ContextLogTrail } from 'sdk-logs';

import type { RecordSourceBatched } from './RecordSource';

/**
 * .what = records that one record met a fault of ours in validation, and is retried
 * .why = the record redrives, so without a loud line a schema defect hides behind retries. this
 *        names the record, the class, the cause, and the stack, so an on-call engineer can find it
 *
 * .note = error, not warn: the fault is ours — a schema whose own callback threw — never the
 *         producer's. the peer `logRecordRefused` is the warn for a caller fault
 * .note = only a per-batch variant meets this, so it takes a source that batches
 */
export const logRecordInvalid = (
  input: { source: RecordSourceBatched; id: string; error: Error },
  context: { log: Pick<ContextLogTrail['log'], 'error'> },
): void => {
  context.log.error(`${input.source.name}.record.invalid`, {
    id: input.id,
    class: input.error.constructor.name,
    errorMessage: input.error.message,
    stack: input.error.stack ?? null,
    consequence: input.source.consequenceInvalid,
  });
};
