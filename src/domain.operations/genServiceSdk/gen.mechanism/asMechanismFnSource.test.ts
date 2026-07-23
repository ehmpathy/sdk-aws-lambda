import { given, then, when } from 'test-fns';

import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { asMechanismFnSource } from './asMechanismFnSource';

describe('asMechanismFnSource', () => {
  given('[case1] an endpoint with typed input + output', () => {
    const schema = {
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
    } as unknown as LambdaEndpointSchema;

    when('[t0] emitted for svc-jobs getJob', () => {
      const source = asMechanismFnSource({
        service: 'svc-jobs',
        function: 'getJob',
        schema,
        dobjRefs: { Job: 'SvcJobsJob' },
      });

      then('it declares the fn keyed by function name', () => {
        expect(source).toContain('getJob:');
      });

      then('it types the event argument', () => {
        expect(source).toContain('event: { uuid: string; }');
      });

      then('it references the prefixed resource in the return type', () => {
        expect(source).toContain('Promise<{ job: SvcJobsJob; }>');
      });

      then('it wraps askLambdaEndpoint with the which selector', () => {
        expect(source).toContain(
          'which: { service: "svc-jobs", function: "getJob" }',
        );
        // explicit <event, result> generics at the call site
        expect(source).toContain(
          'askLambdaEndpoint<{ uuid: string; }, { job: SvcJobsJob; }>(',
        );
      });

      then('it threads context', () => {
        expect(source).toContain('context: ContextAwsLambdaCaller');
      });
    });
  });
});
