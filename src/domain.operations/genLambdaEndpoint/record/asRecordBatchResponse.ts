/**
 * .what = the partial-batch answer a batched source reads: the ids it must retry
 * .why = sqs (`SQSBatchResponse`) and kinesis (`KinesisStreamBatchResponse`) read one wire shape,
 *        `{ batchItemFailures: [{ itemIdentifier }] }`, so one type serves both
 *
 * .note = the item is the id the source issued: an sqs `messageId`, or a kinesis `sequenceNumber`.
 *         kinesis checkpoints at the lowest one named and retries every record from it
 */
export interface RecordBatchResponse {
  batchItemFailures: { itemIdentifier: string }[];
}

/**
 * .what = the answer a batched source reads, rendered from the ids it must retry
 * .why = `itemIdentifier` is aws's wire name; the sdk says `id` up to this, the one place it
 *        renders the vendor shape. which ids to retry is `getAllRecordIdsRetried`'s fact
 */
export const asRecordBatchResponse = (input: {
  idsRetried: ReadonlyArray<string>;
}): RecordBatchResponse => ({
  batchItemFailures: input.idsRetried.map((id) => ({ itemIdentifier: id })),
});
