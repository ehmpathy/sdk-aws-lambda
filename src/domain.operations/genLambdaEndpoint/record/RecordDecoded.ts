/**
 * .what = the header bag as a record source's wire carries it — one name per value, each a string or
 *         absent
 * .why = `headers` names the metadata bag that rides beside the body, in any transport that carries
 *        one. sqs calls it `messageAttributes`, sns `MessageAttributes`; same concept, same word
 *        (`domain.terms/headers.md`). kinesis carries none, so its records have no `headers` slot
 *
 * .note = keys are verbatim. sqs and sns attribute names are case-sensitive, so the api-gateway
 *         lowercase fold does not travel here
 */
export type RecordHeadersOnwire = Record<string, string | undefined>;

/**
 * .what = the shape an author's `schema.input.headers` may name — the wire bag, or absent
 * .why = the `headers` key is optional, so header enforcement is opt-in and no extant sender can be
 *        refused by a schema that never mentioned them (`rule.require.explicit-optout`)
 *
 * .note = bound rather than free, because the validator spreads the validated headers back over the
 *         wire bag: `{ ...'abc' }` yields `{ 0: 'a', 1: 'b', 2: 'c' }` — a char map under the name of
 *         a header bag. the bound is the only layer that refuses it
 */
export type RecordHeadersDeclared = RecordHeadersOnwire | undefined;

/**
 * .what = the header bag a handler receives — the declared keys, beside every other attribute set
 * .why = the validator writes headers back as a merge rather than a replace, so the emitted value
 *        carries both. a type of `THeadersDeclared` alone would regress the bag's open read
 *
 * .note = a conditional rather than a bare intersection: `RecordHeadersDeclared` admits `undefined`,
 *         and `undefined & Record<string, string | undefined>` reduces to `never`
 */
export type RecordHeadersMerged<
  THeadersDeclared extends RecordHeadersDeclared,
> = THeadersDeclared extends undefined
  ? RecordHeadersOnwire
  : RecordHeadersOnwire & THeadersDeclared;

/**
 * .what = one decoded record of any record source, as the shared leaves read it
 * .why = sqs, sns, and kinesis differ in how a record decodes, never in what the leaves do with one
 *        once decoded — validate it, refuse it, claim it by id. so the leaves read this shape, and
 *        each source's own decoded type is a subtype of it (`rule.forbid.parallel-codepaths`)
 *
 * .note = `headers` is optional because a kinesis record carries no metadata bag; it is absent
 *         rather than empty, so a kinesis handler is never handed a slot that can only be `{}`
 */
export interface RecordDecodedOfSource {
  /** the record's own identifier, as the source issued it — the value a batch answer names */
  id: string;
  /** the body, decoded, then validated in place */
  payload: unknown;
  /** the metadata bag, flattened; absent where the source carries none */
  headers?: RecordHeadersOnwire;
  /** the ejection route — the vendor record, before it was decoded */
  _: { raw: unknown };
}

/**
 * .what = one decoded invoke of any record source — every record it carries
 */
export interface EventDecodedOfSource<
  TRecord extends RecordDecodedOfSource = RecordDecodedOfSource,
> {
  records: TRecord[];
  _: { raw: unknown };
}
