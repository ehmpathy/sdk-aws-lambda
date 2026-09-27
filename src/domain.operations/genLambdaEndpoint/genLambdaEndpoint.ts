import { forApiGateway } from './genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway';
import { forAsk } from './genLambdaEndpoint.forAsk/genLambdaEndpoint.forAsk';
import { forSqs } from './genLambdaEndpoint.forSqs/genLambdaEndpoint.forSqs';

/**
 * .what = the `genLambdaEndpoint` family — every variant, reachable under one name
 * .why = a family's name must belong to the family, never to one of its variants
 *        (`rule.forbid.unqualified-variant-exports`). a variant that takes the family name
 *        leaves its peers with none to qualify, so the next peer ships bare and preposition-led
 *
 *   genLambdaEndpoint.forAsk({ … })               // a direct invoke
 *   genLambdaEndpoint.forApiGateway({ … })        // http, via api gateway
 *   genLambdaEndpoint.forSqs.perRecord({ … })     // one queue message per invoke
 *   genLambdaEndpoint.forSqs.perBatch({ … })      // the whole batch per invoke
 *
 * .note = a plain object, with no callable default: one call form per variant, so a caller
 *         always names the trigger it serves
 *
 * .note = `forSqs` is a sub-family rather than a variant, because the sqs trigger forces a
 *         cardinality choice no other trigger does — an invoke carries N messages. so the
 *         trigger names an object and the cardinality names its leaves
 *         (`genLambdaEndpoint.forSqs.ts`)
 */
export const genLambdaEndpoint = {
  forAsk,
  forApiGateway,
  forSqs,
};
