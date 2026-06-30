import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';

/**
 * .what = transform array of [functionName, schema] tuples to Record
 * .why = enables keyed lookup of contracts by function name
 */
export const asContractRecord = (
  contracts: Array<[string, LambdaEndpointSchema]>,
): Record<string, LambdaEndpointSchema> => {
  return Object.fromEntries(contracts);
};
