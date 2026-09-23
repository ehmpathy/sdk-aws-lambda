/**
 * .what = introspection-enabled lambda handler whose schema references a
 *         domain-object via `X.contract()`, so introspection stamps the
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
  output: z.object({ surfboard: SeaturtleSurfboard.contract() }),
};

/**
 * .what = getSurfboard handler with prep access (introspection enabled)
 * .note = bundled and deployed to AWS via declastruct
 */
export const handler = genLambdaEndpoint(
  {
    schema: surfboardContractSchema,
    // .note = `X.contract()` coerces, so its `TOutput` is a live instance — `invoke` owes a
    //         `new SeaturtleSurfboard(...)` rather than a prop bag. this is the DEPLOYED twin
    //         of `refTrophyHandlers.ts`, and it carried a bag while that file constructed
    //         instances at all four of its sites (rule.require.sweep-the-defect-class)
    // ⚠️ .note = the wire bytes are unchanged, and that is MEASURED rather than argued —
    //         `local.dobjWire.acceptance.test.ts` invokes this handler and diffs its serialized
    //         return against the prop bag's. so the deployed bundle needs no redeploy for this;
    //         what changes is that the fixture now sits on the SAME side of the documented
    //         contract as its twin
    //
    //         ⚠️ TWO drafts of this note argued the point rather than ran it, and each named a
    //         different wrong reason. `withImmute` DOES attach an own `clone` to the coerced
    //         value; what keeps it off the wire is that its value is a FUNCTION, which
    //         `JSON.stringify` drops outright. its `enumerable: false` flag is a second,
    //         independent guard — and the revert proves it is not the load-bearing one: flip
    //         that dist line and the bytes do not move. `[case2]` there pins both
    invoke: async ({ event }) => ({
      surfboard: new SeaturtleSurfboard({
        uuid: event.uuid,
        brand: 'seaturtle',
        length: { inches: 108 },
      }),
    }),
  },
  { env: { access: 'prep' } },
);
