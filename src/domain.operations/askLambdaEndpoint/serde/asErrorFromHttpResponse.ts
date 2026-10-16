import { ConstraintError, MalfunctionError } from 'helpful-errors';

import { HttpStatusCode } from '../../../domain.objects/HttpStatusCode';
import { getIsContempErrorResponse } from '../../lambdaEndpointWire/error/getIsLambdaErrorResponse';
import { asUnprefixedErrorMessage } from '../../lambdaEndpointWire/serde/asUnprefixedErrorMessage';
import { getOneCorrelationIdFromBody } from './getOneCorrelationIdFromBody';

const ERROR_TEXT_LENGTH_MAX = 1000;

/**
 * .what = casts an http response into the error a caller should throw, or null for a success
 * .why = an api gateway endpoint answers a fault as a RETURNED http response, never a lambda error
 *        (`invariant.badrequesterror-not-lambda-error`). the caller of `viaApiGateway` still wants
 *        the throw `askLambdaEndpoint` gives — one catch block, whichever road it took
 *
 * | status | the error | because |
 * |--------|-----------|---------|
 * | < 400 | none | a success. a redirect is followed by fetch by default, so a 3xx seldom arrives here |
 * | 4xx | `ConstraintError` | the caller must fix the request |
 * | 5xx | `MalfunctionError` | the endpoint must fix itself; its `correlationId` finds the log line |
 *
 * .note = the message comes from the body's contemp envelope when it has one, else from the
 *         status alone — a 404 from the gateway's own route match has no body this sdk wrote.
 *         a flat ancient body reads as the status alone: an opted-in caller is never answered in
 *         that shape, so no arm reads it
 * .note = the raw answer text rides the error metadata, cut to a bound, so a message no arm reads
 *         (an old endpoint's flat body, a proxy's html page) is never lost to the caller. it is null
 *         where the message came from the contemp envelope, which is the text already. the
 *         response headers ride it too, so a deliberate refusal (a 429 and its `retry-after`) can be
 *         read from the thrown error
 */
export const asErrorFromHttpResponse = (input: {
  status: number;
  body: unknown;
  text: string;
  headers: Record<string, string>;
  url: string;
  exid: string;
}): ConstraintError | MalfunctionError | null => {
  if (input.status < HttpStatusCode.BAD_REQUEST_400) return null;

  const message = getIsContempErrorResponse(input.body)
    ? asUnprefixedErrorMessage({ message: input.body.error.message })
    : `the endpoint answered http ${input.status}`;

  const metadata = {
    url: input.url,
    status: input.status,
    exid: input.exid,
    correlationId: getOneCorrelationIdFromBody({ body: input.body }),
    // the raw text rides only where the message did not come from it: an envelope's message is
    // the text already, and a second copy would bury the fix a person reads first
    text: getIsContempErrorResponse(input.body)
      ? null
      : input.text.slice(0, ERROR_TEXT_LENGTH_MAX),
    headers: input.headers,
  };

  if (input.status < HttpStatusCode.INTERNAL_SERVER_ERROR_500)
    return new ConstraintError(message, metadata);
  return new MalfunctionError(message, metadata);
};
