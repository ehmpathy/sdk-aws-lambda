import type { TrailCarrier } from '../../../domain.objects/TrailCarrier';

/**
 * .what = the mark a `genLambdaEndpoint` builder leaves on the handler it returns, which names the
 *         carrier that family reads
 * .why = the receiver owns the carrier, and the handler is the receiver. `runLambdaEndpoint` holds the
 *        handler at `onReferenced` and at the local locus of `onSerialized`, so it reads the carrier
 *        off the handler, and an event copied from a built one (a spread, a clone, a captured request)
 *        reaches the endpoint still framed for its family
 *
 * .note = `Symbol.for`, so two copies of this package in one process still agree on the mark
 */
export const HANDLER_TRAIL_CARRIER = Symbol.for(
  'sdk-aws-lambda.handler.trailCarrier',
);

/**
 * .what = declares the carrier a handler reads, and returns the same handler
 * .why = each family states its carrier once, beside the `genTrailMiddleware({ carrier })` that reads
 *        it, so the endpoint and the runner cannot disagree
 *
 * .note = non-enumerable, so it appears in no spread and no snapshot of the handler
 * .note = DELIBERATE MUTATION — of the fresh handler the builder just made, never of a caller's
 */
export const setHandlerTrailCarrier = <THandler extends object>(input: {
  handler: THandler;
  carrier: TrailCarrier;
}): THandler =>
  Object.defineProperty(input.handler, HANDLER_TRAIL_CARRIER, {
    value: input.carrier,
    enumerable: false,
  });
