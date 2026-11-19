import { perBatch } from './genLambdaEndpoint.forKinesis.perBatch';
import { perRecord } from './genLambdaEndpoint.forKinesis.perRecord';

/**
 * .what = the `forKinesis` sub-family — both cardinality variants, under one name
 *
 *   genLambdaEndpoint.forKinesis.perRecord({ … })   // one record per invoke
 *   genLambdaEndpoint.forKinesis.perBatch({ … })    // the whole batch per invoke
 *
 * .why a sub-family = the kinesis trigger, like sqs, delivers N records per invoke, so it forces
 *        the same cardinality choice, and gets the same two leaves under the same names
 *        (`genLambdaEndpoint.forSqs.ts`, `rule.require.event-source-symmetry`)
 *
 * .note = tumble windows are out of scope: a windowed handler must carry `state` in and out
 *         (`KinesisStreamStateResponse`), and both leaves answer `batchItemFailures` alone. a
 *         windowed author keeps `genLambdaEndpoint.forAsk` with `asLambdaEventSchema.fromKinesis()`
 * .note = a record retried behind a failed one is redelivered whole, so a refusal warn may repeat
 *         for it, and every handler must be idempotent
 * .note = neither variant is exported bare from `src/index.ts`, and neither is this object
 *         (`rule.forbid.unqualified-variant-exports`)
 */
export const forKinesis = {
  perRecord,
  perBatch,
};
