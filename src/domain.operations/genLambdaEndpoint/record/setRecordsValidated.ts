import type { ContextLogTrail } from 'sdk-logs';
import type { ZodSchema } from 'zod';

import { asCallerFault } from '../middleware/asCallerFault';
import type { TranslateLog } from '../TranslateLog';
import { logRecordInvalid } from './logRecordInvalid';
import { logRecordRefused } from './logRecordRefused';
import type {
  RecordDecodedOfSource,
  RecordHeadersDeclared,
} from './RecordDecoded';
import type { RecordSourceBatched } from './RecordSource';
import { setRecordValidated } from './setRecordValidated';

/**
 * .what = validates each record of a batch, and sorts the ones that fail by whose fault it is
 * .why = a per-batch variant decides per record, so a refusal must be read where its id is in hand:
 *        - a caller fault is acknowledged — logged, and named in `idsRefused` so it stays out of
 *          `batchItemFailures` and the source lets it go once
 *          (`invariant.constraint-errors-never-redrive-sqs`)
 *        - a server fault (a schema whose own callback throws) is logged loud and named in neither
 *          list, so that record is retried — one defect of ours never acknowledges a record it
 *          never judged
 *        - a throw that is not an `Error` carries no verdict on any record, so it escapes and the
 *          whole batch redrives
 *
 * .note = deliberate mutation — the two accumulators fill in one pass and are returned
 */
export const setRecordsValidated = <
  TRecord extends RecordDecodedOfSource,
  THeaders extends RecordHeadersDeclared,
  TPayload,
>(
  input: {
    source: RecordSourceBatched;
    records: TRecord[];
    schema: ZodSchema<{ headers?: THeaders; payload: TPayload }>;
    deserialize: { payload: boolean };
    logTranslate: TranslateLog | null;
  },
  context: { log: Pick<ContextLogTrail['log'], 'warn' | 'error'> },
): {
  recordsValidated: TRecord[];
  idsRefused: Set<string>;
} => {
  const recordsValidated: TRecord[] = [];
  const idsRefused = new Set<string>();

  for (const record of input.records) {
    try {
      recordsValidated.push(
        setRecordValidated({
          record,
          schema: input.schema,
          deserialize: input.deserialize,
        }),
      );
    } catch (error) {
      // a caller fault: acknowledge it, by id
      const callerFault = asCallerFault({ error });
      if (callerFault) {
        logRecordRefused(
          {
            source: input.source,
            id: record.id,
            raw: record._.raw,
            error: callerFault,
            logTranslate: input.logTranslate,
          },
          context,
        );
        idsRefused.add(record.id);
        continue;
      }

      // a non-error throw is no verdict on this record; it escapes, and the batch redrives
      if (!(error instanceof Error)) throw error;

      // a server fault: logged loud; its omission from both lists IS its redrive, never a swallow
      logRecordInvalid({ source: input.source, id: record.id, error }, context);
    }
  }

  return { recordsValidated, idsRefused };
};
