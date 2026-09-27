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
 * .note = this is the ONE output-side validator, and the two families that answer a caller —
 *         `forAsk` and `forApiGateway` — call it DIRECTLY in their `logic`. so a repair here lands
 *         at both borders at once, as `getValidatedInput` does on the input side
 *
 * .why NOT through `genZodOutputValidationMiddleware` = that export wraps this function for a
 *         consumer who composes their own chain; no shipped chain registers it
 *
 * .why the parameter is `response` where its input twin takes `value` = at THIS border the value
 *         has one home — `request.response` — so the name states the slot. at the input border
 *         each family hands a different value, so `value` is the neutral name there
 *         (rule.prefer.names-by-position-over-claim)
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
