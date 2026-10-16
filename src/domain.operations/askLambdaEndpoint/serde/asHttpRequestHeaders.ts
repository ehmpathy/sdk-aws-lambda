import { TRAIL_EXID_HEADER } from '../../../domain.objects/TrailExidHeader';
import { asHeadersWithoutKey } from '../../lambdaEndpointWire/frame/asHeadersWithoutKey';
import { asTrailExidHeaders } from '../../lambdaEndpointWire/frame/asTrailExidHeaders';

const CONTENT_TYPE_HEADER = 'content-type';

/**
 * .what = the headers an http request is sent with: the body's content type, the caller's, and the trail's
 * .why = three sources meet and two can collide, so the order is the contract, and it reads here once
 *        instead of at each call site
 *
 * | source | wins over |
 * |--------|-----------|
 * | the trail's `x-trail-exid` | any caller header of that name, in any case |
 * | the caller's `headers` | the content type the body implies, in any case |
 * | the content type the body implies | none |
 *
 * .note = a caller header of the trail's name is dropped in every case, since one of that name would
 *         silently opt in or out of the dialect the trail declares
 * .note = the implied content type yields to a caller's of any case: a bag that held `Content-Type` and
 *         `content-type` would be joined by the http client into one value that names two types
 */
export const asHttpRequestHeaders = (input: {
  contentType: string | null;
  headers: Record<string, string> | undefined;
  trail: { exid: string };
}): Record<string, string> => {
  const headersOfCaller = asHeadersWithoutKey({
    headers: input.headers,
    key: TRAIL_EXID_HEADER,
  });
  const isContentTypeGiven = Object.keys(headersOfCaller).some(
    (name) => name.toLowerCase() === CONTENT_TYPE_HEADER,
  );
  return {
    ...(input.contentType && !isContentTypeGiven
      ? { [CONTENT_TYPE_HEADER]: input.contentType }
      : {}),
    ...headersOfCaller,
    ...asTrailExidHeaders({ trail: input.trail }),
  };
};
