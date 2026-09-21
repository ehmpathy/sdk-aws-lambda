/**
 * .what = which error dialect an endpoint answers a caller fault in
 * .why = an endpoint shapes its constraint envelope by what the CALLER sent:
 *        a `{ event, trail }` wrapper marks a contemp caller; a flat payload
 *        marks an ancient one (invariant.ancient-vs-contemp-callers)
 *
 * | dialect | the payload sent | the envelope returned |
 * |---------|------------------|-----------------------|
 * | contemp | `{ event, trail }` | `{ error: { _serde, class, message } }` |
 * | ancient | the event, flat | `{ errorMessage, errorType }` |
 *
 * .note = contemp is the DEFAULT, per rule.require.contemp-contracts-default.
 *         ancient is opt-in, for an endpoint that still serves a legacy caller.
 *
 * .note = it lives here because two peer operations name it —
 *   `askLambdaEndpoint` and `runLambdaEndpoint`
 *   (rule.prefer.most-common-denominator).
 */
export type LambdaEndpointDialect = 'contemp' | 'ancient';
