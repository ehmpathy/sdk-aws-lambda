import { getIsConstraintError } from '../middleware/getIsConstraintError';

/**
 * .what = the thrown value as a caller fault, or null when it is not one
 * .why = both sqs variants decide delete-vs-redrive on this one answer, so it is stated once: a
 *        variant that disagreed would delete a message its peer redrives
 *        (`invariant.constraint-errors-never-redrive-sqs`)
 *
 * .note = a caller fault is an `Error` that `getIsConstraintError` accepts — a `ConstraintError`,
 *         a `BadRequestError`, or a subclass. any other value, a bare `{ name }` bag included, is
 *         null, so the miss fails toward a retry
 * .note = returns the value narrowed to `Error`, so a caller can log it without a second guard
 */
export const asCallerFault = (input: { error: unknown }): Error | null =>
  input.error instanceof Error && getIsConstraintError({ error: input.error })
    ? input.error
    : null;
