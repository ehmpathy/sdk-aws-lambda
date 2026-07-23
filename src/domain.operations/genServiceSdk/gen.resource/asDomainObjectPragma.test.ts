import { given, then, when } from 'test-fns';
import type { JSONSchema } from 'zod/v4/core/json-schema';

import { asDomainObjectPragma } from './asDomainObjectPragma';

describe('asDomainObjectPragma', () => {
  given('[case1] a node with an entity pragma (non-empty primary)', () => {
    const node = {
      type: 'object',
      properties: { uuid: { type: 'string' } },
      'x-domain-object': {
        name: 'Job',
        primary: ['uuid'],
        unique: ['title'],
      },
    } as unknown as JSONSchema;

    when('[t0] read', () => {
      const contract = asDomainObjectPragma({ node });

      then('it returns a contract with kind=entity', () => {
        expect(contract?.name).toEqual('Job');
        expect(contract?.kind).toEqual('entity');
        expect(contract?.primary).toEqual(['uuid']);
        expect(contract?.unique).toEqual(['title']);
      });

      then('it defaults omitted fields', () => {
        expect(contract?.alias).toEqual(null);
        expect(contract?.nested).toEqual({});
      });
    });
  });

  given('[case2] a node with a literal pragma (no primary)', () => {
    const node = {
      type: 'object',
      properties: { city: { type: 'string' } },
      'x-domain-object': { name: 'Address', unique: ['city'] },
    } as unknown as JSONSchema;

    when('[t0] read', () => {
      const contract = asDomainObjectPragma({ node });

      then('it infers kind=literal', () => {
        expect(contract?.kind).toEqual('literal');
        expect(contract?.primary).toEqual([]);
      });
    });
  });

  given('[case3] a node with no pragma', () => {
    const node = {
      type: 'object',
      properties: { foo: { type: 'string' } },
    } as unknown as JSONSchema;

    when('[t0] read', () => {
      then('it returns null', () => {
        expect(asDomainObjectPragma({ node })).toEqual(null);
      });
    });
  });

  given('[case4] a node with a nested pragma', () => {
    const node = {
      type: 'object',
      properties: { address: { type: 'object' } },
      'x-domain-object': {
        name: 'Job',
        primary: ['uuid'],
        nested: { address: 'Address' },
      },
    } as unknown as JSONSchema;

    when('[t0] read', () => {
      const contract = asDomainObjectPragma({ node });

      then('it carries the nested map', () => {
        expect(contract?.nested).toEqual({ address: 'Address' });
      });
    });
  });
});
