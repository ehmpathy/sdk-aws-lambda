import type { SQSEvent, SQSRecord } from 'aws-lambda';

/**
 * .what = the header bag as the wire carries it — one name per value, each a string or absent
 * .why = `headers` names the metadata bag that rides beside the body, in any transport that
 *        carries one. sqs calls it `messageAttributes`; same concept, same word
 *        (`domain.terms/headers.md`)
 *
 * .note = flat, where aws wraps each value as `{ stringValue, dataType }`. the wrapper is a codec
 *         detail rather than a second dimension; the typed bag is at `_.raw.messageAttributes`
 * .note = a `Binary` attribute's `binaryValue` lands here under its own name. to carry only
 *         `stringValue` would make a binary attribute read as absent
 * .note = aws declares `stringListValues` / `binaryListValues` "Not implemented. Reserved for
 *         future use.", so neither is carried
 */
export type SqsHeadersOnwire = Record<string, string | undefined>;

/**
 * .what = the shape an author's `schema.input.headers` may name — the wire bag, or absent
 * .why = the `headers` key is optional, so header enforcement is opt-in and no extant sender can
 *        be refused by a schema that never mentioned them (`rule.require.explicit-optout`)
 *
 * .note = bound rather than free, because the validator spreads the validated headers back over
 *         the wire bag: `{ ...'abc' }` yields `{ 0: 'a', 1: 'b', 2: 'c' }` — a char map under the
 *         name of a header bag. the bound is the only layer that refuses it
 */
export type SqsHeadersDeclared = SqsHeadersOnwire | undefined;

/**
 * .what = the header bag a handler receives — the declared keys, beside every other attribute set
 * .why = the validator writes headers back as a merge rather than a replace, so the emitted value
 *        carries both. a type of `THeadersDeclared` alone would regress the bag's open read
 *
 * .note = a conditional rather than a bare intersection: `SqsHeadersDeclared` admits `undefined`,
 *         and `undefined & Record<string, string | undefined>` reduces to `never` — so the bare
 *         form would hand a `never` to every handler that omits the `headers` key
 * .note = clamped at the type level by `perRecord`'s `[case13]`, on both arms
 */
export type SqsHeadersMerged<THeadersDeclared extends SqsHeadersDeclared> =
  THeadersDeclared extends undefined
    ? SqsHeadersOnwire
    : SqsHeadersOnwire & THeadersDeclared;

/**
 * .what = the two slots a caller may constrain on one sqs record
 * .why = the validator writes the validated values back into the envelope, so the envelope's
 *        types must move with the caller's schema. without the parameter, `payload` could only be
 *        `unknown` and an `as`-cast would return at the `invoke` hand-off
 *
 * .note = the shape describes ONE record, in both variants. `perBatch` applies it N times rather
 *         than widen it, which is what lets one `schema.input` serve both
 */
export interface SqsRecordDecodedShape {
  headers: SqsHeadersOnwire;
  payload: unknown;
}

/**
 * .what = one sqs message, with its body decoded and its attributes flattened
 * .why `Decoded` and not `Unified` = `Unified` names a v1/v2 split reconciled, and sqs has no
 *        version axis — one wire shape serves every queue. `Decoded` names the state of the
 *        value: aws hands the body over as a string and the attributes inside a vendor wrapper
 *
 * .note = header keys are carried verbatim, where the api-gateway family lowercases them. rfc
 *         9110 §5.1 makes http field names case-insensitive; sqs attribute names are
 *         case-sensitive, so a fold here would merge two values the sender kept apart
 * .note = there is no `SqsEventOnwire` alias. sqs's wire form is a single vendor type, `SQSEvent`,
 *         already named; the api-gateway alias exists because its wire form is an unnamed union
 * .note = `headers` and `payload` are the handler's projections of these slots — one object each,
 *         never a copy. that holds only because the validator replaces the values here
 */
export interface SqsRecordDecoded<
  TShape extends SqsRecordDecodedShape = SqsRecordDecodedShape,
> {
  /**
   * .what = the message's own identifier, as sqs issued it
   * .why `id` and not `messageId` = the type already says `SqsRecord`, so `message` would restate
   *        a dimension the name carries. aws's wire name is `messageId`
   * .note = `perRecord` never reads it. `perBatch` returns
   *         `{ batchItemFailures: [{ itemIdentifier }] }`, and this is the value that goes in
   */
  id: string;

  /**
   * .what = the message attributes the sender set, flattened to one name per value
   * .note = keys are verbatim — sqs attribute names are case-sensitive
   * .note = validated against `schema.input.headers` where the author declared one; an absent key
   *         constrains naught
   */
  headers: TShape['headers'];

  /**
   * .what = the body — parsed, and validated by the time `logic` runs
   * .why = the sdk's word for the body in every family. an sqs message has a body, so it has a
   *        payload (`domain.terms/payload.md`)
   * .note = there is no unvalidated parsed body on this shape. the untouched wire string is at
   *         `_.raw.body`, for a handler that must verify a signature over the exact bytes
   */
  payload: TShape['payload'];

  /**
   * .what = the ejection route — the vendor record, before this shape decoded it
   * .why = `_` marks an escape hatch rather than a paved path. `receiptHandle`,
   *        `attributes.ApproximateReceiveCount`, `md5OfBody`, and the typed `messageAttributes`
   *        bag each live here
   * .note = the vendor record by identity, never a copy — clamped by `perRecord`'s `[case12]`. a
   *         copy is invisible to a field check and drops whatever field the next handler needs
   */
  _: { raw: SQSRecord };
}

/**
 * .what = an sqs invoke, with every record decoded
 * .why = `event` is the whole object that arrived, in every family. an sqs invoke carries N
 *        messages, so the whole object is the batch rather than one message of it
 *        (`domain.terms/event.md`)
 *
 * .note = the same shape for both variants. `perRecord` receives the whole event and refuses a
 *         batch of more than one, loudly — so `event.records.length` is a fact about the invoke
 *         rather than about the variant, and a handler that reads it reads the truth in both
 */
export interface SqsEventDecoded<
  TShape extends SqsRecordDecodedShape = SqsRecordDecodedShape,
> {
  /**
   * .what = the messages this invoke carries, in the order sqs delivered them
   * .why `records` and not `Records` = aws capitalizes it on the wire; this shape does not. the
   *        untouched bag is at `_.raw.Records`
   */
  records: SqsRecordDecoded<TShape>[];

  /**
   * .what = the ejection route — the wire form, before this shape decoded it
   */
  _: { raw: SQSEvent };
}
