import { given, then, when } from 'test-fns';
import type { JSONSchema } from 'zod/v4/core/json-schema';

import {
  getRefGenericsUsed,
  getTypescriptFromJsonSchema,
} from './getTypescriptFromJsonSchema';

describe('getTypescriptFromJsonSchema', () => {
  given('[case1] a simple object schema', () => {
    const schema = {
      type: 'object',
      properties: { uuid: { type: 'string' }, count: { type: 'number' } },
      required: ['uuid'],
    } as unknown as JSONSchema;

    when('[t0] compiled', () => {
      const type = getTypescriptFromJsonSchema({ schema });

      then('required props are non-optional, others optional', () => {
        expect(type).toContain('uuid: string;');
        expect(type).toContain('count?: number;');
      });
    });
  });

  given('[case2] an anyOf union of const literals', () => {
    const schema = {
      anyOf: [{ const: 'open' }, { const: 'closed' }],
    } as unknown as JSONSchema;

    when('[t0] compiled', () => {
      then('it emits a union of string literals', () => {
        expect(getTypescriptFromJsonSchema({ schema })).toEqual(
          '"open" | "closed"',
        );
      });
    });
  });

  given('[case3] an enum', () => {
    const schema = { enum: ['a', 'b', 'c'] } as unknown as JSONSchema;

    when('[t0] compiled', () => {
      then('it emits a union', () => {
        expect(getTypescriptFromJsonSchema({ schema })).toEqual(
          '"a" | "b" | "c"',
        );
      });
    });
  });

  given('[case4] an array of strings', () => {
    const schema = {
      type: 'array',
      items: { type: 'string' },
    } as unknown as JSONSchema;

    when('[t0] compiled', () => {
      then('it emits the idiomatic string[]', () => {
        expect(getTypescriptFromJsonSchema({ schema })).toEqual('string[]');
      });
    });
  });

  given('[case5] a node tagged as a captured dobj, with a dobjRef', () => {
    const schema = {
      type: 'object',
      properties: { uuid: { type: 'string' } },
      'x-domain-object': { name: 'Job', primary: ['uuid'] },
    } as unknown as JSONSchema;

    when('[t0] compiled with a ref to the prefixed name', () => {
      const type = getTypescriptFromJsonSchema({
        schema,
        dobjRefs: { Job: 'SvcJobsJob' },
      });

      then('it becomes a reference to the prefixed resource', () => {
        expect(type).toEqual('SvcJobsJob');
      });
    });
  });

  given(
    '[case5b] the root node itself carries a dobj pragma, with asRootShape',
    () => {
      const schema = {
        type: 'object',
        properties: { uuid: { type: 'string' } },
        required: ['uuid'],
        'x-domain-object': { name: 'Job', primary: ['uuid'] },
      } as unknown as JSONSchema;

      when(
        '[t0] compiled with asRootShape=true (a resource emits its own shape)',
        () => {
          const type = getTypescriptFromJsonSchema({
            schema,
            dobjRefs: { Job: 'SvcJobsJob' },
            asRootShape: true,
          });

          then('it renders the object shape, NOT a self-reference', () => {
            expect(type).toContain('uuid: string;');
            expect(type).not.toEqual('SvcJobsJob');
          });
        },
      );
    },
  );

  given('[case6] a nested dobj-tagged property inside an object', () => {
    const schema = {
      type: 'object',
      properties: {
        job: {
          type: 'object',
          properties: { uuid: { type: 'string' } },
          'x-domain-object': { name: 'Job', primary: ['uuid'] },
        },
      },
      required: ['job'],
    } as unknown as JSONSchema;

    when('[t0] compiled with a dobjRef', () => {
      const type = getTypescriptFromJsonSchema({
        schema,
        dobjRefs: { Job: 'SvcJobsJob' },
      });

      then('the nested property references the prefixed resource', () => {
        expect(type).toContain('job: SvcJobsJob;');
      });
    });
  });

  given(
    '[case7] nodes tagged as domain-object REFERENCES (x-domain-object-ref)',
    () => {
      // a SurfTrophy shape whose fields reference OTHER dobjs by key (not embed them):
      // rider by primary, board by unique, sponsor by ref (primary | unique)
      const schema = {
        type: 'object',
        properties: {
          uuid: { type: 'string' },
          rider: {
            type: 'object',
            properties: { uuid: { type: 'string' } },
            'x-domain-object-ref': { of: 'Seaturtle', by: 'primary' },
          },
          board: {
            type: 'object',
            properties: { brand: { type: 'string' } },
            'x-domain-object-ref': { of: 'Surfboard', by: 'unique' },
          },
          sponsor: {
            type: 'object',
            properties: { uuid: { type: 'string' } },
            'x-domain-object-ref': { of: 'Sponsor', by: 'ref' },
          },
        },
        required: ['uuid', 'rider', 'board', 'sponsor'],
      } as unknown as JSONSchema;

      const dobjRefs = {
        Seaturtle: 'SvcSurfSeaturtle',
        Surfboard: 'SvcSurfSurfboard',
        Sponsor: 'SvcSurfSponsor',
      };

      when('[t0] compiled with the referenced dobjs bound in dobjRefs', () => {
        const type = getTypescriptFromJsonSchema({ schema, dobjRefs });

        then('a by-primary ref emits RefByPrimary<typeof Prefixed>', () => {
          expect(type).toContain(
            'rider: RefByPrimary<typeof SvcSurfSeaturtle>;',
          );
        });

        then('a by-unique ref emits RefByUnique<typeof Prefixed>', () => {
          expect(type).toContain(
            'board: RefByUnique<typeof SvcSurfSurfboard>;',
          );
        });

        then('a by-ref ref emits Ref<typeof Prefixed>', () => {
          expect(type).toContain('sponsor: Ref<typeof SvcSurfSponsor>;');
        });
      });

      when('[t1] getRefGenericsUsed inspects the tree', () => {
        const used = getRefGenericsUsed({ schema, dobjRefs });

        then('it reports exactly the generics emitted, sorted', () => {
          expect(used).toEqual(['Ref', 'RefByPrimary', 'RefByUnique']);
        });
      });

      when(
        '[t2] the referenced dobj is NOT bound (absent from dobjRefs)',
        () => {
          const type = getTypescriptFromJsonSchema({
            schema: {
              type: 'object',
              properties: {
                rider: {
                  type: 'object',
                  properties: { uuid: { type: 'string' } },
                  'x-domain-object-ref': { of: 'Seaturtle', by: 'primary' },
                },
              },
              required: ['rider'],
            } as unknown as JSONSchema,
            dobjRefs: {},
          });

          then(
            'it falls back to the inline key-shape (no unbound ref emitted)',
            () => {
              expect(type).toContain('rider: { uuid?: string; };');
              expect(type).not.toContain('RefByPrimary');
            },
          );
        },
      );
    },
  );
});
