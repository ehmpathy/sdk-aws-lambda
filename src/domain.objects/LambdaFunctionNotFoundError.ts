import { ConstraintError } from 'helpful-errors';

/**
 * .what = error when a lambda function does not exist
 * .why = clear error that names the absent function per criteria
 *
 * .note = bare subclass per helpful-errors convention; pass message + metadata
 *         at the throw site via `new LambdaFunctionNotFoundError(message, { ... })`
 */
export class LambdaFunctionNotFoundError extends ConstraintError {}
