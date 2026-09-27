import type { SQSEvent } from 'aws-lambda';
import { MalfunctionError } from 'helpful-errors';

import { asSqsRecordDecoded } from './asSqsRecordDecoded';
import { getIsSqsEvent } from './getIsSqsEvent';
import type { SqsEventDecoded } from './SqsEventDecoded';

/**
 * .what = decodes an sqs invoke into the shape both `forSqs` variants read
 * .why = the chain must read one shape, so this runs first and every step after it reads
 *        `SqsEventDecoded`
 *
 * .why the input is `wire` and not `payload` = it holds the whole message, and `payload` names
 *        the message body and naught else (`domain.terms/payload.md`)
 *
 * .note = an empty batch decodes to `{ records: [] }` rather than throws. it is a legitimate sqs
 *         shape, and each variant states what it does with it: `perRecord` refuses it, since it
 *         has no record to serve, and `perBatch` returns no failures
 * .note = a named transformer rather than middleware-local logic, so one implementation serves
 *         both variants' entry points (`rule.forbid.parallel-codepaths`)
 */
export const asSqsEventDecoded = (
  input: { wire: SQSEvent },
  options?: { deserialize: { payload: boolean } },
): SqsEventDecoded => {
  // fail loud rather than hand a handler a shape this transformer did not produce
  if (!getIsSqsEvent(input.wire))
    return MalfunctionError.throw('wire is not an sqs event shape', {
      wire: input.wire,
    });

  return {
    records: input.wire.Records.map((record) =>
      asSqsRecordDecoded({ wire: record }, options),
    ),
    _: { raw: input.wire },
  };
};
