import type { LambdaClient } from '@aws-sdk/client-lambda';

import { sdkLambdaGetAllFunctions } from './sdkLambdaGetAllFunctions';

/**
 * .what = filter slugs by prefix
 * .why = extract transformation from orchestrator for clear grain separation
 */
const getMatchedSlugs = (input: {
  slugs: string[];
  prefix: string;
}): string[] => {
  return input.slugs.filter((slug) => slug.startsWith(input.prefix));
};

/**
 * .what = recursively fetch pages of functions and collect matched slugs
 * .why = avoids mutation via push, enables functional pagination
 */
const collectPagesRecursive = async (
  input: {
    prefix: string;
    marker: string | undefined;
    collected: string[];
  },
  context: { sdkLambda: LambdaClient },
): Promise<string[]> => {
  // fetch page from communicator
  const page = await sdkLambdaGetAllFunctions(
    { marker: input.marker },
    { sdkLambda: context.sdkLambda },
  );

  // filter by prefix via transformer
  const matched = getMatchedSlugs({
    slugs: page.slugs,
    prefix: input.prefix,
  });

  // combine collected with this page
  const nextCollected = [...input.collected, ...matched];

  // recurse if more pages, otherwise return
  if (!page.nextMarker) return nextCollected;
  return collectPagesRecursive(
    { ...input, marker: page.nextMarker, collected: nextCollected },
    context,
  );
};

/**
 * .what = get all lambda endpoint slugs that match a prefix
 * .why = enables discovery of lambda endpoints for contract introspection
 *
 * behavior:
 *   - paginates through all functions in the aws account
 *   - filters by prefix
 *   - returns slugs (aws function names, not full ARNs)
 */
export const getAllLambdaFunctionsByPrefix = async (
  input: {
    prefix: string;
  },
  context: {
    sdkLambda: LambdaClient;
  },
): Promise<string[]> => {
  return collectPagesRecursive(
    { prefix: input.prefix, marker: undefined, collected: [] },
    context,
  );
};
