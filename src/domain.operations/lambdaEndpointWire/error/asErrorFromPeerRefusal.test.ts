import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import { LambdaEndpointRefusedError } from '../../../domain.objects/LambdaEndpointRefusedError';
import { getIsConstraintError } from '../../genLambdaEndpoint/middleware/getIsConstraintError';
import { asErrorFromPeerRefusal } from './asErrorFromPeerRefusal';

const PEER = 'svc-notifications-prep-sendNotification';
const METADATA = { exid: 'exid:abc123' };

describe('asErrorFromPeerRefusal', () => {
  given('[case1] a peer refusal under the default opt', () => {
    when('[t0] the refusal is cast', () => {
      then(
        'it is a LambdaEndpointRefusedError, a MalfunctionError, that names the peer and the opt-in',
        () => {
          const error = asErrorFromPeerRefusal({
            refusal: { as: 'LambdaEndpointRefusedError' },
            peer: PEER,
            message: 'template id absent',
            errorType: 'ConstraintError',
            metadata: METADATA,
          });
          expect(error).toBeInstanceOf(LambdaEndpointRefusedError);
          expect(error).toBeInstanceOf(MalfunctionError);
          expect(error.name).toEqual('LambdaEndpointRefusedError');
          expect(getIsConstraintError({ error })).toBe(false);
          expect(error.message).toContain(
            `${PEER} refused the request: template id absent`,
          );
          expect(error.message).toContain("refusal: { as: 'ConstraintError' }");
          expect(error.metadata).toEqual({
            ...METADATA,
            errorType: 'ConstraintError',
          });
        },
      );
    });
  });

  given('[case2] a peer refusal under the pass-through opt', () => {
    when('[t0] the refusal is cast', () => {
      then(
        'it is a ConstraintError, with the message and metadata as they arrived',
        () => {
          const error = asErrorFromPeerRefusal({
            refusal: { as: 'ConstraintError' },
            peer: PEER,
            message: 'template id absent',
            errorType: 'ConstraintError',
            metadata: METADATA,
          });
          expect(error).toBeInstanceOf(ConstraintError);
          expect(error).not.toBeInstanceOf(LambdaEndpointRefusedError);
          expect(getIsConstraintError({ error })).toBe(true);
          expect(error.message).toContain('template id absent');
          expect(error.message).not.toContain(PEER);
          expect(error.metadata).toEqual(METADATA);
        },
      );
    });
  });
});
