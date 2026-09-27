import { readFileSync } from 'fs';
import { ConstraintError } from 'helpful-errors';
import { join } from 'path';
import { given, then, when } from 'test-fns';

import type { ForApiGatewayInput } from './genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway';
import type { GenLambdaEndpointInput } from './genLambdaEndpoint.forAsk/genLambdaEndpoint.forAsk';
import type { ForSqsPerBatchInput } from './genLambdaEndpoint.forSqs/genLambdaEndpoint.forSqs.perBatch';
import type { ForSqsPerRecordInput } from './genLambdaEndpoint.forSqs/genLambdaEndpoint.forSqs.perRecord';
import type { InvokeInputSuperset } from './InvokeInputSuperset';

/**
 * .what = clamps the AUDIT TABLE the rule brief publishes against the contracts it describes
 * .why = the brief's table is the inventory a reader trusts and a reviewer grades against. the
 *        unit clamp (`InvokeInputSuperset.test.ts`) holds the CODE to the superset and says not
 *        one word about the table — so a slot added to a variant, to the superset, and to that
 *        test passes every gate while the table silently goes stale
 *
 * .the gap this closes = a stale audit is worse than an absent one: it reads as a measurement
 *        and reports a state that no longer holds, so the next reader grades a contract against
 *        a fiction (`rule.require.measure-the-value-you-emit`)
 *
 * .note = the same technique `ApiGatewayRequestEventUnified.integration.test.ts` uses to hold
 *         the readme's envelope key list to its type — one published list, held to its source
 */

type Headers = { authorization: string };
type Payload = { to: string };
type Body = { sent: boolean };
type AskEvent = { name: string };

type InputOfAskEndpoint = Parameters<
  GenLambdaEndpointInput<AskEvent, { ok: boolean }>['invoke']
>[0];
type InputOfApiGateway = Parameters<
  ForApiGatewayInput<Headers, Payload, Body>['invoke']
>[0];
type InputOfSqsPerRecord = Parameters<
  ForSqsPerRecordInput<Headers, Payload>['invoke']
>[0];
type InputOfSqsPerBatch = Parameters<
  ForSqsPerBatchInput<Headers, Payload>['invoke']
>[0];

/**
 * .what = the superset's own key set, and each variant's subset of it
 * .why = re-declared here rather than imported from the unit clamp — each literal is pinned by
 *        `satisfies Record<keyof …, true>`, so neither can drift from the type it describes and
 *        an export from a `.test.ts` would be the worse trade (`rule.prefer.wet-over-dry`)
 */
const SLOTS_OF_SUPERSET: Record<
  keyof InvokeInputSuperset<{
    headers: unknown;
    payload: unknown;
    event: unknown;
    record: unknown;
  }>,
  true
> = { headers: true, payload: true, event: true, records: true };

const SLOTS_PER_VARIANT: Record<string, Record<string, true>> = {
  forAsk: { payload: true, event: true } satisfies Record<
    keyof InputOfAskEndpoint,
    true
  >,
  forApiGateway: {
    headers: true,
    payload: true,
    event: true,
  } satisfies Record<keyof InputOfApiGateway, true>,
  'forSqs.perRecord': {
    payload: true,
    headers: true,
    event: true,
  } satisfies Record<keyof InputOfSqsPerRecord, true>,
  'forSqs.perBatch': { records: true, event: true } satisfies Record<
    keyof InputOfSqsPerBatch,
    true
  >,
};

/**
 * .what = the exact header the brief publishes its audit table under
 * .why = anchored on the header rather than on a line number, so an edit elsewhere in the brief
 *        cannot move the target out from under this test
 */
const ANCHOR = '## .the audit, as it stands';

/**
 * .what = lifts the per-variant slot sets out of the brief's audit table
 * .why = named rather than inline, so the `then` below reads as the claim it makes and not as a
 *        parse (`rule.forbid.inline-decode-friction`)
 *
 * .how = the header row names the variants; each body row names a slot. a cell that carries ✅
 *        asserts the variant has that slot, and one that carries ⛔ asserts it does not. rows
 *        whose slot is absent from the superset are config members, which this clamp does not
 *        read — see the caveat in the describe below
 *
 * .note = fails loud when the anchor, the table, or a cell verdict is absent, rather than return
 *         an empty map. an empty map would satisfy a `toEqual` against an empty map and read as
 *         a pass — the failhide this file exists to prevent (`rule.forbid.failhide`)
 *
 * .why ConstraintError = a caller must fix it — a human restores the table or re-anchors this
 *         test. it is never a malfunction of the machine, so the class states who owns the
 *         repair and carries the fix in its metadata (`rule.require.failloud`, exit 2)
 */
const getAllSlotsAdvertised = (input: {
  brief: string;
}): Record<string, string[]> => {
  const afterAnchor = input.brief.split(ANCHOR)[1];
  if (!afterAnchor)
    throw new ConstraintError(
      'the rule brief no longer holds the anchor header for the audit table',
      {
        anchor: ANCHOR,
        fix: 'either the section moved (re-anchor this test) or the audit table was dropped (restore it — it is the inventory a reviewer grades a new variant against)',
      },
    );

  const rows = afterAnchor
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'));
  const [head, , ...body] = rows;
  if (!head || body.length === 0)
    throw new ConstraintError(
      'the anchor header is present but no audit table follows it in the rule brief',
      {
        anchor: ANCHOR,
        fix: 'the audit must stay a markdown table whose header row names the variants, so this clamp can read it',
      },
    );

  const asCells = (row: string): string[] =>
    row
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/`/g, ''));

  const variants = asCells(head).slice(1);
  const namesOfSuperset = Object.keys(SLOTS_OF_SUPERSET);

  const advertised: Record<string, string[]> = Object.fromEntries(
    variants.map((variant) => [variant, [] as string[]]),
  );

  for (const row of body) {
    const cells = asCells(row);
    const slot = cells[0]!;
    if (!namesOfSuperset.includes(slot)) continue; // a config row; out of this clamp's reach

    cells.slice(1).forEach((cell, index) => {
      const variant = variants[index]!;
      if (cell.includes('✅')) advertised[variant]!.push(slot);
      else if (!cell.includes('⛔'))
        throw new ConstraintError(
          'an audit cell carries neither a ✅ nor a ⛔, so its verdict cannot be read',
          {
            slot,
            variant,
            cell,
            fix: 'every cell of an invoke-slot row states presence with ✅ or exclusion with ⛔; a qualifier may ride beside it',
          },
        );
    });
  }

  return Object.fromEntries(
    Object.entries(advertised).map(([variant, slots]) => [
      variant,
      slots.sort(),
    ]),
  );
};

describe('the audit table, as the rule brief publishes it', () => {
  /**
   * .why an integration test = it reads the brief off disk, which is a remote boundary a unit
   *      test may not cross (`rule.forbid.unit.remote-boundaries`)
   *
   * .the bound = this reads the invoke-slot rows alone. the table's config rows carry decorated
   *      names (`schema.input`, `logTranslate?`, `deserialize?.payload`) that collapse to one
   *      key two ways, so a normalization would be a guess rather than a read — the config half
   *      of the table stays a reviewer find
   */
  given('[case1] the brief publishes a per-variant slot audit', () => {
    const brief = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        '.agent',
        'repo=.this',
        'role=any',
        'briefs',
        'rule.require.consistent-variant-contracts.md',
      ),
      'utf8',
    );

    when('[t0] the advertised slots are read back', () => {
      then('they are exactly the slots each contract carries', () => {
        expect(getAllSlotsAdvertised({ brief })).toEqual(
          Object.fromEntries(
            Object.entries(SLOTS_PER_VARIANT).map(([variant, slots]) => [
              variant,
              Object.keys(slots).sort(),
            ]),
          ),
        );
      });

      /**
       * .what = the bite check on the instrument. `[t0]` compares two maps, and two empty maps
       *         satisfy it — so a moved section, a dropped table, or a header change would read
       *         as a clean pass. this control proves the parse reached real content
       *         (`rule.require.positive-control-before-absence-claims`)
       */
      then(
        'the parse found a real table, so the compare is not vacuous',
        () => {
          const advertised = getAllSlotsAdvertised({ brief });
          expect(Object.keys(advertised).sort()).toEqual([
            'forApiGateway',
            'forAsk',
            'forSqs.perBatch',
            'forSqs.perRecord',
          ]);
          expect(
            Object.values(advertised).reduce(
              (count, slots) => count + slots.length,
              0,
            ),
          ).toEqual(10);
        },
      );
    });
  });
});
