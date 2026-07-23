import type { LambdaClient } from '@aws-sdk/client-lambda';

import type { ContextAwsLambdaCaller } from '../../domain.objects/ContextAwsLambdaCaller';
import { LambdaCredentialsAbsentError } from '../../domain.objects/LambdaCredentialsAbsentError';
import type { LambdaEndpointSchema } from '../../domain.objects/LambdaEndpointSchema';
import { LambdaIntrospectionBlockedError } from '../../domain.objects/LambdaIntrospectionBlockedError';
import { LambdaServiceNotFoundError } from '../../domain.objects/LambdaServiceNotFoundError';
import { asLambdaEndpoint } from '../asLambdaEndpoint/asLambdaEndpoint';
import { getOneLambdaContract } from '../getOneLambdaContract/getOneLambdaContract';
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

  // build prefix from service + access
  const prefix = `${input.which.service}-${context.env.access}-`;

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
      service: input.which.service,
      access: context.env.access,
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
 * .what = decide whether an error is an aws sdk credentials failure
 * .why = a creds failure is caller-must-fix (unlock + retry), not a malfunction —
 *        the discovery boundary maps it to a hinted LambdaCredentialsAbsentError
 */
const getIsCredentialsError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();
  return (
    name.includes('credential') ||
    message.includes('credential') ||
    (message.includes('security token') && message.includes('expired'))
  );
};

/**
 * .what = map an aws credentials failure to a hinted LambdaCredentialsAbsentError
 * .why = surface a creds failure with an unlock hint (caller-must-fix) rather than a
 *        raw aws error; any non-creds error rethrows unchanged. returns `never` — it
 *        always throws — so the caller keeps a non-null slug list.
 */
const throwIfCredentialsError = (input: {
  error: unknown;
  service: string;
  access: string;
}): never => {
  if (!getIsCredentialsError(input.error)) throw input.error;
  throw new LambdaCredentialsAbsentError(
    'aws credentials are absent or expired; cannot introspect',
    {
      service: input.service,
      access: input.access,
      hint: 'unlock prep creds (e.g. `rhx keyrack unlock --owner ehmpath --env prep`), then re-run',
      cause: input.error instanceof Error ? input.error : undefined,
    },
  );
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
