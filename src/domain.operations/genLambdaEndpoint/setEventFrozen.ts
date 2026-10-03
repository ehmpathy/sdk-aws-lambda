import { MalfunctionError } from 'helpful-errors';
import { asFrozenDeep, type FrozenDeep } from 'type-fns';

/**
 * .what = seals the envelope before `invoke` receives it, in place, typed `FrozenDeep`
 * .why = the envelope outlives the handler's turn, so a write through it corrupts a value
 *        somebody else reads after `invoke` returns — with no type error and no throw. the freeze
 *        makes that unrepresentable
 *
 * .why every family freezes, with no exception = the membership rule is the hand-off, never the
 *        reader set. who reads the envelope after `invoke` differs per family — a vendor for
 *        `forApiGateway` (`@middy/http-cors` and `…response-serializer`, in their `after` hooks),
 *        the sdk itself for `forSqs.perBatch` (`idsInBatch` is built from `decoded.records` after
 *        `invoke`), and neither for `forSqs.perRecord` or `forAsk`. an empty column is a
 *        property of today, so a rule keyed to one expires silently the first commit that adds a
 *        post-invoke read (`rule.require.frozen-invoke-inputs`)
 *
 * .why type-fns' `asFrozenDeep` = the type and the runtime come from one package, so they cannot
 *        drift: what `FrozenDeep` refuses at compile time, `asFrozenDeep` refuses at run time. that
 *        includes the state a bare `Object.freeze` cannot reach — a `Date`, `Map`, `Set`, `WeakMap`,
 *        or `WeakSet` has its mutators replaced by throwers, and the walk reaches symbol keys and
 *        non-enumerable own props
 *
 * .note = in place, deliberately. `asFrozenDeep` returns the same reference, so
 *         `headers === event.headers` holds and the bag cannot drift from the envelope it projects
 *         (`domain.terms/event.md`). a defensive copy would remove the hazard and break the projection
 * .note = the projections freeze with it, by design: `headers`, `payload`, and `records` are the
 *         envelope's own slots, so a handler mutates none
 * .note = `forSqs.perBatch`'s harm is the sharpest, and `[case17]` walks it end to end: a handler
 *         that forges `event.records[n].id` would rewrite the set the unknown-id guard checks
 *         against, so sqs is answered with an `itemIdentifier` it cannot match
 *
 * .why a refusal is a `MalfunctionError` = `asFrozenDeep` refuses, all or none and before any
 *        freeze, a value it cannot seal: a typed array that holds bytes, a global or sticky
 *        `RegExp`. `JSON.parse` yields neither, so one reaches the envelope only when the handler's
 *        own schema builds it. that is a server fault, never the caller's, so it must not ride the
 *        caller-fault path a bare `ConstraintError` would take (`getIsConstraintError`). the
 *        type-fns refusal rides as `cause`, so its `path` and `hint` still name the fix
 */
export const setEventFrozen = <TEvent>(input: {
  event: TEvent;
}): FrozenDeep<TEvent> => {
  try {
    return asFrozenDeep(input.event);
  } catch (error) {
    // a non-error throw is no refusal of the walk; let it surface as-is
    if (!(error instanceof Error)) throw error;

    // a refusal: the handler's schema built a value the freeze cannot seal
    throw new MalfunctionError(
      'the event holds a value the invoke freeze cannot seal — the handler schema built it',
      { cause: error },
    );
  }
};
