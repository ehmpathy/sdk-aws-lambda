import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Context } from 'aws-lambda';

import type { LambdaClient } from '@aws-sdk/client-lambda';
import { DomainEntity, DomainLiteral } from 'domain-objects';
import { genContextLogTrail } from 'sdk-logs';
import { getError, given, then, useBeforeAll, when } from 'test-fns';
import { z } from 'zod';

import { createInProcessLambdaHarness } from '../src/__test_assets__/createInProcessLambdaHarness';
import { LambdaDomainObjectRefUnbindableError } from '../src/domain.objects/LambdaDomainObjectRefUnbindableError';
import { genLambdaEndpoint } from '../src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.forAskEndpoint/genLambdaEndpoint.forAskEndpoint';
import { genServiceSdk } from '../src/domain.operations/genServiceSdk/genServiceSdk';

/**
 * .what = acceptance test for domain-object REFERENCE support: a SurfTrophy dobj
 *         whose fields reference OTHER dobjs by key (rider by primary, board by
 *         unique, sponsor by ref), reconstructed as typed `Ref*` in the sdk
 * .why = proves the vision's next chapter — references, not just full-embedded
 *        resources, cross the border with their identity intact + typed against
 *        the generated prefixed resource
 *
 * .mock = in-process lambda transport (createInProcessLambdaHarness)
 *   .rule = rule.forbid.acceptance.mocks — transport-only fake; runs the REAL
 *           handlers, fakes only ListFunctions for deterministic discovery.
 *
 * .real = the ref pragma is stamped by the REAL `X.contract().ref(by)`, so this proves the
 *         true roundtrip: `.contract().ref(by)` → `z.toJSONSchema` → the codegen reads the
 *         `x-domain-object-ref` pragma → emits `RefBy*<typeof Svc...>`.
 *
 * .note = the overloads are `.ref('primary')` · `.ref('unique')` · `.ref()`, and the bare call
 *         yields the UNION of the two. that is why `sponsor` below reads `.ref()` and its
 *         generated type is `Ref<typeof Svc...>` rather than a `RefBy*`
 */

// the three referenced dobjs — each surfaced WHOLE by a peer endpoint so the
// SurfTrophy refs bind against their generated prefixed resources
interface Seaturtle {
  uuid: string;
  name: string;
}
class Seaturtle extends DomainEntity<Seaturtle> implements Seaturtle {
  public static primary = ['uuid'] as const;
  public static schema = z.object({ uuid: z.string(), name: z.string() });
}

interface Surfboard {
  brand: string;
  lengthInInches: number;
}
class Surfboard extends DomainLiteral<Surfboard> implements Surfboard {
  public static unique = ['brand', 'lengthInInches'] as const;
  public static schema = z.object({
    brand: z.string(),
    lengthInInches: z.number(),
  });
}

interface Sponsor {
  uuid: string;
  handle: string;
}
class Sponsor extends DomainEntity<Sponsor> implements Sponsor {
  public static primary = ['uuid'] as const;
  public static unique = ['handle'] as const;
  public static schema = z.object({ uuid: z.string(), handle: z.string() });
}

// the SurfTrophy dobj: references Seaturtle (primary), Surfboard (unique),
// Sponsor (ref) — by key, NOT by full embed — via the REAL `X.contract().ref(by)`
interface SurfTrophy {
  uuid: string;
  rider: { uuid: string };
  board: { brand: string; lengthInInches: number };
  sponsor: { uuid: string } | { handle: string };
}
class SurfTrophy extends DomainEntity<SurfTrophy> implements SurfTrophy {
  public static primary = ['uuid'] as const;
  public static schema = z.object({
    uuid: z.string(),
    rider: Seaturtle.contract().ref('primary'),
    board: Surfboard.contract().ref('unique'),
    sponsor: Sponsor.contract().ref(),
  });
}

// handlers: getTrophy surfaces SurfTrophy (with its refs); the peer endpoints
// surface each referenced dobj WHOLE so the refs bind
// the harness handler shape: an event of unknown shape → a response (see
// createInProcessLambdaHarness); each genLambdaEndpoint output fits this
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (event: any, context: Context) => Promise<unknown>;

const asRefServiceSdk = (opts: { withPeers: boolean }): LambdaClient => {
  const handlers: Record<string, Handler> = {
    getTrophy: genLambdaEndpoint(
      {
        schema: {
          input: z.object({ uuid: z.string() }),
          output: z.object({ trophy: SurfTrophy.contract() }),
        },
        // .note = `X.contract()` coerces, so its `TOutput` is `WithImmute<X>` and `invoke`
        //         owes a live instance rather than a prop bag. every endpoint in this file
        //         constructs one, so all four exercise the coerce at the output border
        //
        // ⚠️ .defect = STAYS PARTIAL, NOT FIXED — the compiler demands the instance HERE
        //              and lets a prop bag through for the three identically-shaped peers
        //              below. the instance rule is a CONVENTION at 3 of these 4 sites
        //   .proof it is live = a prop bag here fails (tsc, verbatim: `Property 'clone' is
        //                       missing ... required in type WithImmute<SurfTrophy>`), and
        //                       the same swap in a peer COMPILES. measured on this very
        //                       file — the peers carried bags until this pass built them
        //   .the cause = `SurfTrophy`'s `sponsor` is a union (`.ref()` yields one), so tsc
        //                cannot unify `TOutput` from the `invoke` return and falls back to
        //                the schema's type. the peers unify, so the demand never fires
        //   .the twin = `blackbox/__test_assets__/refTrophyHandlers.ts` declares the same
        //               four endpoints and carries this same record
        //   ⚠️ .the family is NOT those two files — that claim sat here and was FALSE. a
        //      sweep of the subject (`grepsafe 'output: z\.object\(\{ \w+: \w+\.contract\(\)'`)
        //      reaches 14 positions across 6 files; 6 of them were bags, and four reviewers
        //      found them in one round. all 14 now hand back an instance. the membership
        //      rule and the count are recorded once, at the twin above
        //      (rule.require.sweep-the-defect-class)
        //   ⇒ `1.vision.yield.md`'s "a dobj at the output border demands an instance" holds
        //     for the SHAPE and not for the CHECK — treat the instance as the contract,
        //     never the compiler as the clamp
        invoke: async () => ({
          trophy: new SurfTrophy({
            uuid: 't1',
            rider: { uuid: 's1' },
            board: { brand: 'seaturtle', lengthInInches: 108 },
            sponsor: { uuid: 'sp1' },
          }),
        }),
      },
      { env: { access: 'prep' } },
    ),
  };

  // the peer endpoints that surface each referenced dobj whole (bind the refs)
  if (opts.withPeers) {
    handlers.getRider = genLambdaEndpoint(
      {
        schema: {
          input: z.object({ uuid: z.string() }),
          output: z.object({ rider: Seaturtle.contract() }),
        },
        invoke: async () => ({
          rider: new Seaturtle({ uuid: 's1', name: 'crush' }),
        }),
      },
      { env: { access: 'prep' } },
    );
    handlers.getBoard = genLambdaEndpoint(
      {
        schema: {
          input: z.object({ brand: z.string() }),
          output: z.object({ board: Surfboard.contract() }),
        },
        invoke: async () => ({
          board: new Surfboard({ brand: 'seaturtle', lengthInInches: 108 }),
        }),
      },
      { env: { access: 'prep' } },
    );
    handlers.getSponsor = genLambdaEndpoint(
      {
        schema: {
          input: z.object({ uuid: z.string() }),
          output: z.object({ sponsor: Sponsor.contract() }),
        },
        invoke: async () => ({
          sponsor: new Sponsor({ uuid: 'sp1', handle: 'oceanco' }),
        }),
      },
      { env: { access: 'prep' } },
    );
  }

  const { mockSend } = createInProcessLambdaHarness({ 'svc-surf': handlers });
  const fns = Object.keys(handlers).map((fn) => ({
    FunctionName: `svc-surf-prep-${fn}`,
  }));
  return {
    // .rule = rule.forbid.acceptance.mocks — transport-only fake (see file jsdoc)
    send: jest.fn().mockImplementation(async (command) => {
      if (command.constructor.name === 'ListFunctionsCommand')
        return { Functions: fns, NextMarker: undefined };
      return mockSend(command);
    }),
  } as unknown as LambdaClient;
};

const { log } = genContextLogTrail({ trail: null, env: null });

const genInto = async (input: {
  dir: string;
  sdk: LambdaClient;
}): Promise<void> => {
  await genServiceSdk(
    { which: { service: 'svc-surf' }, into: input.dir },
    { log, env: { access: 'prep' }, aws: { lambda: { sdk: input.sdk } } },
  );
};

describe('codegen refs (local)', () => {
  given('[case1] a SurfTrophy that references other dobjs by key', () => {
    const scene = useBeforeAll(async () => {
      const dir = await mkdtemp(join(tmpdir(), 'codegen-refs-'));
      await genInto({ dir, sdk: asRefServiceSdk({ withPeers: true }) });
      const names = await readdir(dir);
      const files = Object.fromEntries(
        await Promise.all(
          names.map(
            async (n) => [n, await readFile(join(dir, n), 'utf-8')] as const,
          ),
        ),
      );
      return { dir, files };
    });
    afterAll(async () => rm(scene.dir, { recursive: true, force: true }));

    when('[t0] the generated resources are inspected', () => {
      then('SurfTrophy references the rider by primary (RefByPrimary)', () => {
        const resources = scene.files['svcSurf.resources.ts'] ?? '';
        expect(resources).toContain(
          'rider: RefByPrimary<typeof SvcSurfSeaturtle>;',
        );
      });

      then('SurfTrophy references the board by unique (RefByUnique)', () => {
        const resources = scene.files['svcSurf.resources.ts'] ?? '';
        expect(resources).toContain(
          'board: RefByUnique<typeof SvcSurfSurfboard>;',
        );
      });

      then('SurfTrophy references the sponsor by ref (Ref)', () => {
        const resources = scene.files['svcSurf.resources.ts'] ?? '';
        expect(resources).toContain('sponsor: Ref<typeof SvcSurfSponsor>;');
      });

      then('the domain-objects import carries the ref generics', () => {
        const resources = scene.files['svcSurf.resources.ts'] ?? '';
        expect(resources).toContain('Ref');
        expect(resources).toContain('RefByPrimary');
        expect(resources).toContain('RefByUnique');
        expect(resources).toContain(`from 'domain-objects';`);
      });

      then('the referenced dobjs are declared in full (so the refs bind)', () => {
        const resources = scene.files['svcSurf.resources.ts'] ?? '';
        expect(resources).toContain('export class SvcSurfSeaturtle');
        expect(resources).toContain('export class SvcSurfSurfboard');
        expect(resources).toContain('export class SvcSurfSponsor');
      });

      then('the full resources file matches snapshot', () => {
        expect(scene.files['svcSurf.resources.ts']).toBeDefined();
        expect(scene.files['svcSurf.resources.ts']).toMatchSnapshot();
      });
    });
  });

  given('[case2] a ref whose dobj is surfaced by NO endpoint (unbindable)', () => {
    when('[t0] gen runs without the peer endpoints', () => {
      // capture a plain summary (useBeforeAll stores enumerable own props only, so
      // the Error prototype + .message are lost if the raw instance crosses blocks)
      const caught = useBeforeAll(async () => {
        const dir = await mkdtemp(join(tmpdir(), 'codegen-refs-unbound-'));
        const error = await getError(
          genInto({ dir, sdk: asRefServiceSdk({ withPeers: false }) }),
        );
        await rm(dir, { recursive: true, force: true });
        return {
          isExpectedType:
            error instanceof LambdaDomainObjectRefUnbindableError,
          message: error instanceof Error ? error.message : String(error),
        };
      });

      then('it throws LambdaDomainObjectRefUnbindableError', () => {
        expect(caught.isExpectedType).toBe(true);
      });

      then('the message names the unbound refs', () => {
        expect(caught.message).toContain('Seaturtle');
        expect(caught.message).toContain('Surfboard');
        expect(caught.message).toContain('Sponsor');
      });
    });
  });
});
