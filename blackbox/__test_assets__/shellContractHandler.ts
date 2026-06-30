/**
 * .what = introspection-enabled lambda handler for e2e acceptance tests
 * .why = proves getOneLambdaContract + getAllLambdaContracts retrieve real
 *        schemas over the wire from a deployed prep handler
 */
import { z } from 'zod';

import { genLambdaEndpoint } from '../../src/index';

export const shellContractSchema = {
  input: z.object({
    shellId: z.string(),
    size: z.number(),
  }),
  output: z.object({
    ok: z.literal(true),
    shellId: z.string(),
  }),
};

/**
 * .what = shell contract handler with prep access (introspection enabled)
 * .note = bundled and deployed to AWS via declastruct
 */
export const handler = genLambdaEndpoint(
  {
    schema: shellContractSchema,
    invoke: async ({ event }) => ({
      ok: true as const,
      shellId: event.shellId,
    }),
  },
  { env: { access: 'prep' } },
);
