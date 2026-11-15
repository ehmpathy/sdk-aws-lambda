import type { SQSEvent } from 'aws-lambda';
import { type ZodType, z } from 'zod';

import { setLambdaEventSchemaSource } from '../lambdaEndpointWire/frame/setLambdaEventSchemaSource';
import {
  asLambdaEventPayloadSchema,
  DESERIALIZE_DEFAULT,
} from './asLambdaEventPayloadSchema';
import type { SqsEventBodyDecoded } from './SqsEventBodyDecoded';

/**
 * .what = the two call forms of `fromSqs`, one per handler face
 * .why = with no `payload`, the handler face IS the wire face (`SQSEvent`); with one, each
 *        record's `body` holds the decoded payload. a caller reads the face it asked for
 */
export type FromSqs = {
  (): ZodType<SQSEvent, SQSEvent>;
  <TPayload>(input: {
    /**
     * .what = the schema of `Records[].body`, after it is decoded
     */
    payload: ZodType<TPayload>;

    /**
     * .what = whether `body` is parsed as json before `payload` meets it
     * .default = `{ payload: true }`; a text message sets `{ payload: false }`
     */
    deserialize?: { payload: boolean };
  }): ZodType<SqsEventBodyDecoded<TPayload>, SQSEvent>;
};

/**
 * .what = the schema of the sqs envelope, with the body slot supplied
 * .why = one envelope serves both call forms; only the body slot differs (the wire string alone,
 *        or the decoded payload)
 * .note = loose objects: a key aws adds later is kept, never stripped or refused (F4)
 * .note = `Records` may be empty, as `genLambdaEndpoint.forSqs`'s decoder accepts it: the schema
 *         face and the endpoint face agree on what a legitimate sqs shape is. read `Records[0]`
 *         only after a length check
 * .note = an attribute's `stringListValues` / `binaryListValues` are optional: aws declares both
 *         "Not implemented. Reserved for future use.", and a hand-built fixture omits them
 * .note = `md5OfMessageAttributes` is nullish, not optional: aws sends `null` on a message with no
 *         attributes, though `@types/aws-lambda` says `?: string` (powertools types it
 *         `string | null`). an `.optional()` here would refuse a real batch that no fixture shows.
 *         the parsed face reads a `null` as absent, so it stays the `SQSEvent` it declares
 */
const genSchemaOfSqsEvent = <TPayload>(input: {
  body: ZodType<TPayload, string>;
}) =>
  z.looseObject({
    Records: z.array(
      z.looseObject({
        messageId: z.string(),
        receiptHandle: z.string(),
        body: input.body,
        attributes: z.looseObject({
          AWSTraceHeader: z.string().optional(),
          ApproximateReceiveCount: z.string(),
          SentTimestamp: z.string(),
          SenderId: z.string(),
          ApproximateFirstReceiveTimestamp: z.string(),
          SequenceNumber: z.string().optional(),
          MessageGroupId: z.string().optional(),
          MessageDeduplicationId: z.string().optional(),
          DeadLetterQueueSourceArn: z.string().optional(),
        }),
        messageAttributes: z.record(
          z.string(),
          z.looseObject({
            stringValue: z.string().optional(),
            binaryValue: z.string().optional(),
            stringListValues: z.array(z.string()).optional(),
            binaryListValues: z.array(z.string()).optional(),
            dataType: z.string(),
          }),
        ),
        md5OfBody: z.string(),
        md5OfMessageAttributes: z
          .string()
          .nullish()
          .transform((value) => value ?? undefined),
        eventSource: z.literal('aws:sqs'),
        eventSourceARN: z.string(),
        awsRegion: z.string(),
      }),
    ),
  });

/**
 * .what = the zod schema of the event sqs delivers to a lambda, optionally with the schema of each
 *         record's body
 * .why = the schema half of the sqs source, symmetric with `fromSns` and `fromKinesis`: a test
 *        pins an sqs fixture to its payload shape, and a handler wired via `forAsk` gets a
 *        validated envelope and a typed body (`rule.require.event-source-symmetry`)
 *
 * ⚠️ .note = under `forAsk`, one refused record refuses the WHOLE batch. a refusal is a caller
 *         fault, so the invoke succeeds and sqs DELETES every message in the batch, good ones
 *         included, with no retry and no dead-letter entry. `forAsk` logs a warn line with the
 *         refused batch's `messageId`s, the one trace of them. to serve sqs, reach for
 *         `genLambdaEndpoint.forSqs.{perRecord,perBatch}`: it validates each record alone and
 *         acknowledges a refused message alone, never with its batch
 * .note = binary bodies do not fit `payload`: sqs carries text, and binary rides a message
 *         attribute with its own `dataType`
 * .note = two call forms, two contracts, by design: `fromSqs()` makes no claim about the body,
 *         so it stays the wire string; `fromSqs({ payload })` claims a shape, so each body is
 *         decoded and validated. an absent `input` is the envelope-only contract, not a skipped
 *         default — each form carries its own return type and its own tests
 *
 * .as = zod infers `looseObject` types with an index signature on input and output, which no
 *       aws-lambda interface carries, so neither face is assignable to `SQSEvent` structurally.
 *       the cast asserts the runtime shape the schema enforces
 * .removal = drops when zod can infer a loose object without an index signature
 * .note = the cast does not cut the tie to the aws type: the envelope-only schema `satisfies`
 *         `ZodType<SQSEvent, unknown>`, so a required key `@types/aws-lambda` adds, or one the
 *         schema drops, fails to compile
 *
 * @example
 * ```ts
 * const event = asLambdaEventSchema.fromSqs({ payload: schemaOfOrder }).parse(fixture);
 * expect(event.Records[0]!.body.orderId).toEqual('ord-7'); // typed, validated
 * ```
 */
export const fromSqs = ((input?: {
  payload: ZodType;
  deserialize?: { payload: boolean };
}): ZodType => {
  const schema = input
    ? genSchemaOfSqsEvent({
        body: asLambdaEventPayloadSchema({
          payload: input.payload,
          deserialize: input.deserialize ?? DESERIALIZE_DEFAULT,
          decode: ({ wire }) => wire,
        }),
      })
    : (genSchemaOfSqsEvent({ body: z.string() }) satisfies ZodType<
        SQSEvent,
        unknown
      >);
  return setLambdaEventSchemaSource({ schema, source: { name: 'sqs' } });
}) as FromSqs;
