import type { TrailCarrier } from '../../../domain.objects/TrailCarrier';
import { HANDLER_TRAIL_CARRIER } from './setHandlerTrailCarrier';

/**
 * .what = the carrier a handler declares, or null for a handler that declares none
 * .why = a plain lambda handler (an unmigrated `createStandardHandler`) is built by no `genLambdaEndpoint`
 *        family, so it declares none, and the caller falls back to the event's own declaration
 */
export const getOneTrailCarrierOfHandler = (input: {
  handler: unknown;
}): TrailCarrier | null => {
  if (typeof input.handler !== 'function') return null;
  const carrier: unknown = Reflect.get(input.handler, HANDLER_TRAIL_CARRIER);
  if (carrier === 'wrapper' || carrier === 'headers') return carrier;
  return null;
};
