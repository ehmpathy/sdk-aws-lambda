import type { ContextLogTrail } from 'sdk-logs';

/**
 * .what = the fields THIS SDK adds onto the lambda context, beyond aws's own `Context`
 * .why = `genTrailMiddleware` writes both of these, and six middleware sites read them. each
 *        had restated the same inline cast shape, so a change to either field meant six edits
 *        (rule.forbid.parallel-codepaths)
 *
 * .note = both are OPTIONAL by honest necessity, never by preference. a middleware's array
 *         position decides whether trail has run yet, so a reader placed above trail genuinely
 *         sees `undefined` — that is the live `handler.input` defect, and a required type here
 *         would state a guarantee the chain does not keep
 */
export interface ContextTrailed {
  log?: ContextLogTrail['log'];
  isContempCaller?: boolean;
}

/**
 * .what = reads the sdk-managed fields off a middy request's context
 * .why = ONE documented cast, in place of the same cast restated at every read site
 *        (rule.forbid.as-cast, rule.require.named-transformers)
 *
 * .as = middy types `request.context` as aws-lambda's `Context`, which declares neither `log`
 *       nor `isContempCaller`. this sdk puts both there itself, via `genTrailMiddleware`, so the
 *       cast asserts what the sdk's own middleware wrote — never an outside claim
 *
 * .removal = removable when middy's `Request` carries a caller-declared context type parameter
 *       this chain can bind, such that `MiddyfiedHandler`'s `TContext` reaches a middleware's
 *       `request.context`. until then no type-level path exists from what `genTrailMiddleware`
 *       writes to what a later middleware reads
 *
 * .note = an absent context yields `{}` rather than a throw. a reader must handle the
 *         trail-has-not-run case regardless (see `.note` on `ContextTrailed`), so a throw here
 *         would convert a documented fact about array order into a crash
 */
export const asContextTrailed = (input: { context: unknown }): ContextTrailed =>
  (input.context ?? {}) as ContextTrailed;
