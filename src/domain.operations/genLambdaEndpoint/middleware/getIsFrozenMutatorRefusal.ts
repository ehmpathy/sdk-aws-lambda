/**
 * .what = decides if an error is the invoke freeze's refusal of a mutator call
 * .why = the freeze (`asFrozenDeep`, via `setEventFrozen`) replaces each mutator of a frozen `Date`,
 *        `Map`, `Set`, `WeakMap`, `WeakSet`, `DataView`, `RegExp`, or `ArrayBuffer` with a thrower,
 *        and that thrower raises a `ConstraintError`. at type-fns' boundary that is correct — its
 *        caller misused the value. at this sdk's boundary its caller is the HANDLER, so the refusal
 *        is a server fault: the lambda's caller sent a valid request and must never be told
 *        otherwise (`invariant.badrequesterror-not-lambda-error`)
 *
 * .note = matched by shape, never by class: type-fns throws a plain `ConstraintError` with no
 *         subclass of its own, and it may load a separate `helpful-errors` instance. the shape is
 *         the metadata it stamps (`{ kind, mutator }`) plus a message that names that mutator, so a
 *         handler's own `ConstraintError` with a coincident key does not match
 */
export const getIsFrozenMutatorRefusal = (input: {
  error: unknown;
}): boolean => {
  // not an error at all
  if (!(input.error instanceof Error)) return false;

  // the refusal stamps `{ kind, mutator }`, both strings
  const metadata = (input.error as { metadata?: unknown }).metadata as
    | { kind?: unknown; mutator?: unknown }
    | undefined;
  if (typeof metadata?.kind !== 'string') return false;
  if (typeof metadata?.mutator !== 'string') return false;

  // and its message names that kind and that mutator
  return input.error.message.includes(
    `a frozen ${metadata.kind} refuses .${metadata.mutator}()`,
  );
};
