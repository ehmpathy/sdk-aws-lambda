/**
 * .what = transforms http status code to actionable hint message
 * .why = helps humans understand and address lambda invocation failures
 */
export const getStatusCodeHint = (statusCode: number): string => {
  // check common aws lambda status codes
  if (statusCode === 400) return 'bad request — check payload format and size';
  if (statusCode === 403)
    return 'access denied — check iam permissions for lambda:InvokeFunction';
  if (statusCode === 404)
    return 'function not found — verify service name, access level, and function name are correct';
  if (statusCode === 408)
    return 'request timeout — consider increasing caller timeout';
  if (statusCode === 413)
    return 'payload too large — reduce request size (max 6MB sync, 256KB async)';
  if (statusCode === 429)
    return 'rate limit exceeded — implement backoff or request quota increase';
  if (statusCode === 500)
    return 'internal error — check lambda function logs in cloudwatch';
  if (statusCode === 502)
    return 'service error — lambda service unavailable, retry with backoff';
  if (statusCode === 503)
    return 'service unavailable — lambda service temporarily unavailable';
  if (statusCode === 504)
    return 'gateway timeout — lambda execution exceeded timeout';

  // generic fallback with status code
  return `status ${statusCode} — check aws lambda documentation for this status code`;
};
