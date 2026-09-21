import type { LambdaClient } from '@aws-sdk/client-lambda';

import type { ContextAwsLambdaCaller } from '../../domain.objects/ContextAwsLambdaCaller';
import type { LambdaEndpointSchema } from '../../domain.objects/LambdaEndpointSchema';
import { LambdaIntrospectionBlockedError } from '../../domain.objects/LambdaIntrospectionBlockedError';
import { LambdaServiceNotFoundError } from '../../domain.objects/LambdaServiceNotFoundError';
import { asLambdaEndpoint } from '../asLambdaEndpoint/asLambdaEndpoint';
import { getOneLambdaContract } from '../getOneLambdaContract/getOneLambdaContract';
import { throwIfCredentialsError } from '../lambdaEndpointWire/error/throwIfCredentialsError';
import { asContractRecord } from './lambdaContract/asContractRecord';
import { getAllLambdaFunctionsByPrefix } from './lambdaFunction/getAllLambdaFunctionsByPrefix';

/**
 * .what = get all lambda contracts for a service
 * .why = enables runtime schema discovery for sdk generation
 *
 * behavior:
 *   - lists all lambda endpoints by service+access prefix
 *   - introspects each via getOneLambdaContract
 *   - all-or-none: if any endpoint does not support introspection, the whole
 *     batch fails loud (a partial contract set would generate a broken sdk)
 *   - returns as record keyed by bare function name (endpoint.function)
 *
 * .throws LambdaServiceNotFoundError — no endpoints found for service
 * .throws LambdaIntrospectionBlockedError — introspection blocked in prod/test
 * .throws LambdaIntrospectionNotSupportedError — an endpoint in the service does
 *         not support introspection (named in the error); the batch is all-or-none
 */
export const getAllLambdaContracts = async (
  input: {
    which: {
      service: string;
    };
  },
  context: ContextAwsLambdaCaller,
): Promise<Record<string, LambdaEndpointSchema>> => {
  // fail fast if introspection is blocked: only prep exposes schemas
  // (gate up front so no request is made and no schema can leak)
  if (context.env.access !== 'prep') {
    throw new LambdaIntrospectionBlockedError(
      `introspection is only available in prep environment, got: ${context.env.access}`,
      {
        service: input.which.service,
        access: context.env.access,
        hint: 're-run with --env prep',
      },
    );
  }

  // build prefix through asLambdaEndpoint — the SINGLE owner of the slug format
  // (define.lambda-endpoint-ubiqlang). the prefix is the slug of an endpoint with
  // an empty function: '{service}-{access}-'. a slug built through the owner cannot
  // fork the join convention here (this was the 2nd hand-rolled speaker; now one).
  const prefix = asLambdaEndpoint({
    service: input.which.service,
    access: context.env.access,
    function: '',
  }).slug;

  // get or create LambdaClient (genLambdaSdk always returns valid client)
  const sdkLambda: LambdaClient =
    context.aws?.lambda?.sdk ??
    (await import('../../access/sdks/lambda/genLambdaSdk').then((m) =>
      m.genLambdaSdk({ env: { region: context.env.region } }),
    ));

  // discover endpoint slugs by prefix. a creds failure surfaces on this first aws
  // call — map it to a caller-must-fix LambdaCredentialsAbsentError (with an unlock
  // hint), not a raw aws CredentialsProviderError
  const slugs = await getAllLambdaFunctionsByPrefix(
    { prefix },
    { sdkLambda },
  ).catch((error: unknown) =>
    throwIfCredentialsError({
      error,
      message: 'aws credentials are absent or expired; cannot introspect',
      access: context.env.access,
      metadata: {
        service: input.which.service,
        access: context.env.access,
      },
    }),
  );

  // throw if no endpoints found
  if (slugs.length === 0) {
    throw new LambdaServiceNotFoundError(
      `no lambda functions found for service: ${input.which.service}`,
      {
        service: input.which.service,
        prefix,
        hint: 'check the --for service name and verify it is deployed to the prep environment',
      },
    );
  }

  // log the discovered endpoints for observability
  context.log.debug('getAllLambdaContracts.discovered', {
    service: input.which.service,
    count: slugs.length,
  });

  // reuse the resolved sdk so getOneLambdaContract does not rebuild it per call
  const contextWithSdk = { ...context, aws: { lambda: { sdk: sdkLambda } } };

  // introspect each endpoint in parallel via getOneLambdaContract (build on getOne)
  // all-or-none: an unsupported endpoint rejects here and aborts the batch
  const entries = await Promise.all(
    slugs.map(async (slug) => {
      const endpoint = asLambdaEndpoint({ slug });
      const schema = await getOneLambdaContract(
        {
          which: {
            service: endpoint.service,
            function: endpoint.function,
          },
        },
        contextWithSdk,
      );
      return [endpoint.function, schema] as [string, LambdaEndpointSchema];
    }),
  );

  // assemble record keyed by bare function name
  return asContractRecord(entries);
};

/**
 * .what = input type for getAllLambdaContracts
 * .why = exported for sdk consumers
 */
export type GetAllLambdaContractsInput = Parameters<
  typeof getAllLambdaContracts
>[0];

/**
 * .what = context type for getAllLambdaContracts
 * .why = exported for sdk consumers
 */
export type GetAllLambdaContractsContext = Parameters<
  typeof getAllLambdaContracts
>[1];
