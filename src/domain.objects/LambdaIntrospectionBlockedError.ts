import { ConstraintError } from 'helpful-errors';

/**
 * .what = error when introspection is blocked (non-prep environment)
 * .why = clear error when introspection attempted outside prep
 *
 * .note = bare subclass per helpful-errors convention; pass message + metadata
 *         at the throw site via `new LambdaIntrospectionBlockedError(message, { ... })`
 */
export class LambdaIntrospectionBlockedError extends ConstraintError {}
