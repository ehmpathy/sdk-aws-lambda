import { MalfunctionError } from 'helpful-errors';
import type { ZodType } from 'zod';

import {
  asZodIssuesMessage,
  getZodIssuesSummary,
  type ZodIssueSummary,
} from './getZodIssuesSummary';

export interface OutputValidationErrorMetadata {
  issues: ZodIssueSummary[];
  hint: string;
}

/**
 * .what = the FIX half of the message a HANDLER AUTHOR meets when their own return is refused
 * .why = `rule.require.errors-name-the-fix` asks for what, why, and the concrete next move. the
 *        zod summary supplies the first two; the third has to name an act the reader can perform
 *
 * ⚠️ .why it names a DIFFERENT fix than the input border = the audience inverts. an input
 *         failure is the CALLER's to fix, so its hint tells them what to send. an output failure
 *         is the HANDLER's to fix, and the caller has no move available at all — which is why
 *         this throws `MalfunctionError` where the input border throws `ConstraintError`
 *         (invariant.badrequesterror-not-lambda-error)
 *
 * 🔴 .why the constructor is named as a FACT rather than as the FIX = a prior draft of this hint
 *        read *"hand back the INSTANCE (`new X({ … })`) rather than a plain object"*, on the
 *        premise that `X.contract()` refuses a prop bag here. **that premise is measured FALSE.**
 *
 *          - `X.contract()` COERCES, so a bag whose fields are correct PARSES and is handed back
 *            as an instance. the shape a handler returns is a TYPE-level contract, never a
 *            runtime gate, and the compiler enforces it unevenly — it demands the instance only
 *            where a union in the schema blocks inference of `TOutput` from the `invoke` return
 *          - ⇒ so bag-vs-instance is ORTHOGONAL to pass-vs-fail, and the DATA is what decides.
 *            a bag with a field absent throws HERE; `new X({ … })` built from that same data
 *            throws EARLIER, at construction, on the identical path
 *          - ⇒ a hint that names the constructor therefore names a move that does not fix the
 *            failure it is attached to, which is the defect `rule.require.errors-name-the-fix`
 *            exists to prevent
 */
const OUTPUT_VALIDATION_HINT =
  'the handler returned a value its own declared output schema refuses — correct each path named in `issues`. ⚠️ a plain object is NOT the cause: `X.contract()` coerces, so a bag whose fields are correct parses here. `new X({ … })` is the TYPE-level contract, and it checks these same paths at construction instead';

/**
 * .what = validates output against schema and returns typed result
 * .why = named transformer for decode-friction-free validation in orchestrators
 *
 * .note = this is the ONE output-side validator, and BOTH families call it DIRECTLY —
 *         `forAskEndpoint.ts:125` and `forApiGateway.ts:274`. so a repair here lands at both
 *         borders at once, exactly as `getValidatedInput` does on the input side
 *
 * ⚠️ .why NOT through `genZodOutputValidationMiddleware` = that export wraps this function for a
 *         consumer who composes their own chain, and no shipped chain registers it. each family
 *         validates inline because each knows which of two shapes it holds at that moment and the
 *         middleware cannot (its own `.note` states the same, as does the readme)
 *
 * 🟡 .why the parameter is `response` where its input-border twin takes `value` = the asymmetry
 *         is motivated, not an oversight, and it was raised as a nitpick at i018:
 *
 *           - at THIS border the value has exactly one home, in both families and in the
 *             readme's own consumer example: `response: request.response`. the name states
 *             the slot, so the call site reads as an identity
 *           - at the INPUT border it has TWO homes — `forAskEndpoint` hands `request.event`
 *             whole, `forApiGateway` hands `event.body`, because its `request.event` must
 *             stay http-shaped for `@middy/http-cors`. no slot name is true of both, so
 *             `value` is the honest neutral there rather than a claim about position
 *             (rule.prefer.names-by-position-over-claim)
 *
 *         ⇒ ⛔ the plan that used to sit here is VOID: it deferred the rename to *"F35's
 *           resolution, which forces a shared `parseOrThrow` primitive"*. F35 was ruled
 *           2026-09-21 as NO REPAIR OWED, so no such extraction will arrive and no future
 *           edit will carry this rename for free
 *
 *         ⇒ the divergence therefore stands on its own merits, which are the two bullets
 *           above and are sufficient: one border has a true slot name, the other has two
 *           homes and no name true of both. ⇒ this is a settled asymmetry, never a debt
 */
export const getValidatedOutput = <TOutput>(input: {
  response: unknown;
  schema: ZodType<TOutput>;
}): TOutput => {
  const result = input.schema.safeParse(input.response);
  if (!result.success) {
    const issues = getZodIssuesSummary({ issues: result.error.issues });
    throw new MalfunctionError<OutputValidationErrorMetadata>(
      `output validation failed: ${asZodIssuesMessage({ issues })}`,
      { issues, hint: OUTPUT_VALIDATION_HINT },
    );
  }
  return result.data;
};
