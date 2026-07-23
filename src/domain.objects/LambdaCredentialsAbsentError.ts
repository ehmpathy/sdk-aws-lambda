import { ConstraintError } from 'helpful-errors';

/**
 * .what = error when the aws sdk cannot load credentials for introspection
 * .why = a clear, caller-must-fix error (with an unlock hint) instead of a raw
 *        aws CredentialsProviderError; introspection needs live prep creds
 *
 * .note = bare subclass per helpful-errors convention; pass message + metadata
 *         at the throw site via `new LambdaCredentialsAbsentError(message, { ... })`
 */
export class LambdaCredentialsAbsentError extends ConstraintError {}
