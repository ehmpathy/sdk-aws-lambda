/**
 * .what = sea turtle lambda handler for e2e acceptance tests
 * .why = proves genLambdaEndpoint works with real AWS deployment and trail propagation
 */
import { z } from 'zod';

import { genLambdaEndpoint } from '../../src/index';

export const goSurfSchema = {
  input: z.object({
    ocean: z.string(),
    style: z.enum(['longboard', 'shortboard', 'bodyboard']),
  }),
  output: z.object({
    success: z.literal(true),
    comment: z.string(),
    trailExid: z.string().nullable(),
  }),
};

/**
 * .what = go surf handler for e2e tests
 * .note = bundled and deployed to AWS via declastruct
 */
export const handler = genLambdaEndpoint.forAsk({
  schema: goSurfSchema,
  invoke: async ({ payload }, { log }) => ({
    success: true as const,
    comment: `caught a ${payload.style} wave in the ${payload.ocean}`,
    trailExid: log.trail?.exid ?? null,
  }),
});
