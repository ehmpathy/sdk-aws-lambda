import type { SNSEvent, SNSEventRecord } from 'aws-lambda';
import { MalfunctionError } from 'helpful-errors';

import {
  asRecordBodyParsed,
  DESERIALIZE_DEFAULT,
} from '../record/asRecordBodyParsed';
import { asSnsHeadersOnwire } from './asSnsHeadersOnwire';
import { getIsSnsEvent } from './getIsSnsEvent';
import type { SnsEventRecords, SnsRecord } from './SnsEventRecords';

/**
 * .what = decodes one sns record into the shape a handler reads
 * .why = the endpoint reads one record shape for every source, so each sns slot maps to it here,
 *        once: `MessageId` → `id`, `MessageAttributes` → `headers`, `Message` → `payload`
 */
const asSnsRecord = (
  input: { wire: SNSEventRecord },
  options: { deserialize: { payload: boolean } },
): SnsRecord => ({
  id: input.wire.Sns.MessageId,
  headers: asSnsHeadersOnwire({
    messageAttributes: input.wire.Sns.MessageAttributes ?? null,
  }),

  /**
   * .what = the message, parsed. validated later, in place, before `invoke` runs
   * .note = sns's message is a utf-8 string with no encode flag, so it goes to the parse as is
   */
  payload: options.deserialize.payload
    ? asRecordBodyParsed({ body: input.wire.Sns.Message })
    : input.wire.Sns.Message,

  _: { raw: input.wire },
});

/**
 * .what = decodes an sns invoke into the shape `forSns` reads
 * .why = the serve reads one shape, so this runs first and every step after it reads
 *        `SnsEventRecords`
 * .note = the input is `wire`, never `payload`: it holds the whole invoke, and `payload` names the
 *         message body and naught else (`domain.terms/payload.md`)
 */
export const asSnsEventRecords = (
  input: { wire: SNSEvent },
  options?: { deserialize: { payload: boolean } },
): SnsEventRecords => {
  // fail loud rather than hand a handler a shape this transformer did not produce
  if (!getIsSnsEvent(input.wire))
    return MalfunctionError.throw('wire is not an sns event shape', {
      fix: 'check that this lambda is subscribed to an sns topic, and not invoked by another source. a queue is served by genLambdaEndpoint.forSqs, a stream by genLambdaEndpoint.forKinesis',
      wire: input.wire,
    });

  const deserialize = options?.deserialize ?? DESERIALIZE_DEFAULT;
  return {
    records: input.wire.Records.map((record) =>
      asSnsRecord({ wire: record }, { deserialize }),
    ),
    _: { raw: input.wire },
  };
};
