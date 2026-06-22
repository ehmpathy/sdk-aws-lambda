/**
 * .what = transforms CORS origins config to header value with dynamic origin match
 * .why = HTTP spec only allows ONE origin in Access-Control-Allow-Origin header
 *
 * .how = matches request origin against allowed list:
 *        - '*' returns '*' (unless credentials, then echoes request origin)
 *        - string[] checks if request origin in list, echoes that origin if matched
 *        - no match returns null (no CORS header should be set)
 */
export const getCorsOrigin = (input: {
  origins: string | string[];
  requestOrigin?: string | null;
  credentials?: boolean;
}): string | null => {
  const { origins, requestOrigin, credentials } = input;

  // wildcard origin with credentials - browsers require the specific origin to be echoed
  // ref: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors/CORSNotSupportingCredentials
  if (origins === '*' && credentials && requestOrigin) return requestOrigin;

  // wildcard origin without credentials constraint
  if (origins === '*') return '*';

  // single origin string (not wildcard)
  if (!Array.isArray(origins)) {
    // if request origin matches, return it; otherwise return configured origin
    if (requestOrigin && requestOrigin === origins) {
      return origins;
    }
    // no request origin or no match - return configured origin anyway
    // (may cause CORS failure but that's the expected behavior)
    return origins;
  }

  // array of origins: match against request origin
  if (requestOrigin && origins.includes(requestOrigin)) {
    return requestOrigin;
  }

  // no match - don't set CORS header (return null, not empty string)
  // note: if no requestOrigin provided, fall back to first origin for backwards compat
  if (!requestOrigin && origins.length > 0) {
    return origins[0]!;
  }

  return null;
};
