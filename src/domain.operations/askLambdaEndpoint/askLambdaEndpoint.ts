import type { SimpleInMemoryCache } from 'simple-in-memory-cache';
import type { SimpleCache } from 'with-simple-cache';

import { genLambdaSdk } from '../../access/sdks/lambda/genLambdaSdk';
import type { ContextAwsLambdaCaller } from '../../domain.objects/ContextAwsLambdaCaller';
import type { LambdaEndpointDialect } from '../../domain.objects/LambdaEndpointDialect';
import { asLambdaEndpoint } from '../asLambdaEndpoint/asLambdaEndpoint';
import { getOneTrailExid } from '../lambdaEndpointWire/context/getOneTrailExid';
import { asCachedExecutor } from './cache/asCachedExecutor';
import { getAskLambdaCacheKey } from './cache/getAskLambdaCacheKey';
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
      payload?: LambdaEndpointDialect;
    };
  },
  context: ContextAwsLambdaCaller & {
    cache?: {
      response?: SimpleCache<TResponse>;
      dedupe?: SimpleInMemoryCache<TResponse>;
    };
  },
): Promise<TResponse> => {
  // extract or generate the trail exid, and report the fallback if one was made.
  // shared with `runLambdaEndpoint.onSerialized` so the two loci cannot diverge
  // on the diagnostic — see `getOneTrailExid` for why that parity is structural
  // rather than a comment.
  const exid = getOneTrailExid({ log: context.log });

  // build the endpoint from the selector + ambient access (computes slug)
  const endpoint = asLambdaEndpoint({
    service: input.which.service,
    access: context.env.access,
    function: input.which.function,
  });

  // build payload — contemp wraps in `{ event, trail }`, ancient sends it flat
  //
  // 🔴 the branch tests for CONTEMP, so an unrecognized dialect falls to ANCIENT
  //    (rule.require.contemp-must-self-identify). we author every contemp caller,
  //    so a value we do not recognize was not written by one — and the fallback
  //    must be the dialect that assumes less. a fall to contemp would wrap a
  //    payload for a handler that never learned to unwrap it.
  //
  //    ⚠️ ABSENT is not unrecognized: it is the documented default, and it stays
  //       contemp so trail propagation holds for every caller that omits `struct`.
  const structOfPayload = input.struct?.payload ?? 'contemp';
  const payload =
    structOfPayload === 'contemp'
      ? getLambdaPayload({ event: input.event, trail: { exid } })
      : input.event;

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
