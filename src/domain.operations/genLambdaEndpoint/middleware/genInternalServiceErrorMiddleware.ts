import type middy from '@middy/core';

import { asContextTrailed } from './asContextTrailed';
import { getIsConstraintError } from './getIsConstraintError';

/**
 * .what = middleware that logs and handles internal service errors
 * .why = all errors that are not a ConstraintError are internal service errors, so each one is
 *        logged loudly and never echoed to the wire — no internal detail, no secret
 *
 * .note = this middleware does NOT know which families exist. the family states what a server
 *         fault owes the wire via `asOutputAfter` — and that includes the choice to DECLINE and
 *         let the invocation fail. a flag read here would fork one guarantee across two paths
 *         (rule.forbid.parallel-codepaths)
 */
export const genInternalServiceErrorMiddleware = (opts: {
  /**
   * .what = renders a server fault as this family's `outputAfter`, or declines to answer
   * .why = the two families make DIFFERENT guarantees for the same fault, so this is not one
   *        shape with two renderings (rule.forbid.parallel-codepaths exempts genuinely
   *        different guarantees — it forbids only the FLAG that selected between them):
   *
   *   function -> answer the wire with this shape; the invocation SUCCEEDS, since http demands
   *               a response and a hung request is worse than a 500
   *   false    -> DISARMED; rethrow, so the invocation FAILS, cloudwatch records the error, and
   *               the caller may retry — which is the right contract for a server fault when no
   *               http caller waits on it
   *
   * .note = the off-state is `false`, never absent. an absent field would disable a guarantee by
   *         omission, so a caller who forgot it would be indistinguishable from one who chose it
   *         (rule.require.explicit-optout), and `false` differs maximally in form from
   *         `undefined` (rule.forbid.opposite-senses-on-undefined-and-null)
   */
  asOutputAfter:
    | ((input: { error: Error; exid: string | null }) => unknown)
    | false;
}): {
  onError: middy.MiddlewareFn<any, any>;
} => {
  const onError: middy.MiddlewareFn<any, any> = async (request) => {
    const error = request.error;
    if (!error) return;

    // check if the error was due to a bad request from the user
    // if it was, do not handle here - this was not an internal service error
    const isBadRequest = getIsConstraintError({ error });
    if (isBadRequest) return;

    // read the sdk-managed context once — trail may not have run yet
    const { log } = asContextTrailed({ context: request.context });

    /**
     * .what = log the fault, and name WHICH endpoint raised it
     * .why = the wire body a caller meets is deliberately generic — no internal detail, no
     *        secret — so cloudwatch is the only surface that can carry a diagnosis. it carried
     *        the message and the stack and never the endpoint, which is the half that matters
     *        most where the fault is service-wide: one bad schema position 500s
     *        `getAllLambdaContracts` for every endpoint beside it, and the log said WHAT broke
     *        without WHERE
     *
     * .note = `functionName` is aws's own field on the lambda `Context`, never one this sdk
     *         writes — so it is read straight off `request.context` rather than through
     *         `asContextTrailed`, which exists for the sdk-added fields only
     *
     * ⚠️ .why the WIRE body is still bare = whether a 500 may name an internal schema position
     *         at all is a disclosure call, and it belongs to the wisher — tracked as `F02`.
     *         a log line crosses no trust boundary, so THIS half needed no such call
     */
    const logError = log?.error ?? console.error;
    logError('handler.error', {
      endpoint:
        (request.context as { functionName?: string } | undefined)
          ?.functionName ?? null,
      errorMessage: error.message,
      stackTrace: error.stack,
    });

    // a family that declines to answer lets the invocation fail, so cloudwatch records it
    if (opts.asOutputAfter === false) throw error;

    // get exid from trail context if available for correlation
    const exid = log?.trail?.exid ?? null;

    /**
     * .what = answer the wire with this family's shape for a server fault
     * .why = middy treats a set `request.response` as "handled", which keeps the invocation a
     *        SUCCESS and stops cloudwatch from a lambda-error classification
     *
     * .note = DELIBERATE MUTATION — `request` is middy's only channel to hand a value onward
     */
    request.response = opts.asOutputAfter({ error, exid });
  };
  return { onError };
};
