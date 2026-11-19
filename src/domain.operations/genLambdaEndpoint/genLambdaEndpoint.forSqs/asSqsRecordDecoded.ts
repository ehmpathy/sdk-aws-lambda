import type { SQSRecord } from 'aws-lambda';

import {
  asRecordBodyParsed,
  DESERIALIZE_DEFAULT,
} from '../record/asRecordBodyParsed';
import { asSqsHeadersOnwire } from './asSqsHeadersOnwire';
import type { SqsRecordDecoded } from './SqsEventDecoded';

/**
 * .what = decodes one sqs message into the shape a handler reads
 * .note = sqs's body is always a utf-8 string, with no `isBase64Encoded` flag; binary rides in a
 *         message attribute with its own `dataType`. so the body goes to the shared parse as is
 * .why = the two variants differ in how they hand over records, never in how a record is decoded,
 *        so one transformer serves both and a new slot lands in one place
 *        (`rule.forbid.parallel-codepaths`)
 */
export const asSqsRecordDecoded = (
  input: { wire: SQSRecord },
  options?: { deserialize: { payload: boolean } },
): SqsRecordDecoded => {
  const deserialize = options?.deserialize ?? DESERIALIZE_DEFAULT;

  return {
    id: input.wire.messageId,

    /**
     * .what = the attributes the sender set, one name per value, keys VERBATIM
     * .note = sqs attribute names are case-sensitive, so the api-gateway case-fold does not
     *         travel here — see `asSqsHeadersOnwire`
     */
    headers: asSqsHeadersOnwire({
      messageAttributes: input.wire.messageAttributes,
    }),

    /**
     * .what = the body, parsed. VALIDATED later, in place — the input validator replaces this
     *         slot with the schema's output before `logic` runs
     * .why = so `payload` is the validated value at the only moment a handler can read it,
     *        which is what lets its type state the caller's shape over `unknown`
     */
    payload: deserialize.payload
      ? asRecordBodyParsed({ body: input.wire.body })
      : input.wire.body,

    _: { raw: input.wire },
  };
};
