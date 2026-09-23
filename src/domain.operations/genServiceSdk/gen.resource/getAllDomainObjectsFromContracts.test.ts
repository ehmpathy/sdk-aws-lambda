import { DomainEntity } from 'domain-objects';
import { getError, given, then, when } from 'test-fns';
import { z } from 'zod';

import { LambdaDomainObjectNotCapturableError } from '../../../domain.objects/LambdaDomainObjectNotCapturableError';
import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { getAllDomainObjectsFromContracts } from './getAllDomainObjectsFromContracts';

/**
 * .what = a dobj used ONLY at a `.nullable()` position, to build `[case5]`'s fixture
 * .why = the fixture must come from `z.toJSONSchema`, not from my hand — see `[case5]`
 */
interface NullableRider {
  uuid: string;
}
class NullableRider
  extends DomainEntity<NullableRider>
  implements NullableRider
{
  public static primary = ['uuid'] as const;
  public static schema = z.object({ uuid: z.string() });
}

// a reusable Job dobj node (entity)
const jobNode = {
  type: 'object',
  properties: { uuid: { type: 'string' }, title: { type: 'string' } },
  'x-domain-object': { name: 'Job', primary: ['uuid'], unique: ['title'] },
};

// a reusable Address dobj node (literal), nested under Job
const addressNode = {
  type: 'object',
  properties: { city: { type: 'string' } },
  'x-domain-object': { name: 'Address', unique: ['city'] },
};

const asContracts = (
  record: Record<string, { input: unknown; output: unknown }>,
): Record<string, LambdaEndpointSchema> =>
  record as Record<string, LambdaEndpointSchema>;

describe('getAllDomainObjectsFromContracts', () => {
  given('[case1] the same dobj referenced by many endpoints', () => {
    const contracts = asContracts({
      getJob: {
        input: { type: 'object' },
        output: { properties: { job: jobNode } },
      },
      getJobs: {
        input: { type: 'object' },
        output: { properties: { jobs: { type: 'array', items: jobNode } } },
      },
    });

    when('[t0] collected', () => {
      const dobjs = getAllDomainObjectsFromContracts({ contracts });

      then('the dobj is declared once (de-duped)', () => {
        expect(dobjs.length).toEqual(1);
        expect(dobjs[0]?.name).toEqual('Job');
        expect(dobjs[0]?.kind).toEqual('entity');
      });
    });
  });

  given('[case2] a nested dobj under a top-level dobj', () => {
    const jobWithAddress = {
      type: 'object',
      properties: { uuid: { type: 'string' }, address: addressNode },
      'x-domain-object': {
        name: 'Job',
        primary: ['uuid'],
        nested: { address: 'Address' },
      },
    };
    const contracts = asContracts({
      getJob: {
        input: { type: 'object' },
        output: { properties: { job: jobWithAddress } },
      },
    });

    when('[t0] collected', () => {
      const dobjs = getAllDomainObjectsFromContracts({ contracts });

      then('both the outer and nested dobj are captured', () => {
        expect(dobjs.map((d) => d.name).sort()).toEqual(['Address', 'Job']);
      });
    });
  });

  given('[case3] a pragma-tagged node with no properties (uc.9)', () => {
    const uncapturable = {
      type: 'object',
      'x-domain-object': { name: 'Ghost', primary: ['uuid'] },
      // note: absent `properties` → no properties to reconstruct
    };
    const contracts = asContracts({
      getGhost: {
        input: { type: 'object' },
        output: { properties: { ghost: uncapturable } },
      },
    });

    when('[t0] collected', () => {
      then(
        'it throws LambdaDomainObjectNotCapturableError naming the dobj',
        async () => {
          const error = await getError(() =>
            getAllDomainObjectsFromContracts({ contracts }),
          );
          expect(error).toBeInstanceOf(LambdaDomainObjectNotCapturableError);
          expect(error.message).toContain('Ghost');
        },
      );
    });
  });

  given('[case4] contracts with no dobjs', () => {
    const contracts = asContracts({
      ping: {
        input: { type: 'object' },
        output: { type: 'object', properties: { ok: { type: 'boolean' } } },
      },
    });

    when('[t0] collected', () => {
      then('it returns an empty list', () => {
        expect(getAllDomainObjectsFromContracts({ contracts })).toEqual([]);
      });
    });
  });

  given(
    '[case5] a dobj at a NULLABLE position, where zod relocates the pragma',
    () => {
      /**
       * .what = the capture path, measured against a `.nullable()` dobj position
       *
       * ⚠️ .why it is owed, and it is a FAILHIDE risk rather than a coverage nit = zod
       *    emits a nullable field as `anyOf: [<the schema>, { type: 'null' }]`, so the
       *    `x-domain-object` pragma **rides one node down**, on `anyOf[0]`. upstream
       *    states the consequence outright: a direct read returns `undefined`
       *    "silently, with no error at compile, build, or parse"
       *    (`domain-objects/readme.md:776-792`)
       *
       * ⇒ so IF our capture were a direct lookup rather than a walk, every nullable dobj
       *   position would degrade to `unknown` in a generated client, with no crash and no
       *   tell — the exact `rule.forbid.failhide` shape
       *
       * .why the fixture is BUILT rather than hand-written = a hand-written `anyOf` node
       *      would encode MY model of zod's output, so it could only confirm that model
       *      (rule.require.measure-the-value-you-emit — and this branch has now been wrong
       *      four times by exactly that route). `z.toJSONSchema` supplies the real shape
       *
       * ⚠️ .PROVEN BY REVERT (rule.require.clamp-edge-cases). swap `collectFromNode`'s walk
       *    at `:64-68` for a direct lookup that descends `properties` ONLY:
       *
       *      revert                          | result
       *      --------------------------------|----------------------------------------
       *      the full walk -> properties-only | 🔴 2 red, and BOTH are `[case5][t0]`
       *
       *    ⇒ `[case1]`–`[case4]` stay green, since each puts its pragma under `properties`.
       *      that is what makes this a clamp of the RELOCATION arm rather than of the walk
       *      in general. the third row stays green too — correctly, since it measures zod's
       *      output rather than ours, which is the whole point of a positive control
       */
      const contracts = asContracts({
        getRider: {
          input: { type: 'object' },
          output: z.toJSONSchema(
            z.object({ rider: NullableRider.contract().nullable() }),
            { io: 'input' },
          ),
        },
      });

      when('[t0] collected', () => {
        // .why ONE call, shared = the three rows grade ONE capture
        //      (rule.forbid.redundant-expensive-operations)
        const captured = getAllDomainObjectsFromContracts({ contracts });

        then('the relocated pragma is still found', () => {
          // ⚠️ this is the row the failhide would break. a direct-lookup capture returns []
          expect(captured.map((dobj) => dobj.name)).toEqual(['NullableRider']);
        });

        then('its shape survives the relocation, so it can be emitted', () => {
          // .why = capture alone is not enough — `getIsCapturableShape` demands properties,
          //        and an `anyOf` arm is where they could have been lost
          expect(Object.keys(captured[0]?.shape.properties ?? {})).toEqual([
            'uuid',
          ]);
        });

        then(
          'the pragma really did relocate, so this case is not vacuous',
          () => {
            // .why = the positive control. without it, a zod version that no longer emits
            //        `anyOf` for a nullable would make the two rows above pass while they
            //        measured the PLAIN path, and the relocation would go unclamped
            //        (rule.require.positive-control-before-absence-claims)
            const output = contracts.getRider?.output as {
              properties: { rider: { anyOf?: unknown[] } };
            };
            expect(output.properties.rider.anyOf).toHaveLength(2);
          },
        );
      });
    },
  );
});
