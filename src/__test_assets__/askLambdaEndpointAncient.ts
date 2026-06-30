import {
  InvokeCommand,
  type InvokeCommandOutput,
  LambdaClient,
} from '@aws-sdk/client-lambda';

import { LambdaEndpointError } from '../domain.objects/LambdaEndpointError';
import { getDecodedPayload } from '../domain.operations/askLambdaEndpoint/serde/getDecodedPayload';
import { getParsedJson } from '../domain.operations/askLambdaEndpoint/serde/getParsedJson';
import { asLambdaEndpoint } from '../domain.operations/asLambdaEndpoint/asLambdaEndpoint';

/**
 * .what = simulates ancient-caller invocation pattern (pre-sdk-aws-lambda)
 * .why = tests backwards compat with ancient callers (no trail wrapper)
 *
 * key differences from askLambdaEndpoint:
 * - sends raw event (no { event, trail } wrapper)
 * - no trail injection
 * - handles flat errorMessage responses
 */
export const askLambdaEndpointAncient = async <TRequest, TResponse>(
  input: {
    which: { service: string; function: string };
    event: TRequest;
  },
  context: {
    env: { access: string; region: string };
  },
): Promise<TResponse> => {
  // build the endpoint from the selector + ambient access (computes slug = aws function name)
  const endpoint = asLambdaEndpoint({
    service: input.which.service,
    access: context.env.access,
    function: input.which.function,
  });

  // create lambda sdk instance
  const sdkLambda = new LambdaClient({ region: context.env.region });

  // invoke lambda with raw event (no wrapper)
  const response: InvokeCommandOutput = await sdkLambda.send(
    new InvokeCommand({
      FunctionName: endpoint.slug,
      Payload: Buffer.from(JSON.stringify(input.event)),
    }),
  );

  // check for invocation error
  if (response.StatusCode !== 200) {
    throw new LambdaEndpointError('lambda invocation failed', {
      endpoint,
      exid: null,
      statusCode: response.StatusCode,
    });
  }

  // check for absent payload
  if (!response.Payload) {
    throw new LambdaEndpointError('lambda returned no payload', {
      endpoint,
      exid: null,
    });
  }

  // decode payload
  const payloadString = getDecodedPayload({ payload: response.Payload });
  const parseResult = getParsedJson({ json: payloadString });
  if (!parseResult.success) {
    throw new LambdaEndpointError('lambda returned invalid json', {
      endpoint,
      exid: null,
      cause: parseResult.error,
    });
  }
  const parsed = parseResult.data;

  // detect ancient error response (flat errorMessage format)
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'errorMessage' in parsed
  ) {
    const errorResponse = parsed as {
      errorMessage: string;
      errorType?: string;
      causeMessage?: string;
      details?: unknown;
    };

    throw new LambdaEndpointError(errorResponse.errorMessage, {
      endpoint,
      exid: null,
      errorType: errorResponse.errorType,
      causeMessage: errorResponse.causeMessage,
      details: errorResponse.details,
    });
  }

  return parsed as TResponse;
};
