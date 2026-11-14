import type { SNSEvent, SNSEventRecord, SNSMessage } from 'aws-lambda';

/**
 * .what = an sns event whose `Records[].Sns.Message` holds the decoded, validated payload
 * .why = the handler face of `asLambdaEventSchema.fromSns({ payload })`. a consumer whose
 *        `invoke` is declared apart from the call site must be able to name it
 *
 * .note = `Subject` is `string | null | undefined`: sns sends `null` for a message published with
 *         no subject, and the schema accepts it, where `@types/aws-lambda` declares only
 *         `string | undefined`. this face is ours, so it states the runtime; a handler that tests
 *         `Subject === undefined` alone would miss the null
 */
export type SnsEventDecoded<TPayload> = Omit<SNSEvent, 'Records'> & {
  Records: Array<
    Omit<SNSEventRecord, 'Sns'> & {
      Sns: Omit<SNSMessage, 'Message' | 'Subject'> & {
        Message: TPayload;
        Subject?: string | null;
      };
    }
  >;
};
