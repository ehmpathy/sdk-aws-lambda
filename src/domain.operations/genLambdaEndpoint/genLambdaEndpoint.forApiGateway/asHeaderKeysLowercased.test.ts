import { given, then, when } from 'test-fns';

import { asHeaderKeysLowercased } from './asHeaderKeysLowercased';

/**
 * .what = the unit clamps for the header case-fold
 * .why = `asApiGatewayRequestEventUnified.test.ts [case7]` already proves the fold lands on both
 *        wire arms, so this file deliberately does not restate that. it clamps the two
 *        behaviors that file cannot reach, and that the transformer's own `.note`s claim
 *        (`rule.require.clamp-edge-cases` — a documented claim owes a clamp that bites)
 *
 * .note = a well-covered core is what hides an undefended edge. the fold has ample coverage, so
 *         a reader who greps `toLowerCase` finds hits and stops — and the two claims below sit
 *         outside every one of them
 */
describe('asHeaderKeysLowercased', () => {
  /**
   * .why = v2 declares `headers` optional while v1 declares it required, so the wire union's
   *        member is `… | undefined`. a transformer that returns a bag either way is the only
   *        reason the reconcile needs no cast (`rule.forbid.as-cast`) — regress this branch and
   *        the cast returns, silently
   */
  given(
    '[case1] an absent header bag — the v2 arm, where the key is optional',
    () => {
      when('[t0] the fold runs', () => {
        then(
          'it returns an empty bag rather than throw or pass undefined on',
          () => {
            expect(asHeaderKeysLowercased({ headers: undefined })).toEqual({});
          },
        );
      });
    },
  );

  /**
   * .why = the transformer's `.note` states *"a later duplicate key WINS"*, which is a real
   *        behavioral CHOICE rather than an incidental — api gateway v1 preserves wire case, so a
   *        caller that sends both `Accept` and `accept` produces exactly this collision. the
   *        vendor proves it happens: `@middy/http-response-serializer` reads
   *        `headers?.Accept ?? headers?.accept` (`index.js:25`), a fallback nobody writes for a
   *        case they have never met
   * .note = the loser's value is UNRECOVERABLE from the bag afterward, by design. a reader who
   *         needs the wire's own letter-case reads `event._.raw`, and `[case7][t0]` clamps that
   */
  given('[case2] two keys that differ only in case', () => {
    when('[t0] the fold collapses them onto one', () => {
      then('the LATER key wins, as every http runtime does', () => {
        const folded = asHeaderKeysLowercased({
          headers: { Accept: 'text/xml', accept: 'application/json' },
        });

        expect(folded.accept).toEqual('application/json');
      });

      then('the bag holds ONE key, never two', () => {
        const folded = asHeaderKeysLowercased({
          headers: { Accept: 'text/xml', accept: 'application/json' },
        });

        expect(Object.keys(folded)).toEqual(['accept']);
      });
    });
  });

  /**
   * .why = an `undefined` VALUE is not an absent BAG, and the two must not be conflated: the
   *        declared type is `Record<string, string | undefined>`, so a present key with no value
   *        is representable and must survive the fold with its key intact
   */
  given('[case3] a present key whose value is undefined', () => {
    when('[t0] the fold runs', () => {
      then('the key survives, lowercased, with its undefined value', () => {
        const folded = asHeaderKeysLowercased({
          headers: { 'X-Trace': undefined },
        });

        expect(Object.keys(folded)).toEqual(['x-trace']);
        expect(folded['x-trace']).toEqual(undefined);
      });
    });
  });

  /**
   * .why = the fold must not INVENT keys. an empty bag in is an empty bag out — the arm that
   *        separates *"absent"* from *"empty"*, which `[case1]` alone cannot distinguish
   */
  given('[case4] an empty bag', () => {
    when('[t0] the fold runs', () => {
      then('it returns an empty bag, and not a fabricated one', () => {
        expect(asHeaderKeysLowercased({ headers: {} })).toEqual({});
      });
    });
  });
});
