import type { ContextLogTrail } from 'sdk-logs';

import type { TranslateLog } from '../TranslateLog';
import { asRecordLogged } from './asRecordLogged';
import type { RecordSource } from './RecordSource';

/**
 * .what = records that one record was refused as a caller fault, and acknowledged
 * .why = an acknowledged record is gone from its source — deleted from the queue, dropped by sns, or
 *        passed by the shard checkpoint — so this line is the one durable trace of it. it names the
 *        record, the class, and the cause, so an operator can find the producer at fault, and it
 *        carries the full record as it arrived, so an operator can replay it from the log alone
 *
 * .note = `raw` is the untouched vendor record aws handed over (`record._.raw`), never the decoded
 *         record: validation writes parsed values back into the decoded record, so only the raw one
 *         still holds the wire body and the typed attributes a replay needs. for sqs its
 *         `attributes` carry the fifo `MessageGroupId` and `MessageDeduplicationId`, and its
 *         `eventSourceARN` names the queue to requeue into; for kinesis its `eventID` and
 *         `kinesis.sequenceNumber` name the position to replay from
 * .note = the raw record rides under the source's own noun — `message` for sqs and sns, `record` for
 *         kinesis — so the key reads as the word an operator searches for
 * .note = `class` reads `constructor.name`, the in-process class, and differs from the wire's
 *         `errorType` (`.name`) on purpose: an operator searches for the class the author threw,
 *         and helpful-errors 1.7.3 leaves `.name` at `'Error'` for every refusal. the wire must
 *         match the aws runtime; this line must name the cause. neither should copy the other
 * .note = the record passes through the author's `logTranslate.input` first (`asRecordLogged`), so
 *         a redaction the io logger honors holds on this line too; with no projection the record
 *         rides untouched
 * .note = warn, not error: the lambda ran as intended and the producer is at fault, so the invoke
 *         is a success, exactly as `simple-lambda-handlers`' `badRequestErrorMiddleware` treated it
 */
export const logRecordRefused = (
  input: {
    source: RecordSource;
    id: string;
    raw: unknown;
    error: Error;
    logTranslate: TranslateLog | null;
  },
  context: { log: Pick<ContextLogTrail['log'], 'warn'> },
): void => {
  context.log.warn(`${input.source.name}.record.refused`, {
    id: input.id,
    class: input.error.constructor.name,
    errorMessage: input.error.message,
    consequence: input.source.consequenceRefused,
    [input.source.noun]: asRecordLogged({
      raw: input.raw,
      logTranslate: input.logTranslate,
    }),
  });
};
