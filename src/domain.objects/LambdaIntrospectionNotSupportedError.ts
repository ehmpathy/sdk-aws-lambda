import { ConstraintError } from 'helpful-errors';

/**
 * .what = the distinct reasons a lambda does not support introspection
 * .why = lets the error state WHY introspection failed, not just that it did
 *   - handler-error = the handler threw on the introspect payload
 *   - empty-payload = the invoke returned no payload
 *   - non-schema-payload = the payload was not a json-schema envelope
 */
export type LambdaIntrospectionNotSupportedReason =
  | 'handler-error'
  | 'empty-payload'
  | 'non-schema-payload';

/**
 * .what = error when a lambda does not support introspection
 * .why = clear error to separate "no support" from "not found"
 *
 * .note = bare subclass per helpful-errors convention; pass message + metadata
 *         (incl. the `reason`) at the throw site
 */
export class LambdaIntrospectionNotSupportedError extends ConstraintError {}
