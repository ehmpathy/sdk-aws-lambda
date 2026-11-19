import type {
  RecordDecodedOfSource,
  RecordHeadersOnwire,
} from './RecordDecoded';

/**
 * .what = the value a record's `schema.input` reads — `{ headers, payload }` where the source
 *         carries a header bag, `{ payload }` alone where it carries none
 * .why = a kinesis record has no metadata bag. to hand its schema `{ headers: undefined, payload }`
 *        would make a strict schema (`z.object({ payload }).strict()`) refuse every valid record as
 *        `Unrecognized key: "headers"` — and a refusal is acknowledged, so the shard would advance
 *        past good data with only a warn line (`rule.forbid.failhide`)
 *
 * .note = the fork reads observed data, never config: the `headers` slot is present on a record
 *         exactly when its source carries a bag (`rule.forbid.parallel-codepaths`, the
 *         observed-data row). the write-back in `setRecordValidated` forks on the same slot, so the
 *         read and the write cannot disagree
 */
export const asRecordSlots = (input: {
  record: RecordDecodedOfSource;
}): { headers?: RecordHeadersOnwire; payload: unknown } => {
  if (!('headers' in input.record)) return { payload: input.record.payload };
  return { headers: input.record.headers, payload: input.record.payload };
};
