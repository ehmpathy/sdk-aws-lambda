import type { KinesisStreamEvent, KinesisStreamRecord } from 'aws-lambda';
import { MalfunctionError } from 'helpful-errors';

import { asKinesisDataText } from '../../asKinesisDataText/asKinesisDataText';
import {
  asRecordBodyParsed,
  DESERIALIZE_DEFAULT,
} from '../record/asRecordBodyParsed';
import { getIsKinesisEvent } from './getIsKinesisEvent';
import type { KinesisEventRecords, KinesisRecord } from './KinesisEventRecords';

/**
 * .what = decodes one kinesis record into the shape a handler reads
 * .why = the endpoint reads one record shape for every source, so each kinesis slot maps to it
 *        here, once: `sequenceNumber` → `id`, `data` → `payload`, and no `headers`, since a
 *        kinesis record carries no metadata bag
 * .note = kinesis always delivers `data` base64-encoded, so the decode to utf8 text runs whether or
 *         not the text is then parsed as json — by the same decode `fromKinesis` uses
 */
const asKinesisRecord = (
  input: { wire: KinesisStreamRecord },
  options: { deserialize: { payload: boolean } },
): KinesisRecord => {
  const text = asKinesisDataText({ wire: input.wire.kinesis.data });
  return {
    id: input.wire.kinesis.sequenceNumber,
    payload: options.deserialize.payload
      ? asRecordBodyParsed({ body: text })
      : text,
    _: { raw: input.wire },
  };
};

/**
 * .what = decodes a kinesis invoke into the shape `forKinesis` reads
 * .why = the serve reads one shape, so this runs first and every step after it reads
 *        `KinesisEventRecords`
 * .note = the input is `wire`, never `payload`: it holds the whole invoke, and `payload` names one
 *         record's data and naught else (`domain.terms/payload.md`)
 */
export const asKinesisEventRecords = (
  input: { wire: KinesisStreamEvent },
  options?: { deserialize: { payload: boolean } },
): KinesisEventRecords => {
  // fail loud rather than hand a handler a shape this transformer did not produce
  if (!getIsKinesisEvent(input.wire))
    return MalfunctionError.throw('wire is not a kinesis event shape', {
      fix: 'check that this lambda is triggered by a kinesis stream, and not invoked by another source. a queue is served by genLambdaEndpoint.forSqs, a topic by genLambdaEndpoint.forSns',
      wire: input.wire,
    });

  const deserialize = options?.deserialize ?? DESERIALIZE_DEFAULT;
  return {
    records: input.wire.Records.map((record) =>
      asKinesisRecord({ wire: record }, { deserialize }),
    ),
    _: { raw: input.wire },
  };
};
