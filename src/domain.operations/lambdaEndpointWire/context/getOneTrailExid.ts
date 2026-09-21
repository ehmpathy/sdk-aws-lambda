import type { ContextLogTrail } from 'sdk-logs';

import { getExidFromContext } from './getExidFromContext';
import { getLogForExidExtraction } from './getLogForExidExtraction';

/**
 * .what = gets the caller's trail exid, and reports when one had to be generated
 * .why = every caller that addresses an endpoint owes BOTH halves, and the second
 *        half is the one that gets dropped
 *
 * 🔴 **this exists because the two halves were a stated PARITY REQUIREMENT rather
 *    than a structural one.** `getExidFromContext` deliberately emits no log of
 *    its own — it returns `source` so each caller may report the fallback (see
 *    its docblock). that design is right, and it means every caller must
 *    remember to act on `source` — an obligation a reader cannot catch
 *    themselves miss.
 *
 * ⚠️ **and a caller that forgets diverges on an OBSERVABLE, with no test to
 *    catch it:**
 *
 * | if `source` were dropped at one locus | a caller who sent no trail exid sees |
 * |---|---|
 * | the locus that reports | `trail.exid.generated` on the debug log |
 * | the locus that forgot | silence |
 *
 * ⇒ a migrant who omitted the trail would meet a clean run at one locus and a log
 *   full of the warn at the other — the exact surprise the locus-parity design
 *   exists to prevent, and no assertion anywhere would go red.
 *
 * ✅ **so the parity is now held by the CALL, never by a comment.** both callers
 *   invoke this one operation, so a change to the report reaches both at once and
 *   neither can drift from the other.
 *
 * .note = the debug emission is the sdk's own diagnostic. no payload, no output
 *   type, and no error stance moves with it, so this is observable to an operator
 *   and invisible to the wire.
 */
export const getOneTrailExid = (input: {
  log: ContextLogTrail['log'];
}): string => {
  const { exid, source } = getExidFromContext({
    log: getLogForExidExtraction({ log: input.log }),
  });

  // report the fallback, so a caller that did not propagate a trail can see why
  // their traces do not join up
  if (source === 'generated') {
    input.log.debug('trail.exid.generated', {
      exid,
      note: 'no trail exid in context, generated new one',
    });
  }

  return exid;
};
