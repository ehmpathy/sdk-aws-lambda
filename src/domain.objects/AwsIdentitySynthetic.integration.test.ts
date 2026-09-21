import { given, then, when } from 'test-fns';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { asCodeWithoutComments } from '../__test_assets__/getAllReachableSources';
import { getAllSourcesInTree } from '../__test_assets__/getAllSourcesInTree';
import {
  AWS_ACCOUNT_SYNTHETIC,
  AWS_REGION_SYNTHETIC,
} from './AwsIdentitySynthetic';

/**
 * .what = pins the synthetic aws identity to ONE module that declares it
 * .why = 🔴 a duplicate that AGREES is invisible to every test — each copy is a
 *        valid arn on its own, so the suite stays green right up until an edit
 *        splits them, and stays green after.
 *
 * ⇒ so the GUARD is the deliverable, never the deduplication. a sweep removes
 *   today's copies and does naught about the next speaker.
 *
 * ⚠️ the match is on the EXACT quoted literal, never the bare digits.
 *    `000000000000` appears legitimately inside four unrelated values here:
 *
 *      requestId:  '00000000-0000-4000-8000-000000000000'   ← a zero uuid
 *      eTag:       '00000000000000000000000000000000'       ← 32 zeros
 *      md5OfBody:  '00000000000000000000000000000000'       ← 32 zeros
 *      eventID:    `shardId-000000000000:${sequenceNumber}` ← a shard id
 *
 *    none is the account. a detector that matched a bare run of digits would
 *    flag all four, and a guard that cries wolf on its first run is a guard
 *    somebody deletes.
 *
 *    ⇒ a quote must sit adjacent to exactly twelve zeros on BOTH sides, which
 *      none of the four satisfies — the uuid has a `-` before its last twelve,
 *      and the 32-zero pair has a zero.
 */
describe('AwsIdentitySynthetic', () => {
  const ROOT = join(__dirname, '..');

  given('[case1] the synthetic aws identity is a repo-wide convention', () => {
    when('[t0] every non-test module in src is inspected', () => {
      then('exactly one module declares the literals', () => {
        const quoted = (literal: string): RegExp =>
          new RegExp(`['"\`]${literal}['"\`]`);
        const declarers = [AWS_REGION_SYNTHETIC, AWS_ACCOUNT_SYNTHETIC].flatMap(
          (literal) =>
            getAllSourcesInTree({ from: ROOT })
              .filter((path) => !path.endsWith('.test.ts'))
              .filter((path) =>
                quoted(literal).test(
                  asCodeWithoutComments(readFileSync(path, 'utf8')),
                ),
              )
              .map((path) => path.replace(`${ROOT}/`, '')),
        );

        // 🔴 an EXACT list, never a `<= 1` count. an allowlist that tolerated the
        //    owner would go green on a SECOND declarer, which is the whole
        //    failure this guard exists to bar.
        expect([...new Set(declarers)]).toEqual([
          'domain.objects/AwsIdentitySynthetic.ts',
        ]);
      });

      then('the walk actually reached the tree — teeth', () => {
        // the anti-vacuous half. a walk that returned `[]` would make the check
        // above pass over an empty repo, which is the failure mode a structural
        // guard is most prone to and least likely to reveal.
        const sources = getAllSourcesInTree({ from: ROOT });
        expect(sources.length).toBeGreaterThan(50);
        expect(
          sources.some((path) => path.endsWith('asLambdaContext.ts')),
        ).toEqual(true);
        expect(
          sources.some((path) => path.endsWith('asLocalRunIdentity.ts')),
        ).toEqual(true);
      });
    });

    when('[t1] the two consumers that forked it are read', () => {
      then('neither declares its own copy any longer', () => {
        // the two prior forks, asserted BY NAME rather than only via the tree
        // walk above — so an edit that re-inlines one names the file in its
        // failure message.
        const forked = [
          'domain.operations/runLambdaEndpoint/local/asLocalRunIdentity.ts',
          'domain.operations/runLambdaEndpoint/context/asLambdaContext.ts',
        ];

        forked.forEach((relative) => {
          const code = asCodeWithoutComments(
            readFileSync(join(ROOT, relative), 'utf8'),
          );
          expect(code).toContain('AwsIdentitySynthetic');
          expect(code).not.toMatch(/['"`]us-east-1['"`]/);
          expect(code).not.toMatch(/['"`]000000000000['"`]/);
        });
      });
    });
  });
});
