import type middy from '@middy/core';

import type { TrailCarrier } from '../../../domain.objects/TrailCarrier';
import { genInternalServiceErrorMiddleware } from '../middleware/genInternalServiceErrorMiddleware';
import { genIoLoggerMiddleware } from '../middleware/genIoLoggerMiddleware';
import { genTrailMiddleware } from '../middleware/genTrailMiddleware';
import type { TranslateLog } from '../TranslateLog';

/**
 * .what = the observability chain every record-source variant runs — `forSqs.*`, `forSns`,
 *         `forKinesis.*`
 * .why = the variants differ in how they decode a record, how they hand records to `invoke`, and
 *        what they do with a failure. every guarantee around that is identical, so it lands once. a
 *        second array would take the next guarantee into one variant and not the other
 *        (`rule.forbid.parallel-codepaths`)
 *
 * .why `carrier` is an input = each source reads its caller's trail from its own place, declared
 *        once on its `RecordSource`: `wrapper` for sqs (the named debt), `none` for sns and kinesis
 *        (`domain.objects/TrailCarrier`). the same value stamps the handler, so `runLambdaEndpoint`
 *        writes what the endpoint reads
 *
 * .why no constraint-error middleware, where both peer families register one = that middleware
 *        answers a caller fault with a response body, and a record-source invoke has no one to
 *        answer. each variant acknowledges a caller fault itself, per record, where the record id
 *        is in hand: a per-record variant logs `<source>.record.refused` and returns, so the source
 *        lets the record go; a per-batch variant logs it and leaves that id out of
 *        `batchItemFailures`. a refusal is never retried and never dead-lettered, since the same
 *        bytes fail the same way on every delivery (`invariant.constraint-errors-never-redrive-sqs`).
 *        the log line is the discard's trace, so it is not a failhide. a fault that names no
 *        record — a per-batch handler throw, of any class — escapes here and redrives the batch
 *
 * .why no introspection middleware = introspection exists so `genServiceSdk` can generate a typed
 *        caller, and a record-source handler has no caller sdk — a producer sends to a queue, a
 *        topic, or a stream, and never invokes this lambda. it also forces a `schema.output`, which
 *        these families do not have (`rule.prefer.wet-over-dry`)
 *
 * .the order carries the load. middy runs `before` hooks in forward array order and
 *        `after`/`onError` in reverse, since it `unshift`s them:
 *
 *          index | hook                 | run order
 *          ------|----------------------|------------------------------------------
 *            0   | onError              | LAST  — logs a server fault loudly, then rethrows;
 *                |                      |         a caller fault passes unlogged
 *                |                      |         (`.dream/2026_10_22.sqs-forwarded-caller-fault-logs-loud.dream.md`)
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
export const genRecordEndpointMiddlewares = (input: {
  logTranslate: TranslateLog | null;
  carrier: TrailCarrier;
}): {
  before?: middy.MiddlewareFn<any, any>;
  after?: middy.MiddlewareFn<any, any>;
  onError?: middy.MiddlewareFn<any, any>;
}[] => [
  /**
   * .what = logs a server fault loudly, then declines to answer
   * .why = `asOutputAfter: false` rethrows, so the invocation fails, cloudwatch records it, and
   *        the source redelivers. that is the right contract when no caller waits on a response
   *        — and for a record source it is the only contract that keeps the record
   *
   * .note = clamped on both arms, since the blast radius differs per cardinality. `forSqs.perRecord`'s
   *         `[case10]`: the throw escapes, so the one message redrives. `forSqs.perBatch`'s `[case7]`:
   *         the throw escapes, so the whole batch redrives, the records the handler already
   *         finished among them — the honest answer, since any returned value would acknowledge
   *         each record it does not name (`rule.forbid.failhide`)
   */
  genInternalServiceErrorMiddleware({ asOutputAfter: false }),
  genTrailMiddleware({ carrier: input.carrier }),
  genIoLoggerMiddleware({ logTranslate: input.logTranslate ?? undefined }),
];
