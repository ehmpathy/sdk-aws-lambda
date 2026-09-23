import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { LambdaClient } from '@aws-sdk/client-lambda';
import { DomainEntity, DomainLiteral } from 'domain-objects';
import { genContextLogTrail } from 'sdk-logs';
import {
  getError,
  given,
  then,
  useBeforeAll,
  useThen,
  useWhen,
  when,
} from 'test-fns';
import { z } from 'zod';

import { createInProcessLambdaHarness } from '../src/__test_assets__/createInProcessLambdaHarness';
import { gen } from '../src/contract/cli/gen';
import { LambdaDomainObjectNotCapturableError } from '../src/domain.objects/LambdaDomainObjectNotCapturableError';
import { LambdaIntrospectionBlockedError } from '../src/domain.objects/LambdaIntrospectionBlockedError';
import { genLambdaEndpoint } from '../src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.forAskEndpoint/genLambdaEndpoint.forAskEndpoint';
import { genServiceSdk } from '../src/domain.operations/genServiceSdk/genServiceSdk';

/**
 * .what = an end-to-end journey through the mechanic's real workflow with the
 *         sdk codegen: adopt → sync → drift → blocked → recover → final
 * .why = isolated cases prove each behavior; this proves they compose — the
 *        recovery invariant (a blocked/failed run leaves prior output intact) is
 *        only observable across timesteps
 *
 * .mock = in-process lambda transport (createInProcessLambdaHarness)
 *   .rule = rule.forbid.acceptance.mocks
 * .why = runs REAL genLambdaEndpoint handlers, fakes only the sdk transport, so
 *        the journey runs fast + deterministic without a per-step deploy.
 * .real = real-service fidelity is verified in deployed.codegen.acceptance.test.ts
 *
 * .contract = this journey deliberately drives the SDK-API contract
 *   (`genServiceSdk`, a public export) across timesteps — the programmatic-caller
 *   lifecycle. the `gen` CLI contract has its own happy-path + error coverage in
 *   local.codegen.acceptance.test.ts; a per-timestep CLI journey would duplicate
 *   that without new signal, so the recovery invariant is proven at the SDK layer.
 */

const { log } = genContextLogTrail({ trail: null, env: null });

// build a Job entity dobj (with a nested Address literal + alias) whose schema
// optionally carries an extra field (drift). the alias + nested metadata make the
// journey snapshot demonstrate the vision's full propagation (primary/unique/alias/
// nested), on par with the acceptance fixture — not an understated subset.
const genJobDobj = (opts: { withExtraField: boolean }) => {
  interface Address {
    city: string;
    postal: string;
  }
  class Address extends DomainLiteral<Address> implements Address {
    public static schema = z.object({ city: z.string(), postal: z.string() });
  }
  const shape = opts.withExtraField
    ? z.object({
        uuid: z.string(),
        title: z.string(),
        address: Address.contract(),
        note: z.string(),
      })
    : z.object({
        uuid: z.string(),
        title: z.string(),
        address: Address.contract(),
      });
  interface Job {
    uuid: string;
    title: string;
    address: Address;
  }
  class Job extends DomainEntity<Job> implements Job {
    public static primary = ['uuid'] as const;
    public static unique = ['title'] as const;
    public static alias = { singular: 'job', plural: 'jobs' };
    public static nested = { address: Address };
    public static schema = shape;
  }
  return Job;
};

// build an sdk over a single getJob endpoint; drift toggles the extra field
const asSdk = (opts: { withExtraField: boolean }): LambdaClient => {
  const Job = genJobDobj(opts);
  const handlers = {
    getJob: genLambdaEndpoint(
      {
        schema: {
          input: z.object({ uuid: z.string() }),
          output: z.object({ job: Job.contract() }),
        },
        // .note = `X.contract()` coerces, so its `TOutput` is a live instance — `invoke`
        //         owes a `new Job(...)` rather than a prop bag. `address` stays PLAIN on
        //         purpose: `Job.nested` rebuilds it
        invoke: async () => ({
          job: new Job({
            uuid: 'j1',
            title: 't',
            address: { city: 'c', postal: 'p' },
          }),
        }),
      },
      { env: { access: 'prep' } },
    ),
  };
  const { mockSend } = createInProcessLambdaHarness({ 'svc-jobs': handlers });
  return {
    // .rule = rule.forbid.acceptance.mocks — transport-only fake; runs the REAL
    //         handler, only ListFunctions is fielded here. real-service fidelity
    //         is proven in deployed.codegen.acceptance.test.ts
    send: jest.fn().mockImplementation(async (command) => {
      if (command.constructor.name === 'ListFunctionsCommand')
        return { Functions: [{ FunctionName: 'svc-jobs-prep-getJob' }], NextMarker: undefined };
      return mockSend(command);
    }),
  } as unknown as LambdaClient;
};

// an sdk whose endpoint references a schema-less dobj → uc.9 uncapturable
const asUncapturableSdk = (): LambdaClient => {
  // a REAL dobj whose `static schema` is an empty object: `X.contract()` stamps the
  // x-domain-object pragma onto a shape with no properties, so the codegen cannot
  // reconstruct it (uc.9). this exercises the production `X.contract()` → empty-schema
  // → pragma path, not a hand-crafted pragma.
  interface Ghost {
    id: string;
  }
  class Ghost extends DomainEntity<Ghost> implements Ghost {
    public static primary = ['id'] as const;
    public static schema = z.object({});
  }
  const handlers = {
    getGhost: genLambdaEndpoint(
      {
        schema: {
          input: z.object({ id: z.string() }),
          output: z.object({ ghost: Ghost.contract() }),
        },
        // .note = an instance HERE too, though the schema is empty. I expected this site to be
        //         the family's one legitimate bag — the coerce parses against `z.object({})`,
        //         which strips `id`, so I predicted `new Ghost({})` inside the coerce and a
        //         throw. MEASURED instead: types pass and the suite passes, because uc.9 reads
        //         INTROSPECTION and never invokes this handler. the exemption I was about to
        //         write down did not exist (rule.require.measure-the-value-you-emit)
        invoke: async () => ({ ghost: new Ghost({ id: 'g1' }) }),
      },
      { env: { access: 'prep' } },
    ),
  };
  const { mockSend } = createInProcessLambdaHarness({ 'svc-jobs': handlers });
  return {
    // .rule = rule.forbid.acceptance.mocks — transport-only fake (see file jsdoc);
    //         runs the REAL handler whose schema-less pragma triggers uc.9
    send: jest.fn().mockImplementation(async (command) => {
      if (command.constructor.name === 'ListFunctionsCommand')
        return { Functions: [{ FunctionName: 'svc-jobs-prep-getGhost' }], NextMarker: undefined };
      return mockSend(command);
    }),
  } as unknown as LambdaClient;
};

const genInto = async (input: {
  dir: string;
  sdk: LambdaClient;
  access: 'prep' | 'prod';
}): Promise<void> => {
  await genServiceSdk(
    { which: { service: 'svc-jobs' }, into: input.dir },
    { log, env: { access: input.access }, aws: { lambda: { sdk: input.sdk } } },
  );
};

// read every file in a dir that is known to exist (fail loud if it does not —
// the journey only reads after [t1] has created it)
const readDir = async (dir: string): Promise<Record<string, string>> => {
  const names = await readdir(dir);
  const entries = await Promise.all(
    names.map(async (n) => [n, await readFile(join(dir, n), 'utf-8')] as const),
  );
  return Object.fromEntries(entries);
};

describe('codegen.journey (local)', () => {
  given('[case1] a mechanic adopts svc-jobs, then evolves it', () => {
    const scene = useBeforeAll(async () => {
      const dir = join(await mkdtemp(join(tmpdir(), 'codegen-journey-')), 'access', 'svcs');
      return { dir };
    });
    afterAll(async () => rm(join(scene.dir, '..', '..'), { recursive: true, force: true }));

    when('[t0] before gen — target dir absent', () => {
      then('the target dir does not exist', () => {
        expect(existsSync(scene.dir)).toBe(false);
      });
    });

    // useWhen wraps [t1] + returns its generated files so [t6] can assert byte
    // equality against them WITHOUT a mutable holder (per rule.require.immutable-vars)
    const t1Files = useWhen('[t1] gen svc-jobs into access/svcs', () => {
      const files = useThen('3 files are created, dir auto-made', async () => {
        await genInto({ dir: scene.dir, sdk: asSdk({ withExtraField: false }), access: 'prep' });
        return readDir(scene.dir);
      });

      then('the 3 expected files exist and the set matches snapshot', () => {
        expect(Object.keys(files).sort()).toEqual([
          'svcJobs.mechanisms.ts',
          'svcJobs.resources.ts',
          'svcJobs.ts',
        ]);
        expect(files).toMatchSnapshot('t1-generated');
      });

      return files;
    });

    when('[t2] re-gen, upstream unchanged', () => {
      then('output is byte-identical to [t1]', async () => {
        const before = await readDir(scene.dir);
        await genInto({ dir: scene.dir, sdk: asSdk({ withExtraField: false }), access: 'prep' });
        const after = await readDir(scene.dir);
        expect(after).toEqual(before);
      });
    });

    when('[t3] upstream adds a Job field, re-gen', () => {
      then('the resources diff shows the new field', async () => {
        await genInto({ dir: scene.dir, sdk: asSdk({ withExtraField: true }), access: 'prep' });
        const files = await readDir(scene.dir);
        expect(files['svcJobs.resources.ts']).toContain('note');
        expect(files['svcJobs.resources.ts']).toMatchSnapshot('t3-drift-resources');
      });
    });

    when('[t4] a blocked scenario — gen with --env prod', () => {
      then('it throws blocked and prior [t3] output is intact (recovery)', async () => {
        const before = await readDir(scene.dir);
        // the sdk value is irrelevant here: the prod access gate throws inside
        // genServiceSdk BEFORE any sdk call, so no introspection happens
        const error = await getError(
          genInto({ dir: scene.dir, sdk: asSdk({ withExtraField: false }), access: 'prod' }),
        );
        expect(error).toBeInstanceOf(LambdaIntrospectionBlockedError);
        expect(error.message).toMatchSnapshot('t4-blocked-message');
        const after = await readDir(scene.dir);
        expect(after).toEqual(before); // no files changed on disk
      });
    });

    when('[t5] a schema-less dobj is introduced upstream, re-gen', () => {
      then('it throws uncapturable, names the dobj, and no partial write', async () => {
        const before = await readDir(scene.dir);
        const error = await getError(
          genInto({ dir: scene.dir, sdk: asUncapturableSdk(), access: 'prep' }),
        );
        expect(error).toBeInstanceOf(LambdaDomainObjectNotCapturableError);
        expect(error.message).toContain('Ghost');
        expect(error.message).toMatchSnapshot('t5-uncapturable-message');
        const after = await readDir(scene.dir);
        expect(after).toEqual(before); // all-or-none held
      });
    });

    when('[t6] journey complete — revert upstream, final gen', () => {
      then('final state matches the [t1] output byte-for-byte', async () => {
        await genInto({ dir: scene.dir, sdk: asSdk({ withExtraField: false }), access: 'prep' });
        const files = await readDir(scene.dir);
        // assert byte-equality against t1's captured output (via useWhen) — jest
        // enforces the roundtrip invariant. no snapshot here: it would byte-duplicate
        // the [t1] entry (clutter), and this equality is a strictly stronger proof;
        // the [t1] snapshot already serves as the visual vibecheck.
        expect(files).toEqual(t1Files);
      });
    });

    // the SDK-layer recovery invariant is proven across [t4]/[t5]; this final step
    // proves the SAME invariant holds through the `gen` CLI layer in-sequence — a
    // blocked cli run (exit 2) after the good [t6] state leaves that state intact.
    // (targeted: proves cli exit-code + sequential recovery without a full CLI journey)
    when('[t7] a blocked CLI run — the cli layer preserves prior [t6] state', () => {
      then('gen exits 2 and the [t6] output on disk is intact', async () => {
        const before = await readDir(scene.dir);
        const result = await gen(
          { argv: ['--for', 'svc-jobs', '--into', scene.dir, '--env', 'prod'] },
          { aws: { lambda: { sdk: asSdk({ withExtraField: false }) } } },
        );
        expect(result.exit).toEqual(2);
        expect(result.message).not.toBeNull();
        const after = await readDir(scene.dir);
        expect(after).toEqual(before); // cli blocked run leaves multi-step state intact
      });
    });
  });
});
