/**
 * .what = the type of what `setEventFrozen` produces — readonly all the way down
 * .why = typescript's own `Readonly<T>` is shallow, so it refuses `event.x = 1` and allows
 *        `event.headers.x = 1`. the runtime freeze below is deep, so the two would disagree: a
 *        write one level in type-checks cleanly and then throws a `TypeError` in production,
 *        which turns a well-typed handler into a 500
 * .why here = it is named for the mechanism it types (`setFrozenDeep`), so the contract and its
 *        enforcement sit in one file and cannot drift apart
 *
 * .note = a function passes through unmapped. `Object.freeze` does freeze a function, but to map
 *         over one would discard its call signature — and no field of this envelope is a
 *         function, so the arm is free and it guards the general case
 * .note = `readonly` is a compile-time refusal only; it erases at runtime. the freeze is what
 *         enforces it, and this type is what announces it — neither replaces the other
 *         (`rule.prefer.prevent-over-correct`: refuse it at rung 1, report it at rung 4)
 */
export type FrozenDeep<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends ReadonlyArray<infer TItem>
    ? ReadonlyArray<FrozenDeep<TItem>>
    : T extends object
      ? { readonly [TKey in keyof T]: FrozenDeep<T[TKey]> }
      : T;

/**
 * .what = freezes a value and every object it reaches, in place
 * .why = `Object.freeze` alone is shallow, so it would leave `event.headers` writable — and
 *        `headers` is exactly the object `@middy/http-cors` reads in its `after` hook
 *        (`@middy/http-cors/index.js:83`), after the handler has returned
 *
 * .why not `withImmute` = `domain-objects` ships a recursive helper whose name reads as this
 *        mechanism and is not it. measured in its dist (`withImmute.js:9-22,27-31`,
 *        domain-objects@0.33.0): it adds a `.clone()` — an affordance rather than an enforcement,
 *        so a write still succeeds — and it applies only where `isOfDomainObject(value)` holds,
 *        so on this plain-interface envelope it is a total no-op
 *
 * .note = in place, deliberately. a defensive copy would remove the same hazard and destroy the
 *         projection: `headers === event.headers` would stop to hold, and the bag could drift
 *         from the envelope it claims to project (`domain.terms/event.md`)
 */
const setFrozenDeep = (value: unknown, seen: WeakSet<object>): void => {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  Object.freeze(value);

  // recurse over the OWN values only; a prototype belongs to whoever declared it
  for (const nested of Object.values(value)) setFrozenDeep(nested, seen);
};

/**
 * .what = seals the envelope before `invoke` receives it
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
 * .why the cost is paid on purpose = `FrozenDeep<TInput>` makes `event` unassignable to every
 *        mutable parameter a handler forwards it to, so a handler must declare its sinks
 *        readonly. a guarantee that holds on three variants of four is a trap for whoever moves
 *        between them
 *
 * .where = the family root rather than inside `forApiGateway`, because two variants of one family
 *         reach for it. lifted on the second use (`rule.prefer.most-common-denominator`)
 *
 * .note = the projections freeze with it, by design: `headers`, `payload`, and `records` are the
 *         envelope's own slots, so a handler mutates none (`domain.terms/event.md`)
 * .note = `forSqs.perBatch`'s harm is the sharpest, and `[case17]` walks it end to end: a handler
 *         that forges `event.records[n].id` would rewrite the set the unknown-id guard checks
 *         against, so the guard passes and sqs is answered with an `itemIdentifier` it cannot
 *         match — the message the author meant to save is deleted, on a successful invocation
 *
 * .why a `WeakSet` = an envelope and its `_.raw` share sub-objects, so each is reachable by two
 *         paths and would otherwise be walked twice. measured in both families:
 *
 *           apiGateway -> `queryStringParameters` and `pathParameters` pass by reference
 *                         (`asApiGatewayRequestEventUnified.ts:68-69`)
 *           sqs        -> `wire.Records[n]` is reachable as `event._.raw.Records[n]` and as
 *                         `event.records[n]._.raw` (`asSqsEventDecoded.ts:37`,
 *                         `asSqsRecordDecoded.ts:94`)
 *
 *         it is not a cycle guard. no cycle is reachable from this event — `requestContext` is an
 *         explicit four-field copy of primitives and `headers` is a new object — though the set
 *         would terminate one a later author introduced
 *
 * .note = a frozen write throws in strict mode and no-ops in sloppy mode. every module this sdk
 *         ships is an es module, which is strict by construction, so the throw is the behavior a
 *         consumer meets (ecma-262 §11.2.2)
 * .note = the throw's message is terse — node raises a bare `TypeError: Cannot assign to read
 *         only property …`, which names no cause and no remedy. `Object.freeze` accepts no
 *         message, and the only mechanism that could supply one is a `Proxy` — a different
 *         object, so `headers === event.headers` would stop to hold. the remedy is prevention
 *         instead: `FrozenDeep` refuses the write at compile time, so a type-checked consumer
 *         never reaches the message (`rule.prefer.prevent-over-correct`)
 *
 * .why it returns = the same reference, narrowed to `FrozenDeep`. it still freezes in place — the
 *         return is the type half of one act, so a caller receives the guarantee from the step
 *         that establishes it rather than asserts it by hand at the hand-off
 */
export const setEventFrozen = <TEvent>(input: {
  event: TEvent;
}): FrozenDeep<TEvent> => {
  setFrozenDeep(input.event, new WeakSet());

  /**
   * .why the cast = `FrozenDeep<TEvent>` is a conditional type, so on an unresolved generic
   *        typescript defers it and cannot prove `TEvent` satisfies it — a limit of the checker,
   *        never a gap in the claim. the line above is the proof, and it runs first
   *
   * .why here = this is the one named transformer whose whole job is the narrowing, so the
   *        assertion sits at the single seam that earns it rather than at every call site
   *        (`rule.forbid.as-cast` — an `as` at a boundary, documented, with its removal named)
   *
   * .removal = drops if typescript ever proves a homomorphic mapped type against its own input
   */
  return input.event as FrozenDeep<TEvent>;
};
