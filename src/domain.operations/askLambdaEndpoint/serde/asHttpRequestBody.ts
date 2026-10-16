/**
 * .what = the content type a json request body is sent under
 * .why = one name for the literal, so the body cast and the header that declares it cannot drift
 */
const CONTENT_TYPE_JSON = 'application/json';

/**
 * .what = casts a request body into the bytes fetch sends, and the content type that declares them
 * .why = a caller hands a string or an object, as `asLambdaEvent.fromApiGateway` takes one. a string
 *        crosses as is; any other value is json, and says so in its content type
 *
 * | body | text | contentType |
 * |------|------|-------------|
 * | absent | absent | none |
 * | string | the string | none — the caller owns its sense |
 * | other | `JSON.stringify` of it | `application/json` |
 */
export const asHttpRequestBody = (input: {
  body: unknown;
}): { text: string | undefined; contentType: string | null } => {
  if (input.body === undefined) return { text: undefined, contentType: null };
  if (typeof input.body === 'string')
    return { text: input.body, contentType: null };
  return { text: JSON.stringify(input.body), contentType: CONTENT_TYPE_JSON };
};
