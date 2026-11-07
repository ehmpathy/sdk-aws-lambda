import { MalfunctionError } from 'helpful-errors';

/**
 * .what = the metadata a `LambdaEndpointRefusedError` carries
 * .why = helpful-errors exports no name for its metadata shape, so it is read off the parent's
 *        own constructor rather than restated
 */
export type LambdaEndpointRefusedErrorMetadata = NonNullable<
  ConstructorParameters<typeof MalfunctionError>[1]
>;

/**
 * .what = a peer endpoint refused a request this caller composed
 * .why = a peer's `ConstraintError` / `BadRequestError` names a fault in the request the PEER
 *        received — which this caller built. so it is this caller's malfunction, never a fault
 *        its own caller can fix. thrown as the caller's own `ConstraintError`, it became a 400 to
 *        an http caller and hid from every alarm (sdk-aws-lambda#77)
 *
 * .note = a `MalfunctionError`, so every consumer family treats it as a server fault: an
 *         api-gateway consumer answers 500, a direct-invoke consumer fails its invocation, and an
 *         sqs consumer redrives the message. `getIsConstraintError` reads it false
 * .note = metadata is the road's own: the invoke road names the `endpoint`; the http road names
 *         the `url` and `status`. both carry `exid` and the peer's verdict as `errorType`
 * .note = a consumer whose call forwards its own caller's input verbatim opts into the old class
 *         per call, via `refusal: { as: 'ConstraintError' }`
 */
export class LambdaEndpointRefusedError extends MalfunctionError {
  constructor(message: string, metadata: LambdaEndpointRefusedErrorMetadata) {
    super(message, metadata);

    // name the class, as aws labels an escaped throw by `.name`; helpful-errors sets no name
    this.name = 'LambdaEndpointRefusedError';
  }
}
