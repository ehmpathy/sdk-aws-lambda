import { given, then, when } from 'test-fns';

import { getLambdaPayload } from '../../askLambdaEndpoint/serde/getLambdaPayload';
import { asFramedPayload } from '../../runLambdaEndpoint/serde/asFramedPayload';

/**
 * .what = clamps the invariant that the TWO contemp-frame emitters agree on the
 *         shape they emit, for the same input.
 * .why = 🔴 two hand-written emitters build the identical `{ event, trail }`
 *        frame — `getLambdaPayload` over the wire, `asFramedPayload` in-process
 *        — and no gate holds them in sync. a shared transformer would ripple
 *        into the shipped `askLambdaEndpoint` path (`rule.forbid.scope-leaks`),
 *        so this is the `rule.require.clamp-edge-cases` alternative: a
 *        cross-file agreement test that goes RED the day one diverges.
 *
 * .note = the two contracts differ on ONE axis — `getLambdaPayload` requires an
 *   exid, `asFramedPayload` allows it absent — so they are NOT merged. this test
 *   asserts agreement on the input where BOTH are defined: an exid-bearing frame,
 *   which is what a real contemp caller always sends.
 */
describe('contemp frame emitters agree', () => {
  given('an event and a trail that carries an exid', () => {
    const event = { surferId: 'srf_abc', spot: 'pipeline' };
    const trail = { exid: 'exid:00000000-0000-4000-8000-000000000000' };

    when('each contemp emitter frames it', () => {
      const fromWire = getLambdaPayload({ event, trail });
      const fromInProcess = asFramedPayload({
        event,
        trail,
        dialect: 'contemp',
      });

      then('they emit the identical frame shape', () => {
        expect(fromInProcess).toEqual(fromWire);
      });

      then('the frame is exactly { event, trail: { exid } }', () => {
        // 🔴 the clamp's teeth: both must carry the event and an exid-only trail,
        //    with no extra key on either. a new field added to one emitter and
        //    not the other reddens the toEqual above; a new field added to the
        //    EXPECTED shape here without both emitters carrying it reddens this.
        expect(fromWire).toEqual({ event, trail: { exid: trail.exid } });
        expect(fromInProcess).toEqual({ event, trail: { exid: trail.exid } });
      });
    });
  });
});
