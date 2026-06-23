import { BadRequestError, ConstraintError } from 'helpful-errors';

/**
 * .what = decides if error is a constraint error via thorough check
 * .why = robust detection for cross-boundary error response
 *
 * .note = detects both ConstraintError and BadRequestError for backwards compat
 *
 * checks: instanceof, name, prototype chain
 */
export const getIsConstraintError = (input: { error: unknown }): boolean => {
  const error = input.error;

  // not an error at all
  if (!(error instanceof Error)) return false;

  // direct instanceof check (ConstraintError and BadRequestError for backwards compat)
  if (error instanceof ConstraintError) return true;
  if (error instanceof BadRequestError) return true;

  // name check (for serialized/deserialized errors)
  if (error.name === 'ConstraintError') return true;
  if (error.name === 'BadRequestError') return true;

  // prototype chain check (for edge cases with multiple module instances)
  if (
    decideHasConstraintErrorInPrototypeChain({
      proto: Object.getPrototypeOf(error),
    })
  )
    return true;

  return false;
};

/**
 * .what = recursive prototype chain check for constraint errors
 * .why = immutable traversal of prototype chain
 *
 * .note = checks for both ConstraintError and BadRequestError for backwards compat
 */
const decideHasConstraintErrorInPrototypeChain = (input: {
  proto: unknown;
}): boolean => {
  const proto = input.proto as { constructor?: { name?: string } } | null;
  if (!proto) return false;
  if (proto.constructor?.name === 'ConstraintError') return true;
  if (proto.constructor?.name === 'BadRequestError') return true;
  return decideHasConstraintErrorInPrototypeChain({
    proto: Object.getPrototypeOf(proto),
  });
};
