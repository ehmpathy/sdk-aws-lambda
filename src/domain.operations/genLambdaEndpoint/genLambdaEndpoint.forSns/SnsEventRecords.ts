import type { SNSEvent, SNSEventRecord } from 'aws-lambda';

import type {
  RecordHeadersDeclared,
  RecordHeadersMerged,
  RecordHeadersOnwire,
} from '../record/RecordDecoded';

/**
 * .what = the header bag as sns carries it — one name per value, flattened from `MessageAttributes`
 * .why = `headers` names the metadata bag beside the body, in every family. sns calls it
 *        `MessageAttributes` and wraps each value as `{ Type, Value }`; the wrapper is a codec
 *        detail, so the bag is flat. the typed bag is at `_.raw.Sns.MessageAttributes`
 *        (`domain.terms/headers.md`)
 * .note = keys verbatim: sns attribute names are case-sensitive
 */
export type SnsHeadersOnwire = RecordHeadersOnwire;

/**
 * .what = the shape an author's `schema.input.headers` may name — the wire bag, or absent
 */
export type SnsHeadersDeclared = RecordHeadersDeclared;

/**
 * .what = the header bag a handler receives — the declared keys, beside every other attribute set
 */
export type SnsHeadersMerged<THeadersDeclared extends SnsHeadersDeclared> =
  RecordHeadersMerged<THeadersDeclared>;

/**
 * .what = the two slots a caller may constrain on one sns message
 */
export interface SnsRecordShape {
  headers: SnsHeadersOnwire;
  payload: unknown;
}

/**
 * .what = one sns message, with its body decoded and its attributes flattened
 * .why `SnsRecord` and not `SnsRecordDecoded` = `SnsEventDecoded` already names the schema face
 *        (`asLambdaEventSchema.fromSns`): the aws envelope with its message parsed. this is the
 *        endpoint face, the sdk's own `{ id, headers, payload, _ }` shape (F06)
 *
 * .note = `headers` and `payload` are the handler's projections of these slots — one object
 *         each, never a copy. that holds only because the validator replaces the values here
 */
export interface SnsRecord<TShape extends SnsRecordShape = SnsRecordShape> {
  /**
   * .what = the message's own identifier, as sns issued it
   * .why `id` and not `MessageId` = the sdk's word for a record's identifier in every record
   *        source. aws's wire name is `Sns.MessageId`
   */
  id: string;

  /**
   * .what = the message attributes the publisher set, flattened to one name per value
   * .note = validated against `schema.input.headers` where the author declared one
   */
  headers: TShape['headers'];

  /**
   * .what = the message — parsed, and validated by the time `invoke` runs
   * .note = the untouched wire string is at `_.raw.Sns.Message`, for a handler that must verify a
   *         signature over the exact bytes
   */
  payload: TShape['payload'];

  /**
   * .what = the ejection route — the vendor record, before this shape decoded it
   * .why = `Sns.TopicArn`, `Sns.Subject`, `Sns.Timestamp`, and the signature fields each live here
   */
  _: { raw: SNSEventRecord };
}

/**
 * .what = an sns invoke, with its record decoded
 * .why = `event` is the whole object that arrived, in every family. sns delivers one message per
 *        invoke, so `records` holds one — and `forSns` refuses any other count, loudly
 */
export interface SnsEventRecords<
  TShape extends SnsRecordShape = SnsRecordShape,
> {
  /**
   * .what = the messages this invoke carries; exactly one, under `forSns`
   * .why `records` and not `Records` = aws capitalizes it on the wire; this shape does not
   */
  records: SnsRecord<TShape>[];

  /**
   * .what = the ejection route — the wire form, before this shape decoded it
   */
  _: { raw: SNSEvent };
}
