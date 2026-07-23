import { given, then, when } from 'test-fns';

import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { asMechanismsFileSource } from './asMechanismsFileSource';

const contracts = {
  getJob: {
    input: {
      type: 'object',
      properties: { uuid: { type: 'string' } },
      required: ['uuid'],
    },
    output: {
      type: 'object',
      properties: {
        job: {
          type: 'object',
          properties: { uuid: { type: 'string' } },
          'x-domain-object': { name: 'Job', primary: ['uuid'] },
        },
      },
      required: ['job'],
    },
  },
} as unknown as Record<string, LambdaEndpointSchema>;

describe('asMechanismsFileSource', () => {
  given('[case1] a service with one endpoint that yields a dobj', () => {
    when('[t0] assembled', () => {
      const source = asMechanismsFileSource({
        service: 'svc-jobs',
        object: 'svcJobs',
        resourcesModule: './svcJobs.resources',
        resourceNames: ['SvcJobsJob'],
        contracts,
        dobjRefs: { Job: 'SvcJobsJob' },
      });

      then('it carries the banner', () => {
        expect(source).toContain('do not edit');
      });

      then('it imports askLambdaEndpoint + context type', () => {
        expect(source).toContain(
          `import { askLambdaEndpoint, type ContextAwsLambdaCaller } from 'sdk-aws-lambda';`,
        );
      });

      then('it imports the referenced resource types', () => {
        expect(source).toContain(
          `import type { SvcJobsJob } from './svcJobs.resources';`,
        );
      });

      then('it declares the svcJobs object with the endpoint fn', () => {
        expect(source).toContain('export const svcJobs = {');
        expect(source).toContain('getJob:');
      });
    });
  });

  given(
    '[case2] a service whose captured dobjs include a nested-only one',
    () => {
      when(
        '[t0] assembled with both the top-level + nested resource names',
        () => {
          const source = asMechanismsFileSource({
            service: 'svc-jobs',
            object: 'svcJobs',
            resourcesModule: './svcJobs.resources',
            // both are captured, but only Job appears in a fn signature; Address is
            // referenced only INSIDE Job's resource declaration, never in a mechanism
            resourceNames: ['SvcJobsJob', 'SvcJobsAddress'],
            contracts,
            dobjRefs: { Job: 'SvcJobsJob', Address: 'SvcJobsAddress' },
          });

          then('it imports the referenced top-level dobj', () => {
            expect(source).toContain('SvcJobsJob');
          });

          then(
            'it does NOT import the nested-only dobj (no unused import)',
            () => {
              expect(source).not.toContain('SvcJobsAddress');
            },
          );
        },
      );
    },
  );

  given('[case3] a service with no dobjs to reference', () => {
    const bareContracts = {
      getHealth: {
        input: { type: 'object' },
        output: { type: 'object', properties: { ok: { type: 'boolean' } } },
      },
    } as unknown as Record<string, LambdaEndpointSchema>;

    when('[t0] assembled', () => {
      const source = asMechanismsFileSource({
        service: 'svc-health',
        object: 'svcHealth',
        resourcesModule: './svcHealth.resources',
        resourceNames: [],
        contracts: bareContracts,
        dobjRefs: {},
      });

      then('it omits the resource-type import', () => {
        expect(source).not.toContain(`from './svcHealth.resources'`);
      });
    });
  });
});
