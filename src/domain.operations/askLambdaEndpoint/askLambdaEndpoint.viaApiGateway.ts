import type { ContextLogTrail } from 'sdk-logs';

import { getOneTrailExid } from '../lambdaEndpointWire/context/getOneTrailExid';
import { executeHttpRequest } from './invoke/executeHttpRequest';
import { asErrorFromHttpResponse } from './serde/asErrorFromHttpResponse';
import { asHeadersRecord } from './serde/asHeadersRecord';
import { asHttpMethod } from './serde/asHttpMethod';
import { asHttpRequestBody } from './serde/asHttpRequestBody';
import { asHttpRequestHeaders } from './serde/asHttpRequestHeaders';
import { getOneBodyFromHttpText } from './serde/getOneBodyFromHttpText';

/**
 * .what = asks an api gateway endpoint over http, opted into the contemp dialect with the caller's trail
 * .why = an aws-delivered event cannot hold a `{ event, trail }` wrapper, so the opt-in and the
 *        trail ride the request's own `x-trail-exid` header. this sends it, and casts a fault back
 *        into the throw `askLambdaEndpoint` gives, so one catch block serves both roads
 *        (`invariant.ancient-vs-contemp-callers.md`, `domain.terms/x-trail-exid.md`)
 *
 * | answer | the caller gets |
 * |--------|-----------------|
 * | < 400 | `{ status, headers, text, body }` — `body` is the json, or null where the answer has none |
 * | 4xx | a thrown `ConstraintError`, with the endpoint's message |
 * | 5xx | a thrown `MalfunctionError`, with the `correlationId` that finds the log line |
 *
 * .note = takes the standard http request — `{ url, method, headers, body }` — as fetch does, and
 *         no `which`: an http endpoint is addressed by its url
 * .note = a body that is not a string is json-stringified, as `asLambdaEvent.fromApiGateway` does
 * .note = the trail header replaces any caller header of that name, in any case, since one of that
 *         name would silently opt in or out of the dialect the trail declares
 * .note = with no `method`, a request with a body is a `POST` and one without is a `GET`
 * .note = `text` is always the raw answer, so a body that is not json (xml, html) is read there
 * .note = sends with the runtime's global `fetch`, which node supplies from 18. the sdk adds no http
 *         dependency, and sets no timeout: fetch waits as long as the endpoint does
 */
export const viaApiGateway = async <TResponse = unknown>(
  input: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  },
  context: ContextLogTrail,
): Promise<{
  status: number;
  headers: Record<string, string>;
  text: string;
  body: TResponse | null;
}> => {
  // the caller's exid, or a generated one — the same call `askLambdaEndpoint` makes
  const exid = getOneTrailExid({ log: context.log });

  // send the request, opted in by the trail header
  const request = asHttpRequestBody({ body: input.body });
  const response = await executeHttpRequest({
    url: input.url,
    method: asHttpMethod({ method: input.method, body: input.body }),
    headers: asHttpRequestHeaders({
      contentType: request.contentType,
      headers: input.headers,
      trail: { exid },
    }),
    body: request.text,
    exid,
  });

  // read the wire into plain data, so no live Response travels past here
  const text = await response.text();
  const body = getOneBodyFromHttpText({ text });

  // a fault is a thrown error, one catch block for either road
  const headers = asHeadersRecord({ headers: response.headers });
  const error = asErrorFromHttpResponse({
    status: response.status,
    body,
    text,
    headers,
    url: input.url,
    exid,
  });
  if (error) throw error;

  /**
   * .cast = TResponse
   * .why = the caller names the expected body via the generic; the endpoint validates its own
   *        output with a zod schema, so this boundary asserts no shape
   * .removal = add a runtime schema option here when a caller needs one
   */
  return {
    status: response.status,
    headers,
    text,
    body: body as TResponse | null,
  };
};
