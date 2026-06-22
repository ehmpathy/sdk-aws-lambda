/**
 * .what = HTTP status codes enum
 * .why = provides typed status codes for API responses
 *
 * ref: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
 */
export enum HttpStatusCode {
  // success
  SUCCESS_200 = 200,
  CREATED_201 = 201,
  ACCEPTED_202 = 202,
  NO_CONTENT_204 = 204,

  // redirect
  MOVED_PERMANENTLY_301 = 301,
  FOUND_302 = 302,
  NOT_MODIFIED_304 = 304,

  // client error
  BAD_REQUEST_400 = 400,
  UNAUTHORIZED_401 = 401,
  FORBIDDEN_403 = 403,
  NOT_FOUND_404 = 404,
  METHOD_NOT_ALLOWED_405 = 405,
  CONFLICT_409 = 409,
  UNPROCESSABLE_ENTITY_422 = 422,
  TOO_MANY_REQUESTS_429 = 429,

  // server error
  INTERNAL_SERVER_ERROR_500 = 500,
  NOT_IMPLEMENTED_501 = 501,
  BAD_GATEWAY_502 = 502,
  SERVICE_UNAVAILABLE_503 = 503,
  GATEWAY_TIMEOUT_504 = 504,
}
