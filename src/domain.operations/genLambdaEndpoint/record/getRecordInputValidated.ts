import { ConstraintError } from 'helpful-errors';
import type { ZodSchema } from 'zod';

import { getValidatedInput } from '../middleware/getValidatedInput';
import type { ZodIssueSummary } from '../middleware/getZodIssuesSummary';
import { asRecordSlots } from './asRecordSlots';
import type { RecordDecodedOfSource } from './RecordDecoded';

/**
 * .what = the fix a refusal names when the payload reached the schema as text under the json default
 * .why = the common cause is a text stream wired with the json default. `asRecordBodyParsed` hands a
 *        non-json body through as its string, so the schema's own issue reads "expected object,
 *        received string" and names no move. this names it (`rule.require.errors-name-the-fix`)
 * .note = the same fix the schema face names (`asLambdaEventPayloadSchema`), in the record family's words
 * .note = it opens with `fix:`, the marker `getValidationError` reads as an issue that names its own fix
 */
const HINT_PAYLOAD_TEXT =
  'fix: the payload reached the schema as text, since the body is not json (or is a json string). for a text source, set `deserialize: { payload: false }` and declare a text payload schema';

/**
 * .what = whether a refusal names an issue at the payload slot
 * .why = the text-payload fix answers only a payload issue. a record whose payload passed and whose
 *        header failed would otherwise be told to flip `deserialize`, a move that breaks the json
 *        bodies and leaves the header fault in place
 */
const getIsPayloadRefusal = (input: { error: ConstraintError }): boolean => {
  const issues: unknown = input.error.metadata?.issues;
  if (!Array.isArray(issues)) return false;
  return issues.some((issue: Pick<ZodIssueSummary, 'path'>) => {
    const path = String(issue?.path ?? '');
    return path === 'payload' || path.startsWith('payload.');
  });
};

/**
 * .what = validates one record's `{ headers?, payload }` slots against the author's schema
 * .why = the shared root primitive `getValidatedInput` judges the value; this adds the one
 *        refusal whose fix only the record family can name — a text body on the json default
 *
 * .why it forks on the payload's observed type, never on the issue text = a string payload under
 *        `deserialize.payload = true` can only be a body the json parse refused (or a json string
 *        literal), so the fact is in the data (`rule.forbid.parallel-codepaths`, the observed-data row)
 * .note = under `deserialize.payload = false` every payload is a string by design, so the hint
 *         stays off there; that mis-pair is the reverse one, clamped by the `forSqs.perRecord` text-schema-on-json case
 */
export const getRecordInputValidated = <TInput>(input: {
  record: RecordDecodedOfSource;
  schema: ZodSchema<TInput>;
  deserialize: { payload: boolean };
}): TInput => {
  const isPayloadText =
    input.deserialize.payload && typeof input.record.payload === 'string';

  try {
    return getValidatedInput({
      schema: input.schema,
      value: asRecordSlots({ record: input.record }),
    });
  } catch (error) {
    /**
     * .what = allowlists the one refusal this step names a fix for, and rethrows every other
     * .why = a bare rethrow-with-hint would relabel a real defect as a caller fault (`rule.forbid.failhide`)
     */
    if (!(error instanceof ConstraintError)) throw error;
    if (!isPayloadText) throw error;
    if (!getIsPayloadRefusal({ error })) throw error;

    // the same class, issues, and caller-fault disposition; the message now leads with the fix
    throw new ConstraintError(`validation failed: ${HINT_PAYLOAD_TEXT}`, {
      issues: error.metadata?.issues ?? null,
      hint: HINT_PAYLOAD_TEXT,
      cause: error,
    });
  }
};
