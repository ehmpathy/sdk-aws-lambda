/**
 * .what = introspection-enabled lambda handlers that prove domain-object
 *         REFERENCE capture over the real wire: a SurfTrophy whose fields
 *         reference OTHER dobjs by key (rider by primary, board by unique,
 *         sponsor by ref) via the REAL `X.contract().ref(by)`
 * .why = proves the vision's next chapter end-to-end against a deployed service:
 *        `.contract().ref(by)` → `z.toJSONSchema` over the wire → the codegen reads
 *        the `x-domain-object-ref` pragma → emits `RefBy*<typeof Svc...>`
 *
 * .note = one bundle, four named handler exports; each deployed as its own lambda
 *         (`svc-trophy-prep-getTrophy`, `-getRider`, `-getBoard`, `-getSponsor`).
 *         the three peer endpoints surface each referenced dobj WHOLE so the
 *         trophy's refs bind against their generated prefixed resources.
 *
 * .note = ⚠️ FOUR exported operations in one file is a deliberate exception to
 *         `rule.require.single-responsibility` + `rule.require.sync-filename-opname`, not
 *         drift. esbuild bundles ONE entrypoint into ONE zip, and declastruct points four
 *         lambda resources at that zip with four `Handler` values — so a file per operation
 *         would mean four bundles of the same four dobj declarations, and the `SurfTrophy`
 *         refs would then bind across bundle boundaries. the filename names the BUNDLE,
 *         which is the unit this file actually is
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
// Sponsor (ref) — by key, NOT by full embed — via the REAL `X.contract().ref(by)`
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
    rider: Seaturtle.contract().ref('primary'),
    board: Surfboard.contract().ref('unique'),
    sponsor: Sponsor.contract().ref(),
  });
}

/**
 * .what = getTrophy — surfaces a SurfTrophy that holds its three refs
 */
export const getTrophy = genLambdaEndpoint(
  {
    schema: {
      input: z.object({ uuid: z.string() }),
      output: z.object({ trophy: SurfTrophy.contract() }),
    },
    // .note = `X.contract()` coerces, so its OUTPUT type is a live instance — `invoke` owes a
    //         `new SurfTrophy(...)` rather than a prop bag. every endpoint in this file
    //         constructs one, so all four exercise the coerce at the output border
    //
    // ⚠️ .defect = STAYS PARTIAL, NOT FIXED — the compiler demands the instance HERE and
    //              lets a prop bag through for the three peers below. so the instance rule
    //              is a CONVENTION at 3 of these 4 sites, and a future author who returns a
    //              bag there meets no red
    //   .proof it is live = swap this `invoke` for a prop bag and tsc reports
    //                       `Property 'clone' is missing … required in type
    //                       WithImmute<SurfTrophy>`. make the same swap in `getRider`,
    //                       `getBoard`, or `getSponsor` and it COMPILES. both measured; the
    //                       three peers carried bags until this pass constructed them
    //   .the cause = `SurfTrophy`'s `sponsor` is a union (`.ref()` yields one), so tsc
    //                cannot unify `TOutput` from the `invoke` return and falls back to the
    //                schema's type, which is the instance. the three peers unify, so the
    //                fallback never happens and the demand never fires
    //   .why unrepaired = it is a property of tsc's inference, never of this sdk. no change
    //                     available here widens the demand to the peers
    //   ⇒ the instance is the CONTRACT; the compiler is not the CLAMP. the type recovery
    //     over the bare `.contract` getter (`ZodSchema<any>`) is real and it is partial —
    //     see `1.vision.yield.md`, "what the bump costs"
    //
    // .the family, SWEPT and CLOSED = `grepsafe 'output: z\.object\(\{ \w+: \w+\.contract\(\)'`
    //   reaches 14 output-border positions across 6 files, and every one now hands back an
    //   instance. membership rule: an `output:` position whose value holds an `X.contract()`.
    //   ⚠️ four reviewers raised this in one round, and they were RIGHT — 6 of the 14 were
    //   bags, among them `surfboardContractHandler.ts`, the DEPLOYED twin of this very file.
    //   the membership rule I had recorded ("their subject is the codegen pragma path") was
    //   authored to fit the set I happened to touch: it is true of THIS file too, and this
    //   file was migrated. a rule that does not discriminate is a rationalization
    //   (rule.require.sweep-the-defect-class — grep the SUBJECT, never the set you fixed)
    //   .the one non-instance left = `createCapturableHandlers.getJobs` returns `[]`, which
    //    holds no element to construct. stated there rather than left to inference
    invoke: async ({ event }) => ({
      trophy: new SurfTrophy({
        uuid: event.uuid,
        rider: { uuid: 's1' },
        board: { brand: 'seaturtle', lengthInInches: 108 },
        sponsor: { uuid: 'sp1' },
      }),
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
      output: z.object({ rider: Seaturtle.contract() }),
    },
    invoke: async ({ event }) => ({
      rider: new Seaturtle({ uuid: event.uuid, name: 'crush' }),
    }),
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
      output: z.object({ board: Surfboard.contract() }),
    },
    invoke: async ({ event }) => ({
      board: new Surfboard({ brand: event.brand, lengthInInches: 108 }),
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
      output: z.object({ sponsor: Sponsor.contract() }),
    },
    invoke: async ({ event }) => ({
      sponsor: new Sponsor({ uuid: event.uuid, handle: 'oceanco' }),
    }),
  },
  { env: { access: 'prep' } },
);
