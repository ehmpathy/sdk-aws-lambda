import type { SQSRecord } from 'aws-lambda';
import type { ContextLogTrail } from 'sdk-logs';

/**
 * .what = records that one sqs message was refused as a caller fault, and acknowledged
 * .why = an acknowledged message is deleted from the queue, so this line is the one durable trace
 *        of it. it names the message, the class, and the cause, so an operator can find the
 *        producer at fault, and it carries the full message as it arrived, so an operator can
 *        requeue it from the log alone
 *
 * .note = `message` is the untouched `SQSRecord` aws handed over (`record._.raw`), never the
 *         decoded record: validation writes parsed values back into the decoded record, so only
 *         the raw one still holds the wire body and the typed `messageAttributes` a requeue needs.
 *         its `attributes` carry the fifo `MessageGroupId` and `MessageDeduplicationId`, and its
 *         `eventSourceARN` names the queue to requeue into
 * .note = `class` reads `constructor.name`, the in-process class, and differs from the wire's
 *         `errorType` (`.name`) on purpose: an operator searches for the class the author threw,
 *         and helpful-errors 1.7.3 leaves `.name` at `'Error'` for every refusal. the wire must
 *         match the aws runtime; this line must name the cause. neither should copy the other
 * .note = warn, not error: the lambda ran as intended and the producer is at fault, so the invoke
 *         is a success, exactly as `simple-lambda-handlers`' `badRequestErrorMiddleware` treated it
 */
export const logSqsRecordRefused = (
  input: { message: SQSRecord; error: Error },
  context: { log: Pick<ContextLogTrail['log'], 'warn'> },
): void => {
  context.log.warn('sqs.record.refused', {
    id: input.message.messageId,
    class: input.error.constructor.name,
    errorMessage: input.error.message,
    consequence: 'deleted only if this invoke succeeds; redriven if it fails',
    message: input.message,
  });
};
