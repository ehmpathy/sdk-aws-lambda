/**
 * .what = how a caller wants a peer endpoint's refusal thrown
 * .why = a peer's refusal of a request this caller composed is this caller's malfunction, so the
 *        default throws `LambdaEndpointRefusedError`. a caller that forwards its own caller's
 *        input verbatim may name `ConstraintError` instead, which passes the fault on as its
 *        caller's to fix
 *
 * .note = a named value, never a boolean, so the call site states which class it gets
 *         (rule.require.explicit-optout)
 * .note = `readonly`, since one default instance is shared by every call that omits the opt
 */
export interface LambdaEndpointRefusal {
  readonly as: 'ConstraintError' | 'LambdaEndpointRefusedError';
}

/**
 * .what = the refusal stance of a caller that composed its request
 * .why = the default of every ask road: a peer's refusal is this caller's own malfunction
 */
export const REFUSAL_DEFAULT: LambdaEndpointRefusal = {
  as: 'LambdaEndpointRefusedError',
};

/**
 * .what = the refusal stance of a caller that forwards its own caller's input verbatim
 * .why = the opt-in of an ask road, and the fixed stance of `runLambdaEndpoint.onSerialized`,
 *        whose caller composed the event itself
 */
export const REFUSAL_PASSTHROUGH: LambdaEndpointRefusal = {
  as: 'ConstraintError',
};
