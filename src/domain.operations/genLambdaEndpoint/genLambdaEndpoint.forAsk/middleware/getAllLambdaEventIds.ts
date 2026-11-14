import { z } from 'zod';

import type { LambdaEventSchemaSourceName } from '../../../../domain.objects/LambdaEventSchemaSource';

// the one path each source's ids sit at; every other key may be absent on a misrouted event
const schemaOfSnsIds = z.object({
  Records: z.array(z.object({ Sns: z.object({ MessageId: z.string() }) })),
});
const schemaOfKinesisIds = z.object({
  Records: z.array(z.object({ eventID: z.string() })),
});

/**
 * .what = how to read the ids of an event, per source
 * .why = a `Record` keyed by the source name list, so a new source that lacks its reader fails to
 *        compile
 * .note = sns: the `MessageId` an operator searches for. kinesis: the `eventID`, which is
 *         `${shardId}:${sequenceNumber}`, so it names the range an operator replays
 */
const GET_ALL_IDS_BY_SOURCE: Record<
  LambdaEventSchemaSourceName,
  (input: { event: unknown }) => string[]
> = {
  sns: (input) => {
    const parsed = schemaOfSnsIds.safeParse(input.event);
    if (!parsed.success) return [];
    return parsed.data.Records.map((record) => record.Sns.MessageId);
  },
  kinesis: (input) => {
    const parsed = schemaOfKinesisIds.safeParse(input.event);
    if (!parsed.success) return [];
    return parsed.data.Records.map((record) => record.eventID);
  },
};

/**
 * .what = the ids of an aws-delivered event, read per its source, or none when the event is not
 *         shaped as its source sends it
 * .why = a refused event is dropped by aws, so the warn line must carry the ids an operator
 *        needs to find or replay it. a misrouted event lacks the path, so it yields `[]`, never
 *        a throw — this runs inside the catch of a refusal, and a throw would replace it
 */
export const getAllLambdaEventIds = (input: {
  event: unknown;
  name: LambdaEventSchemaSourceName;
}): string[] => GET_ALL_IDS_BY_SOURCE[input.name]({ event: input.event });
