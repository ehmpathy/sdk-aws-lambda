/**
 * .what = narrows an `unknown` catch value to an `Error`, by SHAPE rather than
 *         by prototype
 * .why = 🔴 `instanceof Error` is unreliable across this util's own boundaries,
 *        and the failure is silent.
 *
 *        jest runs each module in its own vm context, so an `Error` thrown in
 *        one realm fails the prototype check in another. the check does not
 *        error — it returns `false`, and every site then degrades to a
 *        stringified fallback that drops the constructor name and the stack.
 *
 * 🔴 **this exists because the same duck-type has THREE call sites, and a fork
 *    between any two of them is silent.**
 *
 *    | site | what it wanted |
 *    |---|---|
 *    | `runLambdaEndpoint.onSerialized.ts` (`asWireFunctionErrorPayload`) | `message` · `stack` · `constructor.name` |
 *    | `serde/asWireStripped.ts` | the whole `Error`, to hang as a `cause` |
 *    | `local/getOneHandlerFromServerlessYml.ts` | `message`, to branch on a text match |
 *
 *    ⇒ `rule.prefer.wet-over-dry`'s own threshold: 1 usage inline, 2 copy-paste,
 *      **3+ consider the abstraction**. it reached three.
 *
 * .note = the risk this prices is a FOURTH site, not duplication:
 *
 *   > *"cross-realm boundaries are endemic to this local-locus/jest
 *   > architecture, so a 4th is likely … [and] has no canonical pattern to reach
 *   > for and will probably write a 4th slightly-different variant."*
 *
 *   ✅ **and a fork between copies is measured, not hypothetical.** the three
 *      sites above each want a different return: the value cast to `Error`, a
 *      fresh `Error`, a bare string with `''` as its fallback. same predicate,
 *      three contracts.
 *
 * .note = it is a PREDICATE rather than three getters, and that is what lets one
 *   operation serve all three sites: a narrow to `Error` gives each caller the
 *   field it wants, typed, with no second import
 *   (`rule.require.assure-via-type-checks`, `rule.require.get-set-gen-verbs`'s
 *   `is*` prefix).
 *
 * .note = it lives at `runLambdaEndpoint/` rather than higher because all three
 *   consumers do (`rule.prefer.most-common-denominator`: lift to the common
 *   ancestor of the callers that exist, never past it).
 *
 * ⚠️ **the shape it tests is `.message`, and that is deliberate.** `.stack` is
 *   optional on a real `Error` and absent on a plain thrown object; `.name` is
 *   present on a bare `{ name }` bag. `.message` as a string is the one field
 *   every `Error` carries and few impostors do.
 */
export const isErrorLike = (value: unknown): value is Error =>
  typeof (value as { message?: unknown })?.message === 'string';
