import { readFileSync } from 'fs';
import { ConstraintError } from 'helpful-errors';
import { join } from 'path';
import { given, then, when } from 'test-fns';

import type { ApiGatewayRequestEventUnified } from './ApiGatewayRequestEventUnified';

/**
 * .what = every key of the envelope a handler receives, as a value tsc refuses to let drift
 * .why = the readme publishes this list in full, and a caller reads it to know what `event`
 *        holds. a key added to the type but not to the readme would be a slot no caller finds
 *
 * .how it cannot drift = `Record<keyof ApiGatewayRequestEventUnified, true>` is exhaustive by
 *        construction. add a key to the interface and tsc refuses this literal (TS2741,
 *        property absent); remove one and it refuses the excess. the type gate is the clamp,
 *        and the runtime body below only carries it to the readme
 *
 * .note = the same technique `getAllResponseOnwireKeysFound.ts` uses for the response side —
 *         one published exhaustive list per direction, each held to its type
 *         (`rule.require.sweep-the-defect-class`)
 */
const KEYS_OF_ENVELOPE: Record<keyof ApiGatewayRequestEventUnified, true> = {
  method: true,
  headers: true,
  payload: true,
  codec: true,
  params: true,
  _: true,
};

/**
 * .what = the sentence the readme's envelope key table follows
 * .why = anchored on a sentence rather than on a line number, so a readme edit elsewhere cannot
 *        move the target out from under this test
 */
const ANCHOR = '`event` carries six keys:';

/**
 * .what = lifts the key names out of the first column of the readme's envelope table
 * .why = named rather than inline, so the `then` below reads as the claim it makes and not as
 *        a parse (`rule.forbid.inline-decode-friction`)
 *
 * .note = fails LOUD when the anchor or the table is absent, rather than return an empty list.
 *         an empty list would satisfy a `toEqual` against an empty list and read as a pass —
 *         the failhide this whole file exists to prevent one level up (`rule.forbid.failhide`)
 *
 * .why ConstraintError = a CALLER must fix it — a human restores the table or re-anchors this
 *         test. it is never a malfunction of the machine the test runs on, so the class states
 *         who owns the repair and carries the fix in its metadata
 *         (`rule.require.failloud`, exit 2)
 */
const getAllEnvelopeKeysAdvertised = (input: { readme: string }): string[] => {
  const afterAnchor = input.readme.split(ANCHOR)[1];
  if (!afterAnchor)
    throw new ConstraintError(
      'readme.md no longer holds the anchor sentence for the envelope key table',
      {
        anchor: ANCHOR,
        fix: 'either the section moved (re-anchor this test) or the key table was dropped (restore it)',
      },
    );

  // the table is the first paragraph after the anchor; its key rows open with a backticked name
  const table = afterAnchor.trimStart().split('\n\n')[0] ?? '';
  const keys = table
    .split('\n')
    .map((row) => /^\| `([^`]+)` \|/.exec(row)?.[1])
    .filter((key): key is string => key !== undefined);
  if (keys.length === 0)
    throw new ConstraintError(
      'the anchor sentence is present but no key table follows it in readme.md',
      {
        anchor: ANCHOR,
        fix: 'the envelope keys must stay a table whose first column holds each key in backticks',
      },
    );

  return keys.sort();
};

describe('ApiGatewayRequestEventUnified, as the readme advertises it', () => {
  /**
   * .why an INTEGRATION test = it reads `readme.md` off disk, which is a remote boundary a
   *      unit test may not cross (`rule.forbid.unit.remote-boundaries`). the TYPE half above
   *      needs no runtime at all — `--what types` already refuses a drifted literal — so the
   *      fast gate keeps the half that can be fast
   */
  given('[case1] the readme publishes the envelope key list in full', () => {
    const readme = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'readme.md'),
      'utf8',
    );

    when('[t0] the advertised names are read back', () => {
      then(
        'they are exactly the keys of the type, no more and no fewer',
        () => {
          expect(getAllEnvelopeKeysAdvertised({ readme })).toEqual(
            Object.keys(KEYS_OF_ENVELOPE).sort(),
          );
        },
      );

      /**
       * .what = the bite check on the instrument. `[t0]` compares two lists, and two empty
       *         lists satisfy it — so a moved section, a dropped fence, or a separator change
       *         would read as a clean pass. this control proves the parse reached real content
       *         (`rule.require.positive-control-before-absence-claims`)
       */
      then(
        'the parse found a real list, so the comparison is not vacuous',
        () => {
          expect(getAllEnvelopeKeysAdvertised({ readme }).length).toEqual(6);
        },
      );
    });
  });
});
