import type { ContextLogTrail } from 'sdk-logs';

import { getIsConstraintError } from './getIsConstraintError';

/**
 * .what = picks the log method a failure is written with: warn for a caller fault, error for all else
 * .why = a failure must never log at debug beside a success. the invocation of a handled failure
 *        still reads a success to aws, so the log level is the only signal on-call has
 *        (sdk-aws-lambda#77: 24 prod failures hid at debug)
 *
 * .note = where trail has not yet put a `log` on the context — a `before` hook that throws ahead
 *         of it — this falls back to `console`, as `genInternalServiceErrorMiddleware` does, so no
 *         observed failure goes unlogged
 * .note = returns a call bound to its own sink, never a bare method reference, so the method runs
 *         with its receiver whatever the log's implementation reads from `this`
 */
export const asLogMethodOfFailure = (input: {
  error: unknown;
  log: ContextLogTrail['log'] | null;
}): ((message: string, metadata: Record<string, unknown>) => void) => {
  const sink = input.log ?? console;

  // a caller fault is the caller's to fix, so someone should look soon — never wake anyone
  if (getIsConstraintError({ error: input.error }))
    return (message, metadata) => sink.warn(message, metadata);

  // every other fault is ours to fix
  return (message, metadata) => sink.error(message, metadata);
};
