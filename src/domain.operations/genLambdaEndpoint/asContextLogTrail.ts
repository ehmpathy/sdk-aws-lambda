import type { Context } from 'aws-lambda';
import type { ContextLogTrail } from 'sdk-logs';

/**
 * .what = reads the trail log that `genTrailMiddleware` wrote onto the lambda context
 * .why = BOTH family handlers need it, and each had restated the same cast with its own
 *        ~10-line doc block — one of which called itself "the twin of" the other. one
 *        declaration, so the two cannot drift (rule.forbid.parallel-codepaths)
 *
 * .as = aws types a handler's second argument as `Context`, which declares no `log`. this
 *       sdk's own `genTrailMiddleware` puts it there, so the cast asserts what the sdk's own
 *       middleware wrote — never an outside claim
 *
 * .as = `unknown` is the intermediate because `Context` and `ContextLogTrail` overlap on no
 *       member, so tsc refuses the direct assertion
 *
 * .why NOT `asContextTrailed` = that reader returns OPTIONAL fields, because a middleware's
 *       array position decides whether trail has run yet. a handler has no such doubt: trail is
 *       a `before` hook, so it has always run by the time the handler does. so this reader
 *       states `log` as PRESENT, and a caller owes no `?.` — the two readers differ in the one
 *       guarantee that matters, which is why they are a pair rather than one function
 *
 * .removal = removable when aws-lambda's `Handler` takes a caller-declared context type, or
 *       when the families hand their `logic` the middy request rather than the raw arguments —
 *       the latter is the cheaper path, and it is why `asContextTrailed` exists for the
 *       middleware sites
 */
export const asContextLogTrail = (input: {
  context: Context;
}): ContextLogTrail => input.context as unknown as ContextLogTrail;
