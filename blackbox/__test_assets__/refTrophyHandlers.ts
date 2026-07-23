/**
 * .what = introspection-enabled lambda handlers that prove domain-object
 *         REFERENCE capture over the real wire: a SurfTrophy whose fields
 *         reference OTHER dobjs by key (rider by primary, board by unique,
 *         sponsor by ref) via the REAL `X.contract.ref(by)` from
 *         domain-objects@0.33.0
 * .why = proves the vision's next chapter end-to-end against a deployed service:
 *        `.contract.ref(by)` → `z.toJSONSchema` over the wire → the codegen reads
 *        the `x-domain-object-ref` pragma → emits `RefBy*<typeof Svc...>`
 *
 * .note = one bundle, four named handler exports; each deployed as its own lambda
 *         (`svc-trophy-prep-getTrophy`, `-getRider`, `-getBoard`, `-getSponsor`).
 *         the three peer endpoints surface each referenced dobj WHOLE so the
 *         trophy's refs bind against their generated prefixed resources.
 */
import { DomainEntity, DomainLiteral } from 'domain-objects';
import { z } from 'zod';

import { genLambdaEndpoint } from '../../src/index';

// the three referenced dobjs — each surfaced whole by a peer endpoint
export interface Seaturtle {
  uuid: string;
  name: string;
}
export class Seaturtle extends DomainEntity<Seaturtle> implements Seaturtle {
  public static primary = ['uuid'] as const;
  public static alias = { singular: 'seaturtle', plural: 'seaturtles' };
  public static schema = z.object({ uuid: z.string(), name: z.string() });
}

export interface Surfboard {
  brand: string;
  lengthInInches: number;
}
export class Surfboard extends DomainLiteral<Surfboard> implements Surfboard {
  public static unique = ['brand', 'lengthInInches'] as const;
  public static alias = { singular: 'surfboard', plural: 'surfboards' };
  public static schema = z.object({
    brand: z.string(),
    lengthInInches: z.number(),
  });
}

export interface Sponsor {
  uuid: string;
  handle: string;
}
export class Sponsor extends DomainEntity<Sponsor> implements Sponsor {
  public static primary = ['uuid'] as const;
  public static unique = ['handle'] as const;
  public static alias = { singular: 'sponsor', plural: 'sponsors' };
  public static schema = z.object({ uuid: z.string(), handle: z.string() });
}

// the SurfTrophy dobj: references Seaturtle (primary), Surfboard (unique),
// Sponsor (ref) — by key, NOT by full embed — via the REAL `X.contract.ref(by)`
export interface SurfTrophy {
  uuid: string;
  rider: { uuid: string };
  board: { brand: string; lengthInInches: number };
  sponsor: { uuid: string } | { handle: string };
}
export class SurfTrophy extends DomainEntity<SurfTrophy> implements SurfTrophy {
  public static primary = ['uuid'] as const;
  public static alias = { singular: 'trophy', plural: 'trophies' };
  public static schema = z.object({
    uuid: z.string(),
    rider: Seaturtle.contract.ref('primary'),
    board: Surfboard.contract.ref('unique'),
    sponsor: Sponsor.contract.ref('ref'),
  });
}

/**
 * .what = getTrophy — surfaces a SurfTrophy that holds its three refs
 */
export const getTrophy = genLambdaEndpoint(
  {
    schema: {
      input: z.object({ uuid: z.string() }),
      output: z.object({ trophy: SurfTrophy.contract }),
    },
    invoke: async ({ event }) => ({
      trophy: {
        uuid: event.uuid,
        rider: { uuid: 's1' },
        board: { brand: 'seaturtle', lengthInInches: 108 },
        sponsor: { uuid: 'sp1' },
      },
    }),
  },
  { env: { access: 'prep' } },
);

/**
 * .what = getRider — surfaces the referenced Seaturtle WHOLE (binds rider ref)
 */
export const getRider = genLambdaEndpoint(
  {
    schema: {
      input: z.object({ uuid: z.string() }),
      output: z.object({ rider: Seaturtle.contract }),
    },
    invoke: async ({ event }) => ({ rider: { uuid: event.uuid, name: 'crush' } }),
  },
  { env: { access: 'prep' } },
);

/**
 * .what = getBoard — surfaces the referenced Surfboard WHOLE (binds board ref)
 */
export const getBoard = genLambdaEndpoint(
  {
    schema: {
      input: z.object({ brand: z.string() }),
      output: z.object({ board: Surfboard.contract }),
    },
    invoke: async ({ event }) => ({
      board: { brand: event.brand, lengthInInches: 108 },
    }),
  },
  { env: { access: 'prep' } },
);

/**
 * .what = getSponsor — surfaces the referenced Sponsor WHOLE (binds sponsor ref)
 */
export const getSponsor = genLambdaEndpoint(
  {
    schema: {
      input: z.object({ uuid: z.string() }),
      output: z.object({ sponsor: Sponsor.contract }),
    },
    invoke: async ({ event }) => ({
      sponsor: { uuid: event.uuid, handle: 'oceanco' },
    }),
  },
  { env: { access: 'prep' } },
);
