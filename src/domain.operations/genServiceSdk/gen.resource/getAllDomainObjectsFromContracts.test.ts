import { getError, given, then, when } from 'test-fns';

import { LambdaDomainObjectNotCapturableError } from '../../../domain.objects/LambdaDomainObjectNotCapturableError';
import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { getAllDomainObjectsFromContracts } from './getAllDomainObjectsFromContracts';

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
});
