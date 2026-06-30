import { ConstraintError } from 'helpful-errors';

/**
 * .what = error when a service has no lambda functions
 * .why = clear error that names the absent service per criteria
 *
 * .note = bare subclass per helpful-errors convention; pass message + metadata
 *         at the throw site via `new LambdaServiceNotFoundError(message, { ... })`
 */
export class LambdaServiceNotFoundError extends ConstraintError {}
