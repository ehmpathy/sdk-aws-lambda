import type middy from '@middy/core';

import { genInternalServiceErrorMiddleware } from '../middleware/genInternalServiceErrorMiddleware';
import { genIoLoggerMiddleware } from '../middleware/genIoLoggerMiddleware';
import { genTrailMiddleware } from '../middleware/genTrailMiddleware';
import type { TranslateLog } from '../TranslateLog';

/**
 * .what = the observability chain both `forSqs` variants run
 * .why = the two variants differ in one respect — how they hand records to `invoke`, and what
 *        they do with a failure. every guarantee around that is identical, so it lands once. a
 *        second array would take the next guarantee into one variant and not the other
 *        (`rule.forbid.parallel-codepaths`)
 *
 * .why no constraint-error middleware, where both peer families register one = that middleware
 *        turns a caller fault into a successful invocation, which is correct where an http caller
 *        waits on a response. in sqs a successful invocation means delete the message, so to
 *        swallow a validation failure into a success would silently discard a message no handler
 *        ever processed (`rule.forbid.failhide`). a poison pill must fail instead: `perRecord`
 *        lets the throw escape so sqs redrives and then dead-letters it, and `perBatch` reports
 *        that one id as a batch item failure so sqs redrives only it
 *
 * .why no introspection middleware = introspection exists so `genServiceSdk` can generate a typed
 *        caller, and an sqs handler has no caller sdk — a producer sends to a queue, and never
 *        invokes this lambda. it also forces a `schema.output`, which this family does not have
 *        (`rule.prefer.wet-over-dry`)
 *
 * .the order carries the load. middy runs `before` hooks in forward array order and
 *        `after`/`onError` in reverse, since it `unshift`s them:
 *
 *          index | hook                 | run order
 *          ------|----------------------|------------------------------------------
 *            0   | onError              | LAST  — logs the fault loudly, then rethrows
 *            1   | before               | FIRST — produces `context.log`
 *            2   | before/after/onError | reads `context.log`
 *
 *        so trail (1) sits below the io logger (2) and `handler.input` logs. the api-gateway
 *        family carries the inverse order and its `handler.input` never fires — a live, recorded
 *        defect this family declines to inherit (`rule.require.sweep-the-defect-class`,
 *        `.dream/v2026_09_22.fix.logtranslate-input-is-dead-for-the-apigateway-family.md`)
 *
 * .note = both log halves are clamped, one per variant. `perRecord`'s `[case11]` observes the
 *         `before` branch through `logTranslate.input`; `perBatch`'s `[case12]` observes the
 *         `after` branch through `logTranslate.output`, with the `batchItemFailures` wire shape
 *         intact. the second half carries weight only on `perBatch` — `perRecord` returns
 *         `Promise<void>`, so a redaction would have naught to strip
 * .note = the io logger's `request.response` branch is dead here by construction rather than by
 *         order: no middleware in this chain sets a response, since a server fault rethrows. its
 *         `errorMessage` branch is the live one, and the correct one for a family with no caller
 */
export const genSqsEndpointMiddlewares = (input: {
  logTranslate?: TranslateLog;
}): {
  before?: middy.MiddlewareFn<any, any>;
  after?: middy.MiddlewareFn<any, any>;
  onError?: middy.MiddlewareFn<any, any>;
}[] => [
  /**
   * .what = logs a server fault loudly, then declines to answer
   * .why = `asOutputAfter: false` rethrows, so the invocation fails, cloudwatch records it, and
   *        sqs redrives the batch. that is the right contract when no caller waits on a response
   *        — and in sqs it is the only contract that keeps the message
   *
   * .note = clamped on both arms, since the blast radius differs per variant. `perRecord`'s
   *         `[case10]`: the throw escapes, so the one message redrives. `perBatch`'s `[case7]`:
   *         the throw escapes, so the whole batch redrives, the records the handler already
   *         finished among them — the honest answer, since any returned value would delete each
   *         message it does not name (`rule.forbid.failhide`)
   */
  genInternalServiceErrorMiddleware({ asOutputAfter: false }),
  genTrailMiddleware(),
  genIoLoggerMiddleware({ logTranslate: input.logTranslate }),
];
