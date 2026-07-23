import { given, then, when } from 'test-fns';

import type { DomainObjectCaptured } from '../../../domain.objects/DomainObjectCaptured';
import { asResourcesFileSource } from './asResourcesFileSource';

describe('asResourcesFileSource', () => {
  given('[case1] one captured entity dobj', () => {
    const dobjs: DomainObjectCaptured[] = [
      {
        name: 'Job',
        kind: 'entity',
        primary: ['uuid'],
        unique: [],
        alias: null,
        nested: {},
        shape: {
          type: 'object',
          properties: { uuid: { type: 'string' } },
          required: ['uuid'],
        } as unknown as DomainObjectCaptured['shape'],
      },
    ];

    when('[t0] assembled', () => {
      const source = asResourcesFileSource({
        dobjs,
        prefix: 'SvcJobs',
        dobjRefs: { Job: 'SvcJobsJob' },
      });

      then('it carries the do-not-edit banner', () => {
        expect(source).toContain('do not edit');
      });

      then(
        'it imports only the base classes it uses (entity → DomainEntity, no unused DomainLiteral)',
        () => {
          expect(source).toContain(
            `import { DomainEntity } from 'domain-objects';`,
          );
          expect(source).not.toContain('DomainLiteral');
        },
      );

      then('it declares the prefixed class', () => {
        expect(source).toContain(
          'export class SvcJobsJob extends DomainEntity',
        );
      });
    });
  });

  given('[case2] one captured literal dobj', () => {
    const dobjs: DomainObjectCaptured[] = [
      {
        name: 'Address',
        kind: 'literal',
        primary: [],
        unique: ['city', 'postal'],
        alias: null,
        nested: {},
        shape: {
          type: 'object',
          properties: { city: { type: 'string' }, postal: { type: 'string' } },
          required: ['city', 'postal'],
        } as unknown as DomainObjectCaptured['shape'],
      },
    ];

    when('[t0] assembled', () => {
      const source = asResourcesFileSource({
        dobjs,
        prefix: 'SvcJobs',
        dobjRefs: { Address: 'SvcJobsAddress' },
      });

      then('it imports only DomainLiteral (no unused DomainEntity)', () => {
        expect(source).toContain(
          `import { DomainLiteral } from 'domain-objects';`,
        );
        expect(source).not.toContain('DomainEntity');
      });
    });
  });

  given('[case3] no captured dobjs', () => {
    when('[t0] assembled', () => {
      const source = asResourcesFileSource({
        dobjs: [],
        prefix: 'SvcJobs',
        dobjRefs: {},
      });

      then(
        'it emits the banner but no domain-objects import (no dobjs to declare)',
        () => {
          expect(source).toContain('do not edit');
          expect(source).not.toContain(`from 'domain-objects'`);
        },
      );
    });
  });

  given(
    '[case4] an entity dobj whose fields REFERENCE other dobjs by key',
    () => {
      // a SurfTrophy that references Seaturtle (by primary), Surfboard (by unique),
      // and Sponsor (by ref) — the referenced dobjs are all bound in dobjRefs
      const dobjs: DomainObjectCaptured[] = [
        {
          name: 'SurfTrophy',
          kind: 'entity',
          primary: ['uuid'],
          unique: [],
          alias: null,
          nested: {},
          shape: {
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
          } as unknown as DomainObjectCaptured['shape'],
        },
      ];

      when('[t0] assembled with the referenced dobjs bound', () => {
        const source = asResourcesFileSource({
          dobjs,
          prefix: 'SvcSurf',
          dobjRefs: {
            SurfTrophy: 'SvcSurfSurfTrophy',
            Seaturtle: 'SvcSurfSeaturtle',
            Surfboard: 'SvcSurfSurfboard',
            Sponsor: 'SvcSurfSponsor',
          },
        });

        then(
          'the domain-objects import carries the base class + all ref generics, alphabetized',
          () => {
            expect(source).toContain(
              `import { DomainEntity, Ref, RefByPrimary, RefByUnique } from 'domain-objects';`,
            );
          },
        );

        then(
          'each field emits its typed ref against the prefixed resource',
          () => {
            expect(source).toContain(
              'rider: RefByPrimary<typeof SvcSurfSeaturtle>;',
            );
            expect(source).toContain(
              'board: RefByUnique<typeof SvcSurfSurfboard>;',
            );
            expect(source).toContain('sponsor: Ref<typeof SvcSurfSponsor>;');
          },
        );
      });
    },
  );
});
