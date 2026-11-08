import { ConstraintError, UnexpectedCodePathError } from 'helpful-errors';

import type { LambdaEndpointRefusal } from '../../../domain.objects/LambdaEndpointRefusal';
import {
  LambdaEndpointRefusedError,
  type LambdaEndpointRefusedErrorMetadata,
} from '../../../domain.objects/LambdaEndpointRefusedError';

/**
 * .what = casts a peer endpoint's refusal into the error its caller throws
 * .why = a peer's caller fault names a fault in the request this caller composed, so by default
 *        it is this caller's malfunction (`LambdaEndpointRefusedError`). a caller that forwards
 *        its own caller's input verbatim names `ConstraintError`, and gets today's class, with
 *        today's message and metadata, byte for byte
 *
 * .note = the refusal's message names the fix, since its metadata shape has no `hint` field and
 *         a human reads the message first (rule.require.errors-name-the-fix)
 * .note = shared by both ask roads — the invoke hydration and the http one — so one vocabulary
 *         serves either (rule.require.consistent-variant-contracts)
 */
export const asErrorFromPeerRefusal = (input: {
  refusal: LambdaEndpointRefusal;
  peer: string;
  message: string;
  errorType: string;
  metadata: LambdaEndpointRefusedErrorMetadata;
}): ConstraintError | LambdaEndpointRefusedError => {
  // pass-through: the caller declared the request its own caller's, so the fault stays a caller fault
  if (input.refusal.as === 'ConstraintError')
    return new ConstraintError(input.message, input.metadata);

  // default: the caller composed the request, so the fault is the caller's own malfunction
  if (input.refusal.as === 'LambdaEndpointRefusedError')
    return new LambdaEndpointRefusedError(
      // the fix stands in its own paragraph, so a log reader finds it apart from the peer's json
      `${input.peer} refused the request: ${input.message}\n\nthis caller composed the request. if it forwards its own caller's input verbatim, opt in with refusal: { as: 'ConstraintError' }`,
      { ...input.metadata, errorType: input.errorType },
    );

  // a third opt added to the union fails to compile here, never falls through to a wrong class
  const refusalUnknown: never = input.refusal.as;
  return UnexpectedCodePathError.throw('refusal opt has no cast', {
    refusal: refusalUnknown,
  });
};
