import { onReferenced } from './runLambdaEndpoint.onReferenced';
import { onSerialized } from './runLambdaEndpoint.onSerialized';

/**
 * .what = runs a lambda endpoint, on either side of the RUN BOUNDARY
 * .why = to run an endpoint, shapes must cross a boundary into it. they cross one
 *        of two ways, and the way they cross is a domain axis
 *        (define.lambda-endpoint-run-boundary)
 *
 * | boundary | shapes cross as | you hold |
 * |----------|-----------------|----------|
 * | **serialized** | json over a wire (real or simulated) | the endpoint's **slug** |
 * | **referenced** | live object references, same process | the handler **function** |
 *
 * ```ts
 * runLambdaEndpoint.onSerialized({ which, event, at: 'cloud' | 'local' }, context)
 * runLambdaEndpoint.onReferenced({ handler, event })   // no `at` — none is possible
 * ```
 *
 * ## 🔴 the boundary determines the ERROR STANCE
 *
 * this is the axis's whole value: it is *causal*, so it predicts behavior that a
 * locus axis (cloud vs local) does not.
 *
 * | boundary | a constraint error arrives as | why |
 * |----------|-------------------------------|-----|
 * | **serialized** | a **thrown** error | you addressed the endpoint by slug, so you are a CALLER |
 * | **referenced** | a **returned** envelope | you hold the handler, so you are the HOST |
 *
 * locus does not cleave this. `at: 'local'` and `at: 'cloud'` sit on the **same**
 * side — both throw.
 *
 * ## the matrix — 4 cells, 3 reachable, 1 barred by nature
 *
 * | | **local** | **cloud** |
 * |---|---|---|
 * | **serialized** | ✅ look the slug up, simulate the wire | ✅ the real wire |
 * | **referenced** | ✅ hold the handler, call it | 🚫 **barred** |
 *
 * ⚠️ **`referenced × cloud` is impossible: a function reference cannot cross a
 *    process.** to reach a cloud lambda you must name it, and to name it is to
 *    serialize.
 *
 * 🔴 **and the bar is UNREPRESENTABLE, by arity** — not documented and policed:
 *    `onSerialized` takes `at`, because a slug points either way;
 *    `onReferenced` takes **no** `at`, because a reference has one locus only.
 *    ⇒ `rule.prefer.prevent-over-correct`, rung 1: make it impossible.
 *
 * ## what it replaces
 *
 * | incumbent | successor |
 * |---|---|
 * | `invokeLambdaForTesting({ …, locally: false })` | `runLambdaEndpoint.onSerialized({ …, at: 'cloud' })` |
 * | `invokeLambdaForTesting({ …, locally: true })` | `runLambdaEndpoint.onSerialized({ …, at: 'local' })` |
 * | `invokeHandlerForTesting({ event, handler })` | `runLambdaEndpoint.onReferenced({ handler, event })` |
 *
 * ⚠️ the incumbent's `locally = false` is a **negative-default boolean** whose
 *    name states a locus and hides a stance. the named variants state both
 *    (`rule.forbid.ambiguous-labels`).
 */
export const runLambdaEndpoint = {
  onReferenced,
  onSerialized,
};
