import { given, then, when } from 'test-fns';

import { asBarrelFileSource } from './asBarrelFileSource';

describe('asBarrelFileSource', () => {
  given('[case1] the svcJobs barrel', () => {
    when('[t0] assembled', () => {
      const source = asBarrelFileSource({
        object: 'svcJobs',
        mechanismsModule: './svcJobs.mechanisms',
        resourcesModule: './svcJobs.resources',
      });

      then('it re-exports the mechanisms object', () => {
        expect(source).toContain(
          `export { svcJobs } from './svcJobs.mechanisms';`,
        );
      });

      then('it re-exports all resources', () => {
        expect(source).toContain(`export * from './svcJobs.resources';`);
      });

      then('it carries the banner', () => {
        expect(source).toContain('do not edit');
      });
    });
  });
});
