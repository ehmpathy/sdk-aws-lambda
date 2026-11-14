import { getIsConstraintError } from './getIsConstraintError';

/**
 * .what = the thrown value as a caller fault, or null when it is not one
 * .why = every family that acts on a caller fault decides on this one answer, so it is stated
 *        once: both sqs variants decide delete-vs-redrive on it (a variant that disagreed would
 *        delete a message its peer redrives, `invariant.constraint-errors-never-redrive-sqs`),
 *        and `forAsk` decides on it whether a dropped aws event owes its warn line
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
