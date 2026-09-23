import { given, then, when } from 'test-fns';

/**
 * .what = the boot contract of `jest.acceptance.env.ts`, clamped from inside the suite it boots
 * .why = that file's two credential guarantees are CONFIG, so a revert of either leaves every
 *        extant test green — the tests would simply run against whichever identity the aws
 *        credential chain found next (`rule.forbid.failhide`). this file is the only place that
 *        can observe the boot, because `setupFilesAfterEnv` has already run by the time it does
 *
 * .note = it is `.acceptance.test.ts` rather than a unit test on purpose. the env file carries
 *         top-level throws and a keyrack call, so it cannot be imported; the only honest way to
 *         read what it did is to be a test that it booted
 *
 * .note = the twin is `jest.integration.env.integration.test.ts`. the rationale, the bound on
 *         what the second clamp proves, and the third unclamped site are recorded there rather
 *         than restated here
 *
 * .note = the twin carries ONE clamp this file deliberately does not: `[case2]`, on the
 *         `.agent/keyrack.yml` waiver that keeps `strict` from a FALSE refusal of a
 *         hand-exported static key. that manifest is one file BOTH suites source, so a copy
 *         here would prove one fact twice (rule.prefer.wet-over-dry)
 */
describe('jest.acceptance.env', () => {
  given('[case1] the acceptance suite has booted', () => {
    when('[t0] the env is read', () => {
      then('the ec2 instance-metadata provider is refused', () => {
        expect(process.env.AWS_EC2_METADATA_DISABLED).toEqual('true');
      });

      then('a credential reached the suite, from one source or the other', () => {
        const source = process.env.AWS_PROFILE ?? process.env.AWS_ACCESS_KEY_ID;
        expect(source).toBeDefined();
      });
    });
  });
});
