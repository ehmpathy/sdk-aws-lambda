import { forApiGateway } from './genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway';
import { forAsk } from './genLambdaEndpoint.forAsk/genLambdaEndpoint.forAsk';
import { forKinesis } from './genLambdaEndpoint.forKinesis/genLambdaEndpoint.forKinesis';
import { forSns } from './genLambdaEndpoint.forSns/genLambdaEndpoint.forSns';
import { forSqs } from './genLambdaEndpoint.forSqs/genLambdaEndpoint.forSqs';

/**
 * .what = the `genLambdaEndpoint` family — every variant, reachable under one name
 * .why = a family's name must belong to the family, never to one of its variants
 *        (`rule.forbid.unqualified-variant-exports`). a variant that takes the family name
 *        leaves its peers with none to qualify, so the next peer ships bare and preposition-led
 *
 *   genLambdaEndpoint.forAsk({ … })                  // a direct invoke
 *   genLambdaEndpoint.forApiGateway({ … })           // http, via api gateway
 *   genLambdaEndpoint.forSqs.perRecord({ … })        // one queue message per invoke
 *   genLambdaEndpoint.forSqs.perBatch({ … })         // the whole queue batch per invoke
 *   genLambdaEndpoint.forSns({ … })                  // one topic message per invoke
 *   genLambdaEndpoint.forKinesis.perRecord({ … })    // one stream record per invoke
 *   genLambdaEndpoint.forKinesis.perBatch({ … })     // the whole stream batch per invoke
 *
 * .note = a plain object, with no callable default: one call form per variant, so a caller
 *         always names the trigger it serves
 *
 * .note = a source that delivers N records per invoke (sqs, kinesis) is a sub-family with a
 *         `perRecord` and a `perBatch` leaf, since its trigger forces a cardinality choice. a
 *         source that delivers one (sns) is a plain variant: a sub-family of one leaf is a variant
 *         with an extra hop (`rule.require.event-source-symmetry`)
 */
export const genLambdaEndpoint = {
  forAsk,
  forApiGateway,
  forSqs,
  forSns,
  forKinesis,
};
