/**
 * .what = introspection-enabled lambda handler whose schema references a
 *         domain-object via `.contract`, so introspection stamps the
 *         `x-domain-object` pragma the codegen captures
 * .why = proves end-to-end, real-service domain-object capture: the codegen run
 *        against this deployed handler must reconstruct SeaturtleSurfboard with
 *        its identity + metadata (the vision's "aha")
 */
import { DomainEntity } from 'domain-objects';
import { z } from 'zod';

import { genLambdaEndpoint } from '../../src/index';

export interface SeaturtleSurfboard {
  uuid: string;
  brand: string;
  length: { inches: number };
}
export class SeaturtleSurfboard
  extends DomainEntity<SeaturtleSurfboard>
  implements SeaturtleSurfboard
{
  public static primary = ['uuid'] as const;
  public static unique = ['brand', 'length'] as const;
  public static alias = { singular: 'surfboard', plural: 'surfboards' };
  public static schema = z.object({
    uuid: z.string(),
    brand: z.string(),
    length: z.object({ inches: z.number() }),
  });
}

export const surfboardContractSchema = {
  input: z.object({ uuid: z.string() }),
  output: z.object({ surfboard: SeaturtleSurfboard.contract }),
};

/**
 * .what = getSurfboard handler with prep access (introspection enabled)
 * .note = bundled and deployed to AWS via declastruct
 */
export const handler = genLambdaEndpoint(
  {
    schema: surfboardContractSchema,
    invoke: async ({ event }) => ({
      surfboard: {
        uuid: event.uuid,
        brand: 'seaturtle',
        length: { inches: 108 },
      },
    }),
  },
  { env: { access: 'prep' } },
);
