/**
 * .what = proves, at acceptance grain, that a domain object declared at a handler's INPUT
 *         border reaches `invoke` as a real instance — and that a value the domain object
 *         refuses is answered LOUD at the border instead
 * .why = those are the wish's two `.acceptance` lines for the input side, and until this suite
 *        they had UNIT coverage only. every extant blackbox fixture places its dobjs at the
 *        OUTPUT border, so the headline capability crossed `src/index` nowhere
 *        (`rule.require.test-coverage-by-grain` — a contract owes an acceptance test)
 *
 * .grain = `local.*`, so the action crosses the contract at `src/index` — the fixture's handler
 *          IS `genLambdaEndpoint`'s own return, invoked with AWS's `(event, context)` signature
 *          (`define.blackbox-suite-grains`)
 *    .why it owes NO `deployed.*` twin = neither claim is a property of the AWS transport. the
 *          coerce runs inside the middleware chain and the refusal is authored by this sdk, so a
 *          real lambda adds no fact either one depends on
 *
 * ⚠️ .why this sits beside `local.dobjWire` rather than inside it = that suite's subject is the
 *        OUTPUT border — it asks whether a coerced instance reaches the wire as the same bytes a
 *        bag would. this asks the INPUT question, which is a different border and a different
 *        mechanism (`getValidatedInput`, not `getValidatedOutput`). one file, one subject
 *        (`rule.require.place-a-passage-by-its-subject`)
 *
 * 🔴 ⚠️ .why every row here is a WHOLE-VALUE assertion and NOT a `toMatchSnapshot` — the one
 *        place this suite departs from every peer in `blackbox/`:
 *
 *        this project's boot sources credentials (`jest.acceptance.env.ts:104`), and
 *        `ehmpathy.test.AWS_PROFILE` needs a browser SSO click a robot cannot make. so this
 *        suite could be WRITTEN and type-checked and NOT RUN, which means no `.snap` could be
 *        recorded for it.
 *
 *        an unrecorded snapshot is not a neutral omission — it is a RED CI RUN. measured, in
 *        this tree's own dependency: `jest-config/build/index.js:60` reads `ci: ciInfo().isCI`,
 *        so on a box where `CI=true` jest refuses to write a new snapshot and fails the test
 *        instead. a snapshot row added here would therefore ship a suite that is green nowhere
 *        and red in CI (`rule.require.measure-the-value-you-emit` — read, then measured)
 *
 *   ⇒ so each row asserts the WHOLE value rather than a picked field. that is strictly stronger
 *     than the snapshot it replaces on the one axis `r9` raised — a whole-value `toEqual` fails
 *     on an ADDED key, which is exactly what an instance check cannot see — and it puts the
 *     expected bytes on the page, where a reviewer reads them without a second file
 *
 *   .and each expected value is GROUNDED IN A RUN rather than guessed:
 *      — the five `arrivedAs` strings are measured by `__test_assets__/dobjInputHandler.test.ts`,
 *        which runs under the UNIT project and has no credential gate
 *      — the refusal's key set is measured by `forAskEndpoint.test.ts [case11][t1]`, whose
 *        recorded snapshot carries exactly `details` / `errorMessage` / `errorType` for this
 *        same family, this same middleware, and this same malformed shape
 */
import { given, then, useThen, when } from 'test-fns';

import {
  dobjInputContractSchema,
  handler,
} from './__test_assets__/dobjInputHandler';
import { invokeHandlerForTest } from '../src/__test_assets__/invokeHandlerForTest';

/** .what = the wire shape a caller sends — plain objects, at every depth */
const payloadOnWire = {
  surfer: {
    uuid: 'u-1',
    handle: 'kai',
    home: { name: 'pipeline', breakType: 'reef' },
  },
  crew: [
    {
      uuid: 'u-2',
      handle: 'moana',
      home: { name: 'trestles', breakType: 'point' },
    },
  ],
  signup: { spot: { name: 'mavericks', breakType: 'reef' }, note: 'dawn' },
};

describe('a domain object at the input border arrives coerced, or is refused loud', () => {
  given('[case1] the wire shape a caller actually sends', () => {
    const result = useThen('the handler answers', async () =>
      invokeHandlerForTest(handler, { event: payloadOnWire }),
    );

    when('[t0] the handler is invoked through its public contract', () => {
      then('the depth-0 position arrived as a real instance', () => {
        expect(result.arrivedAs.surfer).toEqual('Surfer');
      });

      then('the nested literal arrived as an instance too', () => {
        expect(result.arrivedAs.surferHome).toEqual('SurfSpot');
      });

      then('every element of the array arrived as an instance', () => {
        expect(result.arrivedAs.crewFirst).toEqual('Surfer');
      });

      then('a dobj under a PLAIN wrapper arrived as an instance', () => {
        expect(result.arrivedAs.signupSpot).toEqual('SurfSpot');
      });

      /**
       * ⚠️ .why a plain peer is asserted beside the four above = the four prove the coerce
       *    REACHES each dobj position and say not one word about whether it stopped there. a
       *    coerce that swept the whole input would leave all four green while it rebuilt
       *    values that were never declared as domain objects
       */
      then('and the plain peer beside it stayed plain', () => {
        expect(result.arrivedAs.note).toEqual('String');
      });

      /**
       * ⚠️ .why this row sits beside the five above = every one of them reads ONE key, and no
       *    single-key read can see a key that was ADDED. this reads the whole value, so a
       *    response that grew a field fails here while the five stay green
       */
      then('and the whole payload a caller receives is exactly this', () => {
        expect(result).toEqual({
          arrivedAs: {
            surfer: 'Surfer',
            surferHome: 'SurfSpot',
            crewFirst: 'Surfer',
            signupSpot: 'SurfSpot',
            note: 'String',
          },
        });
      });
    });
  });

  given('[case2] a value the domain object itself refuses', () => {
    /**
     * ⚠️ .why this payload travels through a JSON round-trip = the compiler REFUSES a malformed
     *    literal here, and that refusal is itself a result of this round's type repair —
     *    `genLambdaEndpoint` takes the WIRE face, so `home: {}` fails to satisfy `SurfSpot`. but
     *    AWS never type-checks an invocation; it hands the handler whatever bytes a caller sent.
     *    so the suite must reproduce that delivery rather than dodge the compiler with a cast
     *    (`rule.forbid.as-cast` — no cast is written; the untyped boundary is REAL here)
     */
    const payloadMalformed = JSON.parse(
      JSON.stringify({
        ...payloadOnWire,
        surfer: { uuid: 'u-1', handle: 'kai', home: {} },
      }),
    );

    const result = useThen(
      'the handler answers — it does NOT throw',
      async () => invokeHandlerForTest(handler, { event: payloadMalformed }),
    );

    when('[t0] the handler is invoked through its public contract', () => {
      /**
       * .why the verdict is a RESOLVED payload rather than a throw = a caller fault in this
       *      family makes the lambda SUCCEED and answer an error object, so AWS records no
       *      `FunctionError` and no retry fires (`invariant.badrequesterror-not-lambda-error`)
       */
      then('the caller fault is answered, never thrown', () => {
        expect(result).toMatchObject({ errorType: 'BadRequestError' });
      });

      /**
       * ⚠️ .why THIS row is the positive control for the whole suite = `[case1]` proves the
       *    response carries `arrivedAs` when `invoke` runs. its absence here is the only
       *    blackbox-visible evidence that `invoke` produced no result at all — a closure flag
       *    is not a byte, so this grain cannot observe it any other way
       */
      then('and invoke produced no result — no `arrivedAs` on the wire', () => {
        expect(result).not.toHaveProperty('arrivedAs');
      });

      /**
       * .why the PATH is asserted by name = the wish asks that a refusal fail LOUD. a bare
       *      `BadRequestError` proves the refusal and tells the caller no useful fact about
       *      WHERE they went wrong (`rule.require.errors-name-the-fix`)
       */
      then('and the refusal names the exact path that failed', () => {
        expect(JSON.stringify(result)).toContain('surfer.home.name');
        expect(JSON.stringify(result)).toContain('surfer.home.breakType');
      });

      /**
       * ⚠️ .why the KEY SET is asserted whole = the three rows above each read one fact, so a
       *    refusal that grew a field — a stack trace, an internal id — would pass all three.
       *    the key set is the denylist half a snapshot would have carried
       *  .grounded in = `forAskEndpoint.test.ts [case11][t1]`'s recorded snapshot, which is this
       *    same family and this same malformed shape, and carries exactly these three
       */
      then('and the refusal carries exactly the declared keys', () => {
        expect(Object.keys(result).sort()).toEqual([
          'details',
          'errorMessage',
          'errorType',
        ]);
      });
    });
  });

  given('[case3] the published contract this suite drives', () => {
    when('[t0] the declared input schema is read', () => {
      /**
       * ⚠️ .why this case exists = it is a DIFFERENTIAL, never extra coverage. `[case1]` already
       *    catches a schema that drops `Surfer.contract()` — the coerce would not run,
       *    `arrivedAs.surfer` would read `Object`, and `[case1][t0]` would go RED. so this case
       *    adds no scenario `[case1]` cannot see
       *
       *  ⇒ what it adds is WHICH LAYER broke, read off the pair rather than from a bisect. it
       *    parses the schema DIRECTLY — no handler, no middleware chain, no wire between:
       *      — `[case1]` red + this red   -> the SCHEMA dropped its dobj declaration
       *      — `[case1]` red + this green -> the schema is intact; the MIDDLEWARE dropped the coerce
       *
       *  .why that is worth a case = the two causes live in different repos. the first is this
       *    fixture's own declaration; the second is `getValidatedInput`, or `X.contract()` in
       *    `domain-objects` beneath it. a red `[case1]` alone names neither
       */
      then('the input positions really do carry domain-object contracts', () => {
        const parsed = dobjInputContractSchema.input.parse(payloadOnWire);
        expect(Object.getPrototypeOf(parsed.surfer).constructor.name).toEqual(
          'Surfer',
        );
      });
    });
  });
});
