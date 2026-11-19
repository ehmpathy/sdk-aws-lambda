import type { KinesisStreamEvent } from 'aws-lambda';
import { type ZodType, z } from 'zod';

import { asKinesisDataText } from '../asKinesisDataText/asKinesisDataText';
import { setLambdaEventSchemaSource } from '../lambdaEndpointWire/frame/setLambdaEventSchemaSource';
import {
  asLambdaEventPayloadSchema,
  DESERIALIZE_DEFAULT,
} from './asLambdaEventPayloadSchema';
import type { KinesisStreamEventDecoded } from './KinesisStreamEventDecoded';

/**
 * .what = the two call forms of `fromKinesis`, one per handler face
 * .why = with no `payload`, the handler face IS the wire face (`KinesisStreamEvent`), and
 *        `data` stays the base64 string aws sent; with one, `data` holds the decoded payload
 */
export type FromKinesis = {
  (): ZodType<KinesisStreamEvent, KinesisStreamEvent>;
  <TPayload>(input: {
    /**
     * .what = the schema of `Records[].kinesis.data`, after base64 decode (and json parse)
     */
    payload: ZodType<TPayload>;

    /**
     * .what = whether the decoded text is parsed as json before `payload` meets it
     * .default = `{ payload: true }`; a text stream sets `{ payload: false }`
     */
    deserialize?: { payload: boolean };
  }): ZodType<KinesisStreamEventDecoded<TPayload>, KinesisStreamEvent>;
};

/**
 * .what = the schema of the kinesis envelope, with the data slot supplied
 * .why = one envelope serves both call forms; only the data slot differs (the base64 string
 *        alone, or the decoded payload)
 * .note = loose objects: a key aws adds later is kept, never stripped or refused (F4)
 * ⚠️ .note = `Records` may be empty, unlike sns: aws's own kinesis sample handlers guard an empty
 *         batch, and a tumble window's final invoke may carry none. a refusal there would answer
 *         with no `state` and suspend the shard, so the schema accepts it. read
 *         `Records[0]` only after a length check
 */
const genSchemaOfKinesisEvent = <TPayload>(input: {
  data: ZodType<TPayload, string>;
}) =>
  z.looseObject({
    Records: z.array(
      z.looseObject({
        kinesis: z.looseObject({
          kinesisSchemaVersion: z.string(),
          partitionKey: z.string(),
          sequenceNumber: z.string(),
          data: input.data,
          approximateArrivalTimestamp: z.number(),
        }),
        eventSource: z.literal('aws:kinesis'),
        eventVersion: z.string(),
        eventID: z.string(),
        eventName: z.string(),
        invokeIdentityArn: z.string(),
        awsRegion: z.string(),
        eventSourceARN: z.string(),
      }),
    ),
  });

/**
 * .what = the zod schema of the event kinesis delivers to a lambda, optionally with the schema
 *         of each record's data
 * .why = a kinesis handler wired via `genLambdaEndpoint.forAsk` gets a validated envelope and
 *        decoded, typed data, where it used to get a `Records`-array guard and a hand
 *        `Buffer.from(data, 'base64')`
 *
 * ⚠️ .note = one refused record refuses the WHOLE batch. under `forAsk` a refusal is a caller
 *         fault, so the invoke succeeds and kinesis advances past every record in the batch,
 *         good ones included (outside a tumble window, where a success with no `state` suspends
 *         the shard instead). for a stream of mixed quality, use the envelope-only form
 *         (`fromKinesis()`) and judge each record in the handler. `forAsk` logs a warn line
 *         with the refused batch's `eventID`s (the first 100, the count, and the last), so the
 *         range can be replayed
 * .note = binary data (a KPL aggregate, cloudwatch-logs gzip) does not fit `payload`: the utf8
 *         decode never fails, so the bytes arrive as a mangled string. use the envelope-only
 *         form for a binary stream, and constrain a text schema's form (e.g. a regex)
 * .note = two call forms, two contracts, by design: `fromKinesis()` makes no claim about the
 *         data, so it stays the base64 aws sent; `fromKinesis({ payload })` claims a shape, so
 *         the data is decoded and validated. an absent `input` is the envelope-only contract,
 *         not a skipped default — each form carries its own return type and its own tests
 *
 * .as = zod infers `looseObject` types with an index signature on input and output, which no
 *       aws-lambda interface carries, so neither face is assignable to `KinesisStreamEvent`
 *       structurally. the cast asserts the runtime shape the schema enforces
 * .removal = drops when zod can infer a loose object without an index signature
 * .note = the cast does not cut the tie to the aws type: the envelope-only schema `satisfies`
 *         `ZodType<KinesisStreamEvent, unknown>`, so a required key `@types/aws-lambda` adds, or
 *         one the schema drops, fails to compile
 *
 * @example
 * ```ts
 * schema: { input: asLambdaEventSchema.fromKinesis({ payload: schemaOfClick }), output: z.void() },
 * invoke: async ({ payload }) => handle(payload.Records.map((record) => record.kinesis.data)),
 * ```
 */
export const fromKinesis = ((input?: {
  payload: ZodType;
  deserialize?: { payload: boolean };
}): ZodType => {
  const schema = input
    ? genSchemaOfKinesisEvent({
        data: asLambdaEventPayloadSchema({
          payload: input.payload,
          deserialize: input.deserialize ?? DESERIALIZE_DEFAULT,
          decode: asKinesisDataText,
        }),
      })
    : (genSchemaOfKinesisEvent({ data: z.string() }) satisfies ZodType<
        KinesisStreamEvent,
        unknown
      >);
  return setLambdaEventSchemaSource({ schema, source: { name: 'kinesis' } });
}) as FromKinesis;
