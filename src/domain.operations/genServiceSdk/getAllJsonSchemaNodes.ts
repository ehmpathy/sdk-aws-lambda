/**
 * .what = every object node in a json-schema tree, in pre-order
 * .why = three call sites each hand-rolled this identical recursive descent, which clears
 *        `rule.prefer.wet-over-dry`'s rule-of-three by a wide margin. each one wanted the
 *        SAME traversal and a DIFFERENT thing per node, so the walk was all they shared
 *
 * .the three it replaces:
 *   - `collectRefNames`     — `gen.resource/assertAllDomainObjectRefsBind.ts`
 *   - `collectFromNode`     — `gen.resource/getAllDomainObjectsFromContracts.ts`
 *   - `collectRefGenerics`  — `gen.mechanism/getTypescriptFromJsonSchema.ts`
 *
 * .why it returns a LIST rather than takes a `visit` callback = a list turns each caller's
 *        body into a flat `for` loop it can read in one pass. a callback keeps the inversion
 *        of control the hand-rolled recursion already had, so it would have collapsed the
 *        duplication and left the decode cost (`rule.forbid.inline-decode-friction`), and
 *        its name would have had to start with a verb the repo does not sanction
 *        (`rule.require.get-set-gen-verbs`)
 *
 * .why it lives HERE = `gen.resource/` and `gen.mechanism/` are the two consumers, so
 *        `genServiceSdk/` is their common ancestor (`rule.prefer.most-common-denominator`).
 *        it is not lifted higher: no third subtree asks for it
 *
 * ⚠️ .why PRE-ORDER is part of the contract = one caller
 *    (`getAllDomainObjectsFromContracts`) keeps the FIRST capture of a repeated name and
 *    throws on the first uncapturable one, so the order a node is met in is observable. a
 *    post-order or breadth-first walk would change which duplicate wins and which node the
 *    throw names
 *
 * .note = it descends EVERY value of every object, so `properties`, `items`, `$defs`,
 *         `anyOf`, and any keyword a future zod emits are all reached with no edit here.
 *         that is the property the three hand-rolled copies each had, and each had to keep
 *
 * ⚠️ .why a VISITED set = a graph that cycles by IDENTITY has no base case here, so the
 *    descent recurses until the stack blows — a `RangeError` with no diagnostic, at all
 *    three consumers at once. the three hand-rolled copies each carried the same hole;
 *    one shared walk is what lets ONE guard close it (that correctness fix is the payoff
 *    the extraction was argued on, so it belongs here rather than deferred)
 *
 *      - today's real inputs are acyclic: `z.toJSONSchema` emits a self-reference as the
 *        STRING `'#'`, which is a leaf, so no shipped fixture reaches the guard
 *      - ⇒ so this guards against a shape zod does not emit TODAY, and against the
 *        hand-built fixture that a caller of this now-shared primitive may hand it
 *
 * ⚠️ .the consequence is WIDER than a cycle, and it is deliberate = the set dedupes by
 *    REFERENCE, so a DAG — one object reachable by two distinct paths — is now recorded
 *    ONCE rather than twice. measured against all three consumers before it landed:
 *
 *      - `assertAllDomainObjectRefsBind`    -> `referencedNames.add(ref.of)`   — a Set
 *      - `getAllDomainObjectsFromContracts` -> a Map keyed by name, first wins — set-like
 *      - `getTypescriptFromJsonSchema`      -> `used.add(REF_GENERIC_BY[…])`   — a Set
 *
 *    ⇒ every one accumulates set-semantically by NAME, so a second visit to the SAME
 *      object adds no entry any of them can observe. a caller that COUNTED nodes would
 *      observe it, and no such caller exists — `[case6]` states the property so a future
 *      one meets it as a contract rather than as a surprise
 */
export const getAllJsonSchemaNodes = (input: { root: unknown }): object[] => {
  const nodes: object[] = [];

  // track nodes already recorded, so a cycle terminates and a DAG is not double-counted
  const visited = new WeakSet<object>();

  const descend = (node: unknown): void => {
    // skip leaves — a string, a number, a boolean, a null carries no node
    if (typeof node !== 'object' || node === null) return;

    // stop at a node already met, so a cycle by identity terminates rather than overflows
    if (visited.has(node)) return;
    visited.add(node);

    // record this node BEFORE its children, so the list reads in pre-order
    nodes.push(node);

    // descend into every child value, arrays and nested objects alike
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (Array.isArray(value)) for (const item of value) descend(item);
      else descend(value);
    }
  };

  descend(input.root);
  return nodes;
};
