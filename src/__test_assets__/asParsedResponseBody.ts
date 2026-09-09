import { MalfunctionError } from 'helpful-errors';

import type { ApiGatewayResponsePayload } from '../domain.objects/ApiGatewayResponsePayload';

/**
 * .what = reads the json body off a wire response, and fails loud when there is none
 * .why = `body` is optional on `ApiGatewayResponsePayload` because a body-less response (a
 *        204, a 308) reaches the wire with the key absent. a test that wants a body must
 *        therefore declare that, so this states the expectation once, in one named place,
 *        rather than narrow it at every assertion
 *
 * .why = the alternative at each site is a non-null assertion, which asserts the exact
 *        case the optional type exists to make a reader weigh (rule.forbid.as-cast)
 *
 * .note = `TBody` defaults to `any` because that is exactly what `JSON.parse` returns —
 *         a wrapper that narrowed it to `unknown` would force a type argument at every
 *         assertion without proving one more fact. pass `TBody` where the test wants the
 *         body's shape checked
 */
export const asParsedResponseBody = <
  // biome-ignore lint/suspicious/noExplicitAny: `JSON.parse` returns `any`; see .note
  TBody = any,
>(input: {
  response: ApiGatewayResponsePayload;
}): TBody => {
  const { body } = input.response;

  // a test that reaches for a body on a body-less response asserts the wrong shape
  if (body === undefined)
    MalfunctionError.throw('response carries no body to parse', {
      statusCode: input.response.statusCode,
      headers: input.response.headers,
    });

  return JSON.parse(body);
};
