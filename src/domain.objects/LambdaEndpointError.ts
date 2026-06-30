import { HelpfulError } from 'helpful-errors';

import type { LambdaEndpoint } from './LambdaEndpoint';

/**
 * .what = error for failed lambda invocations via askLambdaEndpoint
 * .why = provides rich context for debug: endpoint, exid, cause
 */
export interface LambdaEndpointErrorMetadata {
  /**
   * the endpoint that was invoked (service, access, function, slug)
   */
  endpoint: LambdaEndpoint;

  /**
   * the exid (execution id) for trail correlation
   */
  exid: string | null;

  /**
   * the error type returned by the lambda (e.g., 'Error', 'ValidationError')
   */
  errorType?: string;

  /**
   * the http status code from the lambda invocation
   * non-200 indicates invocation itself failed (throttle, permission, not found)
   */
  statusCode?: number;

  /**
   * the stack trace from the remote lambda
   */
  stackTrace?: string;

  /**
   * the root cause error, if wrapped
   */
  cause?: Error;

  /**
   * additional error details from the lambda response
   */
  details?: unknown;

  /**
   * cause message from lambda response (when cause is remote)
   */
  causeMessage?: string;
}

export class LambdaEndpointError extends HelpfulError<LambdaEndpointErrorMetadata> {
  public static code = { http: 502, slug: 'LAMBDA_ENDPOINT_ERROR' } as const;

  constructor(message: string, metadata: LambdaEndpointErrorMetadata) {
    super(message, metadata);
    this.name = 'LambdaEndpointError';
  }
}
