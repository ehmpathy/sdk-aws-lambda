import { ConstraintError } from 'helpful-errors';

/**
 * .what = error when a domain-object REFERENCE names a dobj that is not captured in
 *         full anywhere in the service's contracts, so the generated `typeof
 *         Svc<Prefix><Name>` cannot bind
 * .why = a ref emits `RefByPrimary<typeof SvcSurfSeaturtle>`; that resource must
 *        exist. if no endpoint surfaces the referenced dobj whole, the generated sdk
 *        would not compile — fail loud (caller must surface the dobj on an endpoint)
 *
 * .note = bare subclass per helpful-errors convention; pass message + metadata at
 *         the throw site via `new LambdaDomainObjectRefUnbindableError(message, { ... })`
 */
export class LambdaDomainObjectRefUnbindableError extends ConstraintError {}
