import type { ContextLogTrail } from 'sdk-logs';
import type { ZodSchema } from 'zod';

import { asCallerFault } from './asCallerFault';
import { logSqsRecordInvalid } from './logSqsRecordInvalid';
import { logSqsRecordRefused } from './logSqsRecordRefused';
import type {
  SqsHeadersDeclared,
  SqsHeadersMerged,
  SqsRecordDecoded,
} from './SqsEventDecoded';
import { setSqsRecordValidated } from './setSqsRecordValidated';

/**
 * .what = validates each record of a batch, and sorts the ones that fail by whose fault it is
 * .why = `perBatch` decides per record, so a refusal must be read where its id is in hand:
 *        - a caller fault is acknowledged — logged, and named in `idsRefused` so it stays out of
 *          `batchItemFailures` and sqs deletes it once (`invariant.constraint-errors-never-redrive-sqs`)
 *        - a server fault (a schema whose own callback throws) is logged loud and named in neither
 *          list, so that record alone is retried — one defect of ours never redrives the healthy
 *          records beside it
 *        - a throw that is not an `Error` carries no verdict on any record, so it escapes and the
 *          whole batch redrives
 *
 * .note = deliberate mutation — the two accumulators fill in one pass and are returned
 */
export const setSqsRecordsValidated = <
  THeaders extends SqsHeadersDeclared,
  TPayload,
>(
  input: {
    records: SqsRecordDecoded[];
    schema: ZodSchema<{ headers?: THeaders; payload: TPayload }>;
  },
  context: { log: Pick<ContextLogTrail['log'], 'warn' | 'error'> },
): {
  recordsValidated: SqsRecordDecoded<{
    headers: SqsHeadersMerged<THeaders>;
    payload: TPayload;
  }>[];
  idsRefused: Set<string>;
} => {
  const recordsValidated: SqsRecordDecoded<{
    headers: SqsHeadersMerged<THeaders>;
    payload: TPayload;
  }>[] = [];
  const idsRefused = new Set<string>();

  for (const record of input.records) {
    try {
      recordsValidated.push(
        setSqsRecordValidated({ record, schema: input.schema }),
      );
    } catch (error) {
      // a caller fault: acknowledge it, by id
      const callerFault = asCallerFault({ error });
      if (callerFault) {
        logSqsRecordRefused(
          { message: record._.raw, error: callerFault },
          context,
        );
        idsRefused.add(record.id);
        continue;
      }

      // a non-error throw is no verdict on this record; it escapes, and the batch redrives
      if (!(error instanceof Error)) throw error;

      // a server fault: logged loud; its omission from both lists IS its redrive, never a swallow
      logSqsRecordInvalid({ id: record.id, error }, context);
    }
  }

  return { recordsValidated, idsRefused };
};
