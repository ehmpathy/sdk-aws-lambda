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

        // .why = the hint IS the fix, and it is the one string this operation emits for a
        //        human to read (rule.require.errors-name-the-fix). unclamped, a later
        //        refactor can drop it or stale its api and the suite stays green
        // .note = read off `.message` rather than `.metadata`, because helpful-errors
        //         serializes metadata INTO the message — so this clamps the string at the
        //         surface a human actually meets, and it needs no cast
        then('the message carries a hint that names the fix', () => {
          expect(error.message).toContain(
            'surface each referenced domain-object in full',
          );
        });

        // .why = the hint cites an api, and an api in prose goes stale in silence. this is
        //        the line the 0.34.0 bump moved (`.contract` -> `X.contract()`)
        then('the hint cites the api that ships today', () => {
          expect(error.message).toContain('X.contract()');
        });
      },
    );
  });

  given('[case3] an unbound ref at an INPUT schema position', () => {
    /**
     * .what = the mirror of `[case2]`, with the ref pragma under `input` rather than
     *         `output`
     *
     * ⚠️ .why it was owed = `assertAllDomainObjectRefsBind.ts:24-25` walks the two
     *    schemas symmetrically, and every extant case put its pragma under `output`
     *    ONLY. so half of a guard the codegen path leans on hardest was unclamped —
     *    and it is the half on the INPUT side, which is the side this whole wish is
     *    centered on
     *
     * .the regression it catches = a change to `collectRefNames`'s caller that descends
     *      from one root rather than both. today that would pass every other case in
     *      this file while it silently stopped to guard the input side
     *
     * ⚠️ .PROVEN BY REVERT (rule.require.clamp-edge-cases). drop the
     *    `collectRefNames({ node: schema.input, … })` call at `:24`:
     *
     *      revert                        | result
     *      ------------------------------|------------------------------------------
     *      the `schema.input` walk, gone  | 🔴 2 red, and BOTH are `[case3][t0]`
     *
     *    ⇒ every other case in this file stays green, which is what makes this a clamp
     *      of the INPUT arm specifically rather than of the guard in general. `[t1]`
     *      stays green too — correctly, since it asserts a NON-throw
     *
     * ⚠️ .this block said "1 red" before it was run, and the measurement said 2 — both
     *    `then` rows under `[t0]` hang off the same throw, so both move together. a
     *    count stated from a model rather than a run is the exact defect this branch
     *    has now met four times (rule.require.measure-the-value-you-emit)
     */
    const contracts = asContracts({
      setTrophy: {
        input: {
          type: 'object',
          properties: {
            rider: {
              type: 'object',
              properties: { uuid: { type: 'string' } },
              'x-domain-object-ref': { of: 'Seaturtle', by: 'primary' },
            },
          },
        },
        output: { type: 'object' },
      },
    });

    when(
      '[t0] the referenced Seaturtle is absent from the captured set',
      () => {
        const error = getError(() =>
          assertAllDomainObjectRefsBind({
            contracts,
            capturedNames: new Set([]),
          }),
        );

        then('the input arm is walked, so it throws', () => {
          expect(error).toBeInstanceOf(LambdaDomainObjectRefUnbindableError);
        });

        then('the message names the ref found on the INPUT side', () => {
          expect(error.message).toContain('Seaturtle');
        });
      },
    );

    when('[t1] the same ref IS captured', () => {
      // .why = the positive control. without it, a guard that threw for any input at all
      //        would satisfy `[t0]` and read as a pass
      //        (rule.require.positive-control-before-absence-claims)
      then('it does not throw, so the arm discriminates', () => {
        expect(() =>
          assertAllDomainObjectRefsBind({
            contracts,
            capturedNames: new Set(['Seaturtle']),
          }),
        ).not.toThrow();
      });
    });
  });

  given('[case4] contracts with no refs at all', () => {
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
