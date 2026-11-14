import type {
  KinesisStreamEvent,
  KinesisStreamRecord,
  KinesisStreamRecordPayload,
} from 'aws-lambda';

/**
 * .what = a kinesis event whose `Records[].kinesis.data` holds the decoded, validated payload
 * .why = the handler face of `asLambdaEventSchema.fromKinesis({ payload })`. a consumer whose
 *        `invoke` is declared apart from the call site must be able to name it
 */
export type KinesisStreamEventDecoded<TPayload> = Omit<
  KinesisStreamEvent,
  'Records'
> & {
  Records: Array<
    Omit<KinesisStreamRecord, 'kinesis'> & {
      kinesis: Omit<KinesisStreamRecordPayload, 'data'> & { data: TPayload };
    }
  >;
};
