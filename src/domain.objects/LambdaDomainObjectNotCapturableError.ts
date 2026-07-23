import { ConstraintError } from 'helpful-errors';

/**
 * .what = error when a contract-surfaced domain-object cannot be captured
 * .why = a dobj referenced by an endpoint that declares no `static schema` has no
 *        shape to reconstruct; fail loud and name the dobj (uc.9) rather than
 *        silently drop it
 *
 * .note = bare subclass per helpful-errors convention; pass message + metadata
 *         at the throw site via `new LambdaDomainObjectNotCapturableError(message, { ... })`
 */
export class LambdaDomainObjectNotCapturableError extends ConstraintError {}
