import type { ZodSchema } from 'zod';

import { getRecordInputValidated } from './getRecordInputValidated';
import type {
  RecordDecodedOfSource,
  RecordHeadersDeclared,
} from './RecordDecoded';

/**
 * .what = validates one decoded record against `schema.input`, then writes the validated values
 *         back into it
 * .why = `payload` and `headers` are projections of the record's own slots, so a handler's bag
 *        and `record.payload` / `record.headers` are one object each. that holds only while this
 *        step replaces the record's values rather than parse beside them — a side bag would leave
 *        the record stale, silently (`domain.terms/headers.md`)
 *
 * .why one transformer for every record source and both cardinalities = they differ in what they
 *        do with a failure, never in what counts as one. a refusal is a caller fault, so each
 *        variant acknowledges it: a per-record variant catches it around the whole serve and
 *        returns; a per-batch variant catches it per record and leaves that id out of
 *        `batchItemFailures`. a second implementation would let the definitions of valid drift
 *        (`rule.forbid.parallel-codepaths`)
 *
 * .why it throws rather than returns a result = the validation error carries the zod issue
 *        summary, and a `{ ok, error }` return would make every caller restate the throw.
 *        each caller catches it at its own boundary, which is where the disposition belongs
 *
 * .defect = LIVE, NOT FIXED — `getValidationError`'s strict-headers hint names api gateway, and
 *        one of its four clauses is false here: "api gateway injects keys you did not declare".
 *        sqs and sns inject none, so `.strict()` on a record header schema is a legitimate choice
 *        the hint advises against
 *
 *        .proof it is live = `forSqs.perRecord`'s `[case14]` asserts the api-gateway text, so the
 *        clamp is green while the defect is present. its green is never a statement that the
 *        message is right (`rule.require.deferred-defect-records-lead-with-status`)
 *
 *        .repair, unapplied = `getValidationError` takes the fact it needs from the family. left
 *        because it reaches a shared file with 3 production and 6 test call sites across two peer
 *        families — not clean to ride along (`rule.always.fix-forward-under-scouts-honor`).
 *        `[case14]`'s second assertion is inverted by that repair rather than deleted: a record
 *        author still owes a hint, and it must name the source
 */
export const setRecordValidated = <
  TRecord extends RecordDecodedOfSource,
  THeaders extends RecordHeadersDeclared,
  TPayload,
>(input: {
  record: TRecord;
  schema: ZodSchema<{ headers?: THeaders; payload: TPayload }>;
  deserialize: { payload: boolean };
}): TRecord => {
  // a header-less record hands its schema `{ payload }` alone, so a strict schema still passes
  const inputAfter = getRecordInputValidated({
    record: input.record,
    schema: input.schema,
    deserialize: input.deserialize,
  });

  /**
   * .note = deliberate mutation — the record is the object the handler reads through both its own
   *         slot and the envelope's, so the validated value must land in it
   */

  /**
   * .what = headers merge, on a record whose source carries a header bag. the author's schema
   *         governs the keys it declares; every other attribute the sender set survives untouched
   * .why = zod strips unknown keys, so a schema like `headers: z.object({ orderId })` yields a bag
   *        with only `orderId` — and a replace would silently delete every other attribute the
   *        producer set, with no error anywhere (`rule.forbid.failhide`)
   *
   * .why the `in` check = a fork on observed data, never on config: a kinesis record has no
   *        metadata bag, so it carries no `headers` slot, and one must not appear on it
   *        (`rule.forbid.parallel-codepaths`, the observed-data row)
   * .note = the merge also absorbs the absent key: an author who declares no `headers` gets
   *         `result.data.headers === undefined`, and a spread of `undefined` is a no-op. so one
   *         rule serves both cases, and no branch is owed for it
   */
  if ('headers' in input.record)
    input.record.headers = { ...input.record.headers, ...inputAfter.headers };

  /**
   * .what = payload replaces. the validated value takes the slot outright
   * .why = the body is wholly the handler's — no middleware and no vendor reads it — so the
   *        schema's output is the only value that belongs here (`domain.terms/payload.md`)
   */
  input.record.payload = inputAfter.payload;

  /**
   * .note = the record's slots now hold the validated values. each caller narrows the type of the
   *         envelope that holds them, since typescript cannot track a mutation into a type
   *         parameter, and the narrowed envelope is what reaches the handler
   */
  return input.record;
};
