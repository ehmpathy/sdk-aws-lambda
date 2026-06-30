import type { SimpleInMemoryCache } from 'simple-in-memory-cache';
import type { SimpleCache } from 'with-simple-cache';

import { genLambdaSdk } from '../../access/sdks/lambda/genLambdaSdk';
import type { ContextAwsLambdaCaller } from '../../domain.objects/ContextAwsLambdaCaller';
import { asLambdaEndpoint } from '../asLambdaEndpoint/asLambdaEndpoint';
import { asCachedExecutor } from './cache/asCachedExecutor';
import { getAskLambdaCacheKey } from './cache/getAskLambdaCacheKey';
import { getExidFromContext } from './context/getExidFromContext';
import { getLogForExidExtraction } from './context/getLogForExidExtraction';
import type {
  InvocationContext,
  InvocationInput,
} from './invoke/executeLambdaInvocation';
import { getLambdaPayload } from './serde/getLambdaPayload';

/**
 * .what = invokes a lambda endpoint with trail propagation
 * .why = enables service-to-service calls with observability
 *
 * .note = pass context.cache to enable response cache
 * .note = use struct: 'ancient' for handlers that don't understand wrapped payloads
 */
export const askLambdaEndpoint = async <TRequest, TResponse>(
  input: {
    which: {
      service: string;
      function: string;
    };
    event: TRequest;
    /**
     * .what = structure options
     * .why = extensible for future structure versions
     */
    struct?: {
      /**
       * .what = payload format to send
       * .why = ancient handlers don't understand wrapped { event, trail } structure
       * .default = 'contemp' (wrapped with trail)
       */
      payload?: 'ancient' | 'contemp';
    };
  },
  context: ContextAwsLambdaCaller & {
    cache?: {
      response?: SimpleCache<TResponse>;
      dedupe?: SimpleInMemoryCache<TResponse>;
    };
  },
): Promise<TResponse> => {
  // extract or generate trail exid
  const logForExidExtraction = getLogForExidExtraction({ log: context.log });
  const { exid, source: exidSource } = getExidFromContext({
    log: logForExidExtraction,
  });

  // log when trail exid was generated (indicates caller did not propagate trail)
  if (exidSource === 'generated') {
    context.log.debug('trail.exid.generated', {
      exid,
      note: 'no trail exid in context, generated new one',
    });
  }

  // build the endpoint from the selector + ambient access (computes slug)
  const endpoint = asLambdaEndpoint({
    service: input.which.service,
    access: context.env.access,
    function: input.which.function,
  });

  // build payload (ancient handlers expect flat event, contemp expect wrapped)
  const structOfPayload = input.struct?.payload ?? 'contemp';
  const payload =
    structOfPayload === 'ancient'
      ? input.event
      : getLambdaPayload({ event: input.event, trail: { exid } });

  // get or create LambdaClient
  const sdkLambda = genLambdaSdk({
    sdk: context.aws?.lambda?.sdk,
    env: { region: context.env.region },
  });

  // prepare invocation input + context
  const invocationInput: InvocationInput = { endpoint, payload, exid };
  const invocationContext: InvocationContext = {
    sdkLambda,
    log: context.log,
  };

  // build cache key generator
  const getCacheKey = (): string =>
    getAskLambdaCacheKey({
      endpoint,
      event: input.event as Record<string, unknown>,
    });

  // get executor with cache wrapper
  const execute = asCachedExecutor<TResponse>({
    ...context.cache,
    getCacheKey,
  });

  // execute invocation
  return execute(invocationInput, invocationContext);
};

/**
 * .what = input type for askLambdaEndpoint
 * .why = exported for sdk consumers
 */
export type AskLambdaEndpointInput<TRequest> = Parameters<
  typeof askLambdaEndpoint<TRequest, unknown>
>[0];

/**
 * .what = context type for askLambdaEndpoint
 * .why = exported for sdk consumers
 */
export type AskLambdaEndpointContext = Parameters<typeof askLambdaEndpoint>[1];
