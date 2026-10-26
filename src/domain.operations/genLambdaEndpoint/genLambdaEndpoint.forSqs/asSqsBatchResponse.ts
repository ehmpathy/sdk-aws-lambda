import type { SQSBatchResponse } from 'aws-lambda';

/**
 * .what = the answer sqs reads for a batch, rendered from the ids it must retry
 * .why = `itemIdentifier` is aws's wire name; the sdk says `id` up to this, the one place it
 *        renders the vendor shape. which ids to retry is `getAllSqsIdsRetried`'s fact
 */
export const asSqsBatchResponse = (input: {
  idsRetried: ReadonlyArray<string>;
}): SQSBatchResponse => ({
  batchItemFailures: input.idsRetried.map((id) => ({ itemIdentifier: id })),
});
