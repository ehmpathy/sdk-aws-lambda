import { getError, given, then, when } from 'test-fns';

import { LambdaDomainObjectRefUnbindableError } from '../../../domain.objects/LambdaDomainObjectRefUnbindableError';
import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { assertAllDomainObjectRefsBind } from './assertAllDomainObjectRefsBind';

const asContracts = (
  contracts: Record<string, unknown>,
): Record<string, LambdaEndpointSchema> =>
  contracts as Record<string, LambdaEndpointSchema>;

describe('assertAllDomainObjectRefsBind', () => {
  given('[case1] a ref whose dobj IS captured', () => {
    const contracts = asContracts({
      getTrophy: {
        input: { type: 'object' },
        output: {
          type: 'object',
          properties: {
            trophy: {
              type: 'object',
              properties: {
                rider: {
                  type: 'object',
                  properties: { uuid: { type: 'string' } },
                  'x-domain-object-ref': { of: 'Seaturtle', by: 'primary' },
                },
              },
            },
          },
        },
      },
    });

    when('[t0] the referenced Seaturtle is in the captured set', () => {
      then('it does not throw', () => {
        expect(() =>
          assertAllDomainObjectRefsBind({
            contracts,
            capturedNames: new Set(['Seaturtle']),
          }),
        ).not.toThrow();
      });
    });
  });

  given('[case2] a ref whose dobj is captured by NO endpoint', () => {
    const contracts = asContracts({
      getTrophy: {
        input: { type: 'object' },
        output: {
          type: 'object',
          properties: {
            board: {
              type: 'object',
              properties: { brand: { type: 'string' } },
              'x-domain-object-ref': { of: 'Surfboard', by: 'unique' },
            },
          },
        },
      },
    });

    when(
      '[t0] the referenced Surfboard is absent from the captured set',
      () => {
        const error = getError(() =>
          assertAllDomainObjectRefsBind({
            contracts,
            capturedNames: new Set([]),
          }),
        );

        then('it throws LambdaDomainObjectRefUnbindableError', () => {
          expect(error).toBeInstanceOf(LambdaDomainObjectRefUnbindableError);
        });

        then('the message names the unbound ref', () => {
          expect(error.message).toContain('Surfboard');
        });
      },
    );
  });

  given('[case3] contracts with no refs at all', () => {
    const contracts = asContracts({
      getJob: {
        input: { type: 'object' },
        output: {
          type: 'object',
          properties: { ok: { type: 'boolean' } },
        },
      },
    });

    when('[t0] no ref pragma exists anywhere', () => {
      then('it does not throw (there is no ref to bind)', () => {
        expect(() =>
          assertAllDomainObjectRefsBind({
            contracts,
            capturedNames: new Set([]),
          }),
        ).not.toThrow();
      });
    });
  });
});
