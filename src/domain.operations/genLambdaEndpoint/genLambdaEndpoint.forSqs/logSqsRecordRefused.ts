import type { ContextLogTrail } from 'sdk-logs';

/**
 * .what = records that one sqs message was refused as a caller fault, and acknowledged
 * .why = an acknowledged message is deleted from the queue, so this line is the one durable trace
 *        of it. it names the message, the class, and the cause, so an operator can find the
 *        producer at fault
 *
 * .note = `class` reads `constructor.name`, the in-process class, and differs from the wire's
 *         `errorType` (`.name`) on purpose: an operator searches for the class the author threw,
 *         and helpful-errors 1.7.3 leaves `.name` at `'Error'` for every refusal. the wire must
 *         match the aws runtime; this line must name the cause. neither should copy the other
 * .note = warn, not error: the lambda ran as intended and the producer is at fault, so the invoke
 *         is a success, exactly as `simple-lambda-handlers`' `badRequestErrorMiddleware` treated it
 */
export const logSqsRecordRefused = (
  input: { id: string; error: Error },
  context: { log: Pick<ContextLogTrail['log'], 'warn'> },
): void => {
  context.log.warn('sqs.record.refused', {
    id: input.id,
    class: input.error.constructor.name,
    errorMessage: input.error.message,
    consequence: 'deleted only if this invoke succeeds; redriven if it fails',
  });
};
