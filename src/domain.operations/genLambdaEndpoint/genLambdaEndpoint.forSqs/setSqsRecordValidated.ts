import type { ZodSchema } from 'zod';

import { getValidatedInput } from '../middleware/getValidatedInput';
import type {
  SqsHeadersDeclared,
  SqsHeadersMerged,
  SqsRecordDecoded,
} from './SqsEventDecoded';

/**
 * .what = validates one decoded record against `schema.input`, then writes the validated values
 *         back into it
 * .why = `payload` and `headers` are projections of the record's own slots, so a handler's bag
 *        and `record.payload` / `record.headers` are one object each. that holds only while this
 *        step replaces the record's values rather than parse beside them — a side bag would leave
 *        the record stale, silently (`domain.terms/headers.md`)
 *
 * .why one transformer for both variants = they differ in what they do with a failure, never in
 *        what counts as one. `perRecord` lets the throw escape, so the invoke fails and sqs
 *        redrives the message; `perBatch` catches it and reports that id as a batch item failure.
 *        a second implementation would let the two definitions of valid drift
 *        (`rule.forbid.parallel-codepaths`)
 *
 * .why it throws rather than returns a result = the validation error carries the zod issue
 *        summary, and a `{ ok, error }` return would make every caller restate the throw.
 *        `perBatch`, the one caller that must not propagate it, catches it at its own record
 *        boundary — which is where the disposition belongs
 *
 * .defect = LIVE, NOT FIXED — `getValidationError`'s strict-headers hint names api gateway, and
 *        one of its four clauses is false here: "api gateway injects keys you did not declare".
 *        sqs injects none, so `.strict()` on an sqs header schema is a legitimate choice the hint
 *        advises against
 *
 *        .proof it is live = `perRecord`'s `[case14]` asserts the api-gateway text, so the clamp
 *        is green while the defect is present. its green is never a statement that the message is
 *        right (`rule.require.deferred-defect-records-lead-with-status`)
 *
 *        .repair, unapplied = `getValidationError` takes the fact it needs from the family. left
 *        because it reaches a shared file with 3 production and 6 test call sites across two peer
 *        families — not clean to ride along (`rule.always.fix-forward-under-scouts-honor`).
 *        `[case14]`'s second assertion is inverted by that repair rather than deleted: an sqs
 *        author still owes a hint, and it must name sqs
 */
export const setSqsRecordValidated = <
  THeaders extends SqsHeadersDeclared,
  TPayload,
>(input: {
  record: SqsRecordDecoded;
  schema: ZodSchema<{ headers?: THeaders; payload: TPayload }>;
}): SqsRecordDecoded<{
  headers: SqsHeadersMerged<THeaders>;
  payload: TPayload;
}> => {
  const inputAfter = getValidatedInput({
    schema: input.schema,
    value: { headers: input.record.headers, payload: input.record.payload },
  });

  /**
   * .note = deliberate mutation — the record is the object the handler reads through both its own
   *         slot and the envelope's, so the validated value must land in it
   */

  /**
   * .what = headers merge. the author's schema governs the keys it declares; every other
   *         attribute the sender set survives untouched
   * .why = zod strips unknown keys, so a schema like `headers: z.object({ orderId })` yields a bag
   *        with only `orderId` — and a replace would silently delete every other attribute the
   *        producer set, with no error anywhere (`rule.forbid.failhide`)
   *
   * .note = the api-gateway twin merges for a different reason: there the merge is owed to vendors
   *         (`@middy/http-cors` reads `origin` out of that slot), where sqs has no such reader and
   *         the merge is owed to the sender (`rule.require.read-the-slot-a-dependency-reads`)
   * .note = the merge also absorbs the absent key: an author who declares no `headers` gets
   *         `result.data.headers === undefined`, and a spread of `undefined` is a no-op. so one
   *         rule serves both cases, and no branch is owed
   */
  input.record.headers = { ...input.record.headers, ...inputAfter.headers };

  /**
   * .what = payload replaces. the validated value takes the slot outright
   * .why = the body is wholly the handler's — no middleware and no vendor reads it — so the
   *        schema's output is the only value that belongs here (`domain.terms/payload.md`)
   */
  input.record.payload = inputAfter.payload;

  /**
   * .as = the record's slots now hold the validated values, which the parameterized shape
   *       states and `SqsRecordDecoded`'s default does not. the write-backs above are the
   *       proof, and typescript cannot track a mutation into a type parameter
   * .removal = drops if this returns a fresh object rather than mutates — which it cannot,
   *            since the projection rests on the mutation (see the note above)
   */
  return input.record as SqsRecordDecoded<{
    headers: SqsHeadersMerged<THeaders>;
    payload: TPayload;
  }>;
};
