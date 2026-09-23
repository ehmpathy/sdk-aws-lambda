import { readFileSync } from 'fs';
import { join } from 'path';

import { given, then, when } from 'test-fns';

/**
 * .what = the boot contract of `jest.integration.env.ts`, clamped from inside the suite it boots
 * .why = that file's two credential guarantees are CONFIG, so a revert of either leaves every
 *        extant test green — the tests would simply run against whichever identity the aws
 *        credential chain found next (`rule.forbid.failhide`). this file is the only place that
 *        can observe the boot, because `setupFilesAfterEnv` has already run by the time it does
 *
 * .note = it is `.integration.test.ts` rather than a unit test on purpose. the env file carries
 *         top-level throws and a keyrack call, so it cannot be imported; the only honest way to
 *         read what it did is to be a test that it booted
 *
 * .note = the twin is `jest.acceptance.env.acceptance.test.ts`, which clamps the identical pair
 *         for the acceptance suite. the third site — `provision/aws.infra/account=demo/
 *         resources.ts` — carries the same two lines and is a declastruct wish rather than a
 *         suite, so it cannot self-clamp. 🚧 an ACCOUNT assertion is what would cover all three
 *         at once, and it is not yet built
 */
/**
 * .what = one `- key: X` entry of a keyrack manifest, paired with the waiver declared beneath it
 */
interface KeyrackDeclaration {
  key: string;
  waivedBy: string | null;
}

/**
 * .what = reads the `- key: X` entries of a keyrack manifest, each paired with its
 *         `is-optional-if-has` waiver
 * .why = three peer lanes converged on the inline pipeline this replaces, and the prior round
 *        answered them with a comment rather than a name — which is the tell that the intent
 *        lived in prose (rule.require.named-transformers)
 *
 * ⚠️ .why it is STRONGER than the pipeline it replaces = that one counted `- ` lines, counted
 *         waiver matches across the whole file, and asserted the two totals agree. two totals
 *         that agree is not the claim — a waiver declared under some OTHER key would satisfy
 *         it. this pairs each key with the line beneath it, so the assertion becomes
 *         per-declaration
 *
 * .the sweep = the stated cause is "a multi-step text derivation left inline at its assertion".
 *              every `.split('\n')` chain on this branch, checked:
 *                jest.integration.env.integration.test.ts  ⛔ was inline; named HERE
 *                getValidatedOutput.test.ts                ✅ already named, as `asErrorTitle`
 *              ⇒ the family is two, and the one that was inline is the one extracted
 *
 * .why it stays LOCAL rather than moves to `src/__test_assets__/` = it has exactly one
 *      consumer. the acceptance twin deliberately does NOT repeat this case, so a lift would be
 *      speculative (rule.prefer.most-common-denominator). the ask was for a NAME, which is a
 *      readability claim, never a reuse one
 *
 * .bound = this reads the manifest's LINE SHAPE, never its yaml semantics — the waiver is
 *          block-style, so it sits on the line after its key. that is why a pair-read is
 *          possible at all without the yaml dep this repo does not carry. a manifest rewritten
 *          to inline style would return `waivedBy: null` and the clamp goes red rather than
 *          quiet, which is the correct direction to fail
 */
const asKeyrackDeclarations = (input: {
  manifest: string;
}): KeyrackDeclaration[] => {
  const lines = input.manifest.split('\n');
  return lines.flatMap((line, index) => {
    const key = line.trimStart().startsWith('- key:')
      ? (line.split('key:')[1]?.trim() ?? null)
      : null;
    if (!key) return [];
    const waivedBy =
      lines[index + 1]?.match(/is-optional-if-has:\s*(\S+)/)?.[1] ?? null;
    return [{ key, waivedBy }];
  });
};

describe('jest.integration.env', () => {
  given('[case1] the integration suite has booted', () => {
    when('[t0] the env is read', () => {
      then('the ec2 instance-metadata provider is refused', () => {
        expect(process.env.AWS_EC2_METADATA_DISABLED).toEqual('true');
      });

      // .why = `strict` exists so an absent keyrack grant REFUSES rather than falls through.
      //        the observable consequence is that a credential is present by the time a test
      //        runs — via AWS_PROFILE locally, via oidc's ACCESS_KEY_ID on ci
      // .note = this bites on a box with no grant, which is the box where the fall-through
      //         happens. on a box whose keyrack is already unlocked, `lenient` would set the
      //         profile too and this stays green — stated rather than overclaimed
      then('a credential reached the suite, from one source or the other', () => {
        const source = process.env.AWS_PROFILE ?? process.env.AWS_ACCESS_KEY_ID;
        expect(source).toBeDefined();
      });
    });
  });

  /**
   * .what = the manifest declares the waiver that keeps `strict` from a FALSE refusal
   * .why = the clamp above reads the OUTCOME — a credential is present — and four peer-review
   *        rounds named the gap it leaves: it cannot tell a keyrack-granted run from a run
   *        whose human exported a static key by hand. the second is a healthy run, and
   *        `strict` refused it for as long as `.agent/keyrack.yml` declared `AWS_PROFILE` bare.
   *        `decideIsKeyStrictlyRequired` waives an ABSENT key whose `is-optional-if-has` peer
   *        is set, so the repair is that one declaration — and a revert of it is silent: every
   *        test here stays green on a box that HAS a grant, which is every box that runs ci
   *
   * .bound = this reads the manifest as TEXT, so it clamps that the declaration is present and
   *          says not one word about what keyrack does with it. the behavior belongs to the
   *          dependency and is read at `decideIsKeyStrictlyRequired.js:24`. a full yaml parse
   *          would need a dep this repo does not carry, and it would buy no guarantee the
   *          line-pair read does not — the one edit that reverts the repair is a rewrite of
   *          these two lines
   *
   * .the twin = `jest.acceptance.env.acceptance.test.ts` clamps the same boot pair, and does
   *             NOT repeat this one: the manifest is ONE file both suites source, so a second
   *             copy would prove one fact twice (rule.prefer.wet-over-dry)
   */
  given('[case2] the keyrack manifest both suites source', () => {
    const manifest = readFileSync(
      join(process.cwd(), '.agent/keyrack.yml'),
      'utf8',
    );

    when('[t0] its AWS_PROFILE declarations are read', () => {
      // .note = the transformer takes only `- key:` entries, so the manifest's own PROSE — which
      //         names AWS_PROFILE several times above — is excluded by construction. that prose
      //         is what broke the first draft of this clamp, caught on its first run
      then('every one carries the static-key waiver', () => {
        const declarations = asKeyrackDeclarations({ manifest }).filter(
          (declaration) => declaration.key === 'AWS_PROFILE',
        );
        expect(declarations.length).toBeGreaterThan(0);
        for (const declaration of declarations)
          expect(declaration.waivedBy).toEqual('AWS_ACCESS_KEY_ID');
      });
    });
  });
});
