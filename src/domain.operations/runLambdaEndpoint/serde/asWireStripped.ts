import { ConstraintError, MalfunctionError } from 'helpful-errors';

import { isErrorLike } from '../error/isErrorLike';

/**
 * .what = casts a live object into the shape a json wire would deliver
 * .why = the referenced boundary crosses no wire, so a Date, a class instance,
 *        or an `undefined` would survive into the handler — data the serialized
 *        boundary could never deliver.
 *
 *        this is a FIDELITY GUARD, never the boundary itself. it keeps a test on
 *        the referenced boundary from a pass that the serialized boundary would fail.
 *
 * .note = applied in BOTH directions. aws serializes the response too, so an
 *         input-only strip would let a test assert on an output shape the wire
 *         could never deliver — the same hole, pointed the other way.
 *
 * .of = which side is stripped, and it is REQUIRED because it decides who owns
 *       a refusal:
 *
 *       | `of` | the value is | a refusal is | the class |
 *       |------|--------------|--------------|-----------|
 *       | `'event'`  | what the CALLER passed  | the caller's fault | `ConstraintError` |
 *       | `'output'` | what the HANDLER returned | the server's fault | `MalfunctionError` |
 */
export const asWireStripped = <T>(input: {
  value: T;
  of: 'event' | 'output';
}): T => {
  /**
   * .what = undefined has no json representation, so it is returned as-is
   * .why = `JSON.stringify(undefined)` yields `undefined`, which `JSON.parse`
   *        then refuses. so the round trip below cannot carry this case.
   *
   * .as = the cast is sound rather than a shapefit dodge: `value` is typed `T`,
   *       so `value === undefined` proves `undefined` inhabits `T`. typescript
   *       cannot carry that proof out of the narrow on an unresolved generic.
   * .removal = drops out if typescript narrows a generic by an equality check
   */
  if (input.value === undefined) return undefined as T;

  try {
    /**
     * .as = JSON round-trip erases the type at runtime while the shape survives
     * .removal = if typescript gains a JsonOf<T> mapped type, narrow the return
     */
    return JSON.parse(JSON.stringify(input.value)) as T;
  } catch (error) {
    // 🔴 the THROW is correct — aws serializes the payload too and would refuse
    //    the same value, so a circular reference or a bigint must not pass here.
    //    it rethrows and swallows naught (`rule.forbid.failhide`); what must not
    //    escape is a bare TypeError, which names neither the strip nor why it
    //    exists (`rule.require.errors-name-the-fix`).
    //
    // 🔴 the FAULT OWNER is decided by `of`, never guessed. a MESSAGE can name
    //    both sides in one sentence; a CLASS cannot — it is a single claim about
    //    who must fix the fault, so a guessed one is wrong half the time. a
    //    caller who hands a circular event would get `MalfunctionError`, which in
    //    this domain reads as *"the handler ran and broke"*
    //    (`invariant.badrequesterror-not-lambda-error`).
    //
    //    ⇒ and `of` costs two call sites, both in `onReferenced` — one per side,
    //      each of which knows its own. with the direction known the message
    //      sharpens too, so no two-way hint is owed.
    //
    // duck-type rather than `instanceof Error` — jest runs each module in its own
    // vm context, so a cross-realm error fails the prototype check and would
    // degrade to `new Error(String(error))`, which loses the real constructor
    // name and stack.
    //
    // 🟡 the predicate is shared rather than inline — three call sites read it,
    //    each with its own return contract, and a fork between any two is silent.
    const cause = isErrorLike(error) ? error : new Error(String(error));

    if (input.of === 'event')
      return ConstraintError.throw(
        'the event given cannot cross the wire — json refused to serialize it',
        {
          cause,
          hint: 'a circular reference or a bigint cannot reach a lambda. check the event you passed. aws would refuse the same payload, so it refuses here rather than let a test pass on a value the wire could never deliver.',
        },
      );

    throw new MalfunctionError(
      'the handler returned a value that cannot cross the wire — json refused to serialize it',
      {
        cause,
        hint: 'a circular reference or a bigint cannot leave a lambda. check the value your handler returned. aws would refuse the same response, so it refuses here rather than let a test assert on an output the wire could never deliver.',
      },
    );
  }
};
