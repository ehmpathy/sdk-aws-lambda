/**
 * .what = proves the INSTRUMENT that `local.dobjInput.acceptance.test.ts` reads — that
 *         `asArrivalName` reports the class a value arrived as, and DISCRIMINATES a coerced
 *         instance from the plain bag it came from
 * .why = that suite's every assertion is a string comparison against a class name. if the
 *        instrument reported the same string either way, all of its rows would be green on a
 *        tree where the coerce had stopped entirely (`rule.forbid.failhide`, at test grain)
 *
 * ⚠️ .why the instrument is proven HERE rather than there = the acceptance project's boot
 *        sources credentials (`jest.acceptance.env.ts:104`), so that suite cannot run without a
 *        browser SSO click a robot cannot make. this file runs under the UNIT project, which
 *        has no such gate — so the instrument's discrimination is MEASURED rather than argued,
 *        whatever the state of the credential (`rule.require.measure-the-value-you-emit`)
 *   ⇒ and the two are different subjects, so this is no duplicate of that suite: this grades
 *     the INSTRUMENT, and that grades how the contract at `src/index` is crossed
 */
import { given, then, when } from 'test-fns';

import {
  asArrivalName,
  dobjInputContractSchema,
  SurfSpot,
  Surfer,
} from './dobjInputHandler';

const surferOnWire = {
  uuid: 'u-1',
  handle: 'kai',
  home: { name: 'pipeline', breakType: 'reef' },
};

describe('asArrivalName', () => {
  given('[case1] a value that went through the declared input contract', () => {
    const parsed = dobjInputContractSchema.input.parse({
      surfer: surferOnWire,
      crew: [surferOnWire],
      signup: { spot: { name: 'mavericks', breakType: 'reef' }, note: 'dawn' },
    });

    when('[t0] each position is named', () => {
      then('the depth-0 dobj reports its class', () => {
        expect(asArrivalName({ value: parsed.surfer })).toEqual('Surfer');
      });

      then('the nested literal reports its class', () => {
        expect(asArrivalName({ value: parsed.surfer.home })).toEqual('SurfSpot');
      });

      then('an array element reports its class', () => {
        expect(asArrivalName({ value: parsed.crew[0] })).toEqual('Surfer');
      });

      then('a dobj under a PLAIN wrapper reports its class', () => {
        expect(asArrivalName({ value: parsed.signup?.spot })).toEqual(
          'SurfSpot',
        );
      });

      then('and a plain string peer reports String, not a dobj', () => {
        expect(asArrivalName({ value: parsed.signup?.note })).toEqual('String');
      });

      /**
       * .why the `instanceof` rows sit beside the name rows = a class NAME is a string, and two
       *      distinct classes could share one. the prototype check is the fact; the name is the
       *      projection of it that survives a serialize
       */
      then('and the names agree with the prototypes they project', () => {
        expect(parsed.surfer).toBeInstanceOf(Surfer);
        expect(parsed.surfer.home).toBeInstanceOf(SurfSpot);
      });
    });
  });

  given('[case2] the same wire bag, NEVER put through the contract', () => {
    when('[t0] it is named', () => {
      /**
       * ⚠️ .why this case IS the clamp = it is the state a tree would be in if the coerce
       *    regressed — the handler would receive exactly these bags. so this row measures that
       *    the instrument answers a DIFFERENT string in that state, which is what makes
       *    `[case1]`'s five rows capable of red at all
       */
      then('the depth-0 bag reports Object, never its would-be class', () => {
        expect(asArrivalName({ value: surferOnWire })).toEqual('Object');
      });

      then('and its nested bag reports Object too', () => {
        expect(asArrivalName({ value: surferOnWire.home })).toEqual('Object');
      });
    });
  });

  given('[case3] a value the prototype read cannot be taken on', () => {
    when('[t0] it is named', () => {
      /**
       * 🔴 .what this case FOUND on its first run = the instrument THREW.
       *    `Object.getPrototypeOf(undefined)` raises `TypeError: Cannot convert undefined or
       *    null to object` before any `?.` on its result can fire, so the draft's single
       *    `Object.getPrototypeOf(v)?.constructor?.name ?? …` line was wrong for two of the
       *    four states it claimed to cover
       *  ⇒ so an absent value would have turned a legible red row in the acceptance suite into
       *    a suite-level error, which reads as tooling rather than as a defect
       *
       * .why three labels = a prototype-LESS object and an ABSENT value are different states,
       *      and a shared label would let a reader of a red diff mistake one for the other
       */
      then('a prototype-less object is named rather than a throw', () => {
        expect(asArrivalName({ value: Object.create(null) })).toEqual('none');
      });

      then('an absent value is named rather than a throw', () => {
        expect(asArrivalName({ value: undefined })).toEqual('undefined');
      });

      then('and a null value is named apart from an absent one', () => {
        expect(asArrivalName({ value: null })).toEqual('null');
      });
    });
  });
});
