import { perBatch } from './genLambdaEndpoint.forSqs.perBatch';
import { perRecord } from './genLambdaEndpoint.forSqs.perRecord';

/**
 * .what = the `forSqs` sub-family — both cardinality variants, under one name
 *
 *   genLambdaEndpoint.forSqs.perRecord({ … })   // one message per invoke
 *   genLambdaEndpoint.forSqs.perBatch({ … })    // the whole batch per invoke
 *
 * .why two variants and not one widened contract = they make different guarantees, which is the
 *        one case `rule.require.widen-before-parallel` names as a real peer:
 *
 *        | variant | guarantee |
 *        |---|---|
 *        | `perRecord` | cardinality 1 — refuses a batch of more than one, loudly, so no message is silently dropped |
 *        | `perBatch`  | partial failure — reports failed ids, so one poison pill does not redrive nine healthy messages |
 *
 *        neither can be expressed as the other plus a flag: `perRecord`'s refusal is what makes
 *        its `payload` mean one message, and `perBatch`'s failure report is what makes a bulk
 *        handler safe (`domain.terms/event.md`)
 *
 * .note = neither variant is exported bare from `src/index.ts`, and neither is this object. a
 *         caller reaches them through `genLambdaEndpoint.forSqs.`, so autocomplete on the family
 *         enumerates the whole set
 */
export const forSqs = {
  perRecord,
  perBatch,
};
