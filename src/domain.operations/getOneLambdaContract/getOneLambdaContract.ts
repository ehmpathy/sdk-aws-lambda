import type { LambdaClient } from '@aws-sdk/client-lambda';
import { UnexpectedCodePathError } from 'helpful-errors';

import {
  type LambdaInvokeResponse,
  sdkLambdaInvoke,
} from '../../access/sdks/lambda/sdkLambdaInvoke';
import type { ContextAwsLambdaCaller } from '../../domain.objects/ContextAwsLambdaCaller';
import type { LambdaEndpoint } from '../../domain.objects/LambdaEndpoint';
import type { LambdaEndpointSchema } from '../../domain.objects/LambdaEndpointSchema';
import { LambdaFunctionNotFoundError } from '../../domain.objects/LambdaFunctionNotFoundError';
import { LambdaIntrospectionBlockedError } from '../../domain.objects/LambdaIntrospectionBlockedError';
import { LambdaIntrospectionNotSupportedError } from '../../domain.objects/LambdaIntrospectionNotSupportedError';
import { asLambdaEndpoint } from '../asLambdaEndpoint/asLambdaEndpoint';
import { asLambdaEndpointSchema } from './asLambdaEndpointSchema';

/**
 * .what = determines if error indicates lambda not found
 * .why = extract allowlist logic from orchestrator for readability
 */
const getIsLambdaFunctionNotFoundError = (input: { error: Error }): boolean => {
  return (
    input.error.name === 'ResourceNotFoundException' ||
    input.error.message.includes('Function not found')
  );
};

/**
 * .what = determines if error indicates access denied
 * .why = extract allowlist logic from orchestrator for readability
 */
const getIsAccessDeniedError = (input: { error: Error }): boolean => {
  return (
    input.error.name === 'AccessDeniedException' ||
    input.error.message.includes('Access Denied')
  );
};

/**
 * .what = get the contract schema from a lambda endpoint
 * .why = enables runtime schema discovery for sdk generation
 *
 * .throws LambdaFunctionNotFoundError — endpoint does not exist
 * .throws LambdaIntrospectionBlockedError — introspection blocked in prod/test
 * .throws LambdaIntrospectionNotSupportedError — endpoint does not support introspection
 */
export const getOneLambdaContract = async (
  input: {
    which: {
      service: string;
      function: string;
    };
  },
  context: ContextAwsLambdaCaller,
): Promise<LambdaEndpointSchema> => {
  // build the endpoint from the selector + ambient access (computes slug)
  const endpoint = asLambdaEndpoint({
    service: input.which.service,
    access: context.env.access,
    function: input.which.function,
  });

  // log the introspection attempt for observability
  context.log.debug('getOneLambdaContract.invoke', { slug: endpoint.slug });

  // fail fast if introspection is blocked: only prep exposes schemas
  // (gate up front so no request is made and no schema can leak)
  if (endpoint.access !== 'prep') {
    throw new LambdaIntrospectionBlockedError(
      `introspection is only available in prep environment, got: ${endpoint.access}`,
      { endpoint },
    );
  }

  // get or create LambdaClient (genLambdaSdk always returns valid client)
  const sdkLambda: LambdaClient =
    context.aws?.lambda?.sdk ??
    (await import('../../access/sdks/lambda/genLambdaSdk').then((m) =>
      m.genLambdaSdk({ env: { region: context.env.region } }),
    ));

  // invoke endpoint with introspect payload
  let response: LambdaInvokeResponse;
  try {
    response = await sdkLambdaInvoke(
      { slug: endpoint.slug, payload: { introspect: 'schema' } },
      { sdkLambda },
    );
  } catch (error) {
    // endpoint not found (or access denied → same caller experience) → clear error
    const isNotFound =
      error instanceof Error &&
      (getIsLambdaFunctionNotFoundError({ error }) ||
        getIsAccessDeniedError({ error }));
    if (isNotFound) {
      throw new LambdaFunctionNotFoundError(
        `lambda function not found: ${endpoint.slug}`,
        { endpoint },
      );
    }

    // wrap unexpected errors with context for diagnosis
    throw new UnexpectedCodePathError(
      `lambda introspection failed: ${error instanceof Error ? error.message : String(error)}`,
      { endpoint, cause: error instanceof Error ? error : undefined },
    );
  }

  // function error → handler threw on the introspect payload (access is prep here)
  if (response.functionError) {
    throw new LambdaIntrospectionNotSupportedError(
      `lambda does not support introspection (handler-error): ${endpoint.slug}`,
      {
        endpoint,
        reason: 'handler-error',
        functionError: response.functionError,
        hint: 'ensure handler uses genLambdaEndpoint with zod schemas and env config',
      },
    );
  }

  // absent payload → invoke returned no body to parse
  if (!response.payload) {
    throw new LambdaIntrospectionNotSupportedError(
      `lambda does not support introspection (empty-payload): ${endpoint.slug}`,
      {
        endpoint,
        reason: 'empty-payload',
        hint: 'ensure handler uses genLambdaEndpoint with zod schemas and env config',
      },
    );
  }

  // cast payload into schema; throws not-supported (non-schema-payload) if invalid
  return asLambdaEndpointSchema({ payload: response.payload, endpoint });
};

/**
 * .what = input type for getOneLambdaContract
 * .why = exported for sdk consumers
 */
export type GetOneLambdaContractInput = Parameters<
  typeof getOneLambdaContract
>[0];

/**
 * .what = context type for getOneLambdaContract
 * .why = exported for sdk consumers
 */
export type GetOneLambdaContractContext = Parameters<
  typeof getOneLambdaContract
>[1];

/**
 * .what = re-export LambdaEndpoint type for convenience
 * .why = callers of getOneLambdaContract operate on endpoints
 */
export type { LambdaEndpoint };
