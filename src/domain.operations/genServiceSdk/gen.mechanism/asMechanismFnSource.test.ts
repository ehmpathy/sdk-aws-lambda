import { given, then, when } from 'test-fns';
import * as ts from 'typescript';

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

      then('it takes the refusal opt and passes it to the ask', () => {
        expect(source).toContain(
          'options?: { refusal?: LambdaEndpointRefusal },',
        );
        expect(source).toContain('event, refusal: options?.refusal }');
      });
    });

    /**
     * .what = run the emitted fn, not only read its text
     * .why = a text check passes on a fn that names `refusal` but never sends it; only a
     *        run against a fake ask shows what reaches `askLambdaEndpoint`
     */
    when('[t1] the emitted fn runs against a fake ask', () => {
      const runEmitted = (input: { args: unknown[] }): unknown[] => {
        const source = asMechanismFnSource({
          service: 'svc-jobs',
          function: 'getJob',
          schema,
          dobjRefs: { Job: 'SvcJobsJob' },
        });
        const { outputText } = ts.transpileModule(
          `const sdk = {\n${source}\n};\nreturn sdk;`,
          { compilerOptions: { target: ts.ScriptTarget.ES2020 } },
        );
        const asks: unknown[] = [];
        const askLambdaEndpoint = async (ask: unknown): Promise<null> => {
          asks.push(ask);
          return null;
        };
        const sdk = new Function('askLambdaEndpoint', outputText)(
          askLambdaEndpoint,
        ) as { getJob: (...args: unknown[]) => Promise<unknown> };
        void sdk.getJob(...input.args);
        return asks;
      };

      then('the refusal opt given reaches the ask', () => {
        const asks = runEmitted({
          args: [{ uuid: 'j-1' }, {}, { refusal: { as: 'ConstraintError' } }],
        });
        expect(asks).toEqual([
          {
            which: { service: 'svc-jobs', function: 'getJob' },
            event: { uuid: 'j-1' },
            refusal: { as: 'ConstraintError' },
          },
        ]);
      });

      then(
        'a call with no options asks with no refusal, so the default holds',
        () => {
          const asks = runEmitted({ args: [{ uuid: 'j-1' }, {}] });
          expect(asks).toEqual([
            {
              which: { service: 'svc-jobs', function: 'getJob' },
              event: { uuid: 'j-1' },
              refusal: undefined,
            },
          ]);
        },
      );
    });
  });
});
