import { getParsedJson } from '../../lambdaEndpointWire/serde/getParsedJson';

/**
 * .what = reads a response body's json out of its text, or null when it holds none
 * .why = an endpoint answers json, but a gateway's own 404 or 502 answers html or empty. null says
 *        "no json here" without a throw; the raw text travels beside it, so no data is hidden
 *
 * .note = null is not a swallow: the caller of `viaApiGateway` always receives the raw `text` too
 */
export const getOneBodyFromHttpText = (input: { text: string }): unknown => {
  if (!input.text) return null;
  const parsed = getParsedJson({ json: input.text });
  return parsed.success ? parsed.data : null;
};
