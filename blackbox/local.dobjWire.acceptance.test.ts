/**
 * .what = proves a domain-object at the OUTPUT border reaches the wire as the same bytes a
 *         plain prop bag would have produced
 * .why = `surfboardContractHandler.ts` is DEPLOYED, and this branch changed its `invoke` from a
 *        prop bag to `new SeaturtleSurfboard(...)`. the note there claimed the wire was
 *        unchanged and therefore claimed no redeploy was owed — a claim about bytes THIS repo
 *        emits, and it was reasoned rather than run (`rule.require.measure-the-value-you-emit`)
 *
 * .grain = `local.*`, so the action crosses the contract at `src/index` — this fixture's handler
 *          IS `genLambdaEndpoint`'s own return, invoked with AWS's `(event, context)` signature —
 *          and it proves no property of the AWS TRANSPORT (`define.blackbox-suite-grains`)
 *    .the deployed twins this wire claim leans on, NAMED so a reviewer can check them rather
 *          than take them: the same `surfboardContractHandler` fixture is driven through real AWS
 *          by `deployed.awsLambda`, `deployed.codegen`, and `deployed.codegen.refs`
 *    ⚠️ .and those twins are CREDENTIAL-GATED, so in a local gate this suite's green is the only
 *          signal available. that is a bound on what a local run proves, never a claim that the
 *          transport was checked
 *
 * ⚠️ .what the RUN found that two rounds of prose did not = `withImmute` attaches an own
 *         `clone` property to the coerced value, so `Object.getOwnPropertyNames` carries it.
 *         TWO independent facts keep it off the wire, and EITHER ALONE would suffice:
 *
 *           1. it is declared `enumerable: false` (`withImmute.js:15-20`)
 *           2. its value is a FUNCTION, and `JSON.stringify` drops function values outright
 *
 *         ⇒ measured by revert: flip that dist line to `enumerable: true` and `[case2]` goes
 *           RED while `[case1]` stays GREEN — because guard 2 still holds. so the enumerable
 *           flag is NOT the load-bearing fact, though two drafts of the note said it was
 *
 * ⚠️ .why both cases stay = they clamp different grains, and the weaker one is the early warn.
 *         `[case1]` is the real clamp on the wire claim: it goes red only if the bytes actually
 *         move. `[case2]` pins the third-party shape, so it goes red on a change that is
 *         currently harmless — a signal that `domain-objects` moved under us, ahead of the day
 *         a second change makes it reach the wire
 */
import { given, then, useThen, when } from 'test-fns';

import {
  handler,
  SeaturtleSurfboard,
  surfboardContractSchema,
} from './__test_assets__/surfboardContractHandler';
import { invokeHandlerForTest } from '../src/__test_assets__/invokeHandlerForTest';

/** .what = the prop bag this fixture returned before the migration to an instance */
const surfboardBag = {
  uuid: 'u-1',
  brand: 'seaturtle',
  length: { inches: 108 },
};

describe('a domain object at the output border reaches the wire as a plain bag', () => {
  given(
    '[case1] the DEPLOYED fixture, whose invoke now hands back an instance',
    () => {
      /**
       * ⚠️ .why the serialize happens in each `then` rather than in the `useThen` = `useThen`
       *         hands back a PROXY, and a proxy over a primitive string fails deep equality —
       *         jest reads it as an indexed object (`{"0":"{","1":"\"", …}`). so the shared
       *         value must stay an object, and the stringify has to sit at the assertion
       */
      const result = useThen('it resolves', async () =>
        invokeHandlerForTest(handler, { event: { uuid: 'u-1' } }),
      );

      when('[t0] the handler is invoked and its return is serialized', () => {
        then('the bytes equal what the prop bag would have produced', () => {
          expect(JSON.stringify(result)).toEqual(
            JSON.stringify({ surfboard: surfboardBag }),
          );
        });

        /**
         * .why a SNAPSHOT beside the equality = the equality proves the two agree; it says not
         *      one word about WHAT they agree on. a snapshot shows the reviewer the actual
         *      bytes, so a change that moves both sides together still surfaces in a diff
         */
        then('and the whole payload a caller receives is snapped', () => {
          expect(JSON.stringify(result)).toMatchSnapshot();
        });
      });
    },
  );

  given('[case2] the domain-objects property the no-redeploy claim rests on', () => {
    /**
     * .note = this parses through the handler's OWN declared output schema, which is what
     *         `getValidatedOutput` does — so this is the value that actually reaches the wire,
     *         never the value `invoke` returned
     */
    const coerced = surfboardContractSchema.output.parse({
      surfboard: new SeaturtleSurfboard(surfboardBag),
    }).surfboard as object;

    when('[t0] the coerced value is inspected', () => {
      then('`clone` IS an own property — the step the prose skipped', () => {
        expect(Object.getOwnPropertyNames(coerced)).toContain('clone');
      });

      then('guard 1 — it is declared non-enumerable', () => {
        expect(Object.keys(coerced)).not.toContain('clone');
        expect(
          Object.getOwnPropertyDescriptor(coerced, 'clone')?.enumerable,
        ).toBe(false);
      });

      /**
       * ⚠️ .why THIS row is the load-bearing one = guard 1 is the fact both drafts of the note
       *         named, and the revert proved it is not what keeps the bytes clean. flip
       *         `enumerable` to true upstream and the wire is UNCHANGED, because a function
       *         value never survives `JSON.stringify` whatever its flags say
       */
      then('guard 2 — and its value is a function, which JSON drops outright', () => {
        expect(typeof (coerced as { clone: unknown }).clone).toEqual('function');
        expect(JSON.stringify({ f: () => undefined })).toEqual('{}');
      });

      then('so the enumerable keys are exactly the declared fields', () => {
        expect(Object.keys(coerced).sort()).toEqual([
          'brand',
          'length',
          'uuid',
        ]);
      });
    });
  });
});
