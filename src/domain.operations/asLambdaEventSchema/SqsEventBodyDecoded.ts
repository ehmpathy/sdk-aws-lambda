import type { SQSEvent, SQSRecord } from 'aws-lambda';

/**
 * .what = an sqs event whose `Records[].body` holds the decoded, validated payload
 * .why = the handler face of `asLambdaEventSchema.fromSqs({ payload })`. a consumer whose `invoke`
 *        is declared apart from the call site must be able to name it
 *
 * .why `SqsEventBodyDecoded` and not `SqsEventDecoded` = that name already belongs to the
 *        `genLambdaEndpoint.forSqs` face — the sdk's own decoded shape, `{ records, _ }`. this is
 *        the aws envelope with one slot decoded, so it names the slot it decodes
 */
export type SqsEventBodyDecoded<TPayload> = Omit<SQSEvent, 'Records'> & {
  Records: Array<Omit<SQSRecord, 'body'> & { body: TPayload }>;
};
