import { given, then, when } from 'test-fns';

import type { DomainObjectCaptured } from '../../../domain.objects/DomainObjectCaptured';
import { asResourceClassSource } from './asResourceClassSource';

const jobShape = {
  type: 'object',
  properties: { uuid: { type: 'string' }, title: { type: 'string' } },
  required: ['uuid', 'title'],
} as unknown as DomainObjectCaptured['shape'];

describe('asResourceClassSource', () => {
  given('[case1] an entity dobj with primary + unique', () => {
    const dobj: DomainObjectCaptured = {
      name: 'Job',
      kind: 'entity',
      primary: ['uuid'],
      unique: ['title'],
      alias: null,
      nested: {},
      shape: jobShape,
    };

    when('[t0] emitted with prefix SvcJobs', () => {
      const source = asResourceClassSource({
        dobj,
        prefix: 'SvcJobs',
        dobjRefs: { Job: 'SvcJobsJob' },
      });

      then('the class name is prefixed', () => {
        expect(source).toContain('export interface SvcJobsJob');
        expect(source).toContain(
          'export class SvcJobsJob extends DomainEntity<SvcJobsJob>',
        );
      });

      then('it carries primary + unique statics', () => {
        expect(source).toContain(`public static primary = ["uuid"] as const;`);
        expect(source).toContain(`public static unique = ["title"] as const;`);
      });

      then('it carries no static schema', () => {
        expect(source).not.toContain('static schema');
      });
    });
  });

  given('[case2] a literal dobj (no primary)', () => {
    const dobj: DomainObjectCaptured = {
      name: 'Address',
      kind: 'literal',
      primary: [],
      unique: ['city'],
      alias: null,
      nested: {},
      shape: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      } as unknown as DomainObjectCaptured['shape'],
    };

    when('[t0] emitted', () => {
      const source = asResourceClassSource({
        dobj,
        prefix: 'SvcJobs',
        dobjRefs: { Address: 'SvcJobsAddress' },
      });

      then('it extends DomainLiteral', () => {
        expect(source).toContain('extends DomainLiteral<SvcJobsAddress>');
      });
    });
  });

  given('[case3] a dobj with an alias + nested refs', () => {
    const dobj: DomainObjectCaptured = {
      name: 'Job',
      kind: 'entity',
      primary: ['uuid'],
      unique: [],
      alias: { singular: 'job', plural: 'jobs' },
      nested: { address: 'Address' },
      shape: jobShape,
    };

    when('[t0] emitted', () => {
      const source = asResourceClassSource({
        dobj,
        prefix: 'SvcJobs',
        dobjRefs: { Job: 'SvcJobsJob', Address: 'SvcJobsAddress' },
      });

      then(
        'the alias static is a clean object literal (unquoted keys, no raw json)',
        () => {
          expect(source).toContain('public static alias =');
          expect(source).toContain('{ singular: "job", plural: "jobs" }');
          expect(source).not.toContain('"singular":"job"');
        },
      );

      then('nested type names are prefixed', () => {
        expect(source).toContain(
          'public static nested = { address: SvcJobsAddress };',
        );
      });
    });
  });
});
