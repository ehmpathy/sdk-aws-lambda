import type { SNSEvent } from 'aws-lambda';
import { type ZodType, z } from 'zod';

import { setLambdaEventSchemaSource } from '../lambdaEndpointWire/frame/setLambdaEventSchemaSource';
import {
  asLambdaEventPayloadSchema,
  DESERIALIZE_DEFAULT,
} from './asLambdaEventPayloadSchema';
import type { SnsEventDecoded } from './SnsEventDecoded';

/**
 * .what = the two call forms of `fromSns`, one per handler face
 * .why = with no `payload`, the handler face IS the wire face (`SNSEvent`); with one, the
 *        message slot holds the decoded payload. a caller reads the face it asked for
 * ⚠️ .note = the envelope-only face is typed `SNSEvent`, yet the schema passes three keys as aws
 *         sends them (`SnsEventKeysContested` below): `Subject` may be `null`, and
 *         `SigningCertUrl` / `UnsubscribeUrl` may be absent. test `Subject` with `== null`, never
 *         `=== undefined`, and do not read either url key unchecked
 */
export type FromSns = {
  (): ZodType<SNSEvent, SNSEvent>;
  <TPayload>(input: {
    /**
     * .what = the schema of `Records[].Sns.Message`, after it is decoded
     */
    payload: ZodType<TPayload>;

    /**
     * .what = whether `Message` is parsed as json before `payload` meets it
     * .default = `{ payload: true }`; a text message sets `{ payload: false }`
     */
    deserialize?: { payload: boolean };
  }): ZodType<SnsEventDecoded<TPayload>, SNSEvent>;
};

/**
 * .what = `SNSEvent`, with the three keys where aws's delivery and `@types/aws-lambda` disagree
 *         declared as the schema accepts them
 * .why = the compile-time tie the envelope-only schema `satisfies`: every other key must agree
 *        with `@types/aws-lambda`. the three are the stated gap between the declared `SNSEvent`
 *        face and the runtime:
 *          - `SigningCertUrl`, `UnsubscribeUrl` — optional, since aws's own docs sample spells
 *            the first with `URL` (F10)
 *          - `Subject` — nullable, since sns sends `null` for a message published with no
 *            subject, where the type declares `string | undefined`
 */
type SnsEventKeysContested = {
  Records: (Omit<SNSEvent['Records'][number], 'Sns'> & {
    Sns: Omit<
      SNSEvent['Records'][number]['Sns'],
      'SigningCertUrl' | 'UnsubscribeUrl' | 'Subject'
    > & {
      SigningCertUrl?: string;
      UnsubscribeUrl?: string;
      Subject?: string | null;
    };
  })[];
};

/**
 * .what = the schema of the sns envelope, with the message slot supplied
 * .why = one envelope serves both call forms; only the message slot differs (the wire string
 *        alone, or the decoded payload)
 * .note = loose objects: a key aws adds later is kept, never stripped or refused (F4)
 * .note = the cert url and unsubscribe url keys are optional: aws's own docs sample spells the
 *         first with `URL`, and `@types/aws-lambda` records the dispute (F10). `Subject` is
 *         nullish: sns sends `null` for a message published with no subject
 * .note = `Records` holds at least one record: sns never invokes with none, and a handler that
 *         reads `Records[0]` would meet an empty one as a TypeError, a server fault sns retries
 */
const genSchemaOfSnsEvent = <TPayload>(input: {
  message: ZodType<TPayload, string>;
}) =>
  z.looseObject({
    Records: z
      .array(
        z.looseObject({
          EventVersion: z.string(),
          EventSubscriptionArn: z.string(),
          EventSource: z.literal('aws:sns'),
          Sns: z.looseObject({
            SignatureVersion: z.string(),
            Timestamp: z.string(),
            Signature: z.string(),
            SigningCertUrl: z.string().optional(),
            MessageId: z.string(),
            Message: input.message,
            MessageAttributes: z.record(
              z.string(),
              z.looseObject({ Type: z.string(), Value: z.string() }),
            ),
            Type: z.string(),
            UnsubscribeUrl: z.string().optional(),
            TopicArn: z.string(),
            Subject: z.string().nullish(),
          }),
        }),
      )
      .min(1),
  });

/**
 * .what = the zod schema of the event sns delivers to a lambda, optionally with the schema of
 *         the message inside it
 * .why = an sns handler wired via `genLambdaEndpoint.forAsk` gets a validated envelope and a
 *        typed message, where it used to get `z.custom<SNSEvent>` and a hand `JSON.parse`
 *
 * .note = the wire face (zod input) is `SNSEvent`, so `forAsk` returns a handler typed on it
 * .note = two call forms, two contracts, by design: `fromSns()` makes no claim about the
 *         message, so it stays the wire string; `fromSns({ payload })` claims a shape, so the
 *         message is decoded and validated. an absent `input` is the envelope-only contract, not
 *         a skipped default — each form carries its own return type and its own tests
 * .note = a refusal is answered as a caller fault, so the invoke succeeds and lambda does not
 *         retry. `forAsk` logs a warn line with the message id, since the log is the only trace
 *
 * .as = zod infers `looseObject` types with an index signature on input and output, which no
 *       aws-lambda interface carries, so neither face is assignable to `SNSEvent` structurally.
 *       the cast asserts the runtime shape the schema enforces, which `@types/aws-lambda` names
 * .removal = drops when zod can infer a loose object without an index signature
 * .note = the cast does not cut the tie to the aws type: the envelope-only schema `satisfies`
 *         `ZodType<SnsEventKeysContested, unknown>`, so a required key `@types/aws-lambda` adds,
 *         or one the schema drops, fails to compile. the three contested keys (named on
 *         `SnsEventKeysContested`) are the one stated gap between the declared type and the runtime
 *
 * @example
 * ```ts
 * schema: { input: asLambdaEventSchema.fromSns({ payload: schemaOfNotice }), output: z.void() },
 * invoke: async ({ payload }) => handle(payload.Records[0]!.Sns.Message), // typed, validated
 * ```
 */
export const fromSns = ((input?: {
  payload: ZodType;
  deserialize?: { payload: boolean };
}): ZodType => {
  const schema = input
    ? genSchemaOfSnsEvent({
        message: asLambdaEventPayloadSchema({
          payload: input.payload,
          deserialize: input.deserialize ?? DESERIALIZE_DEFAULT,
          decode: ({ wire }) => wire,
        }),
      })
    : (genSchemaOfSnsEvent({ message: z.string() }) satisfies ZodType<
        SnsEventKeysContested,
        unknown
      >);
  return setLambdaEventSchemaSource({ schema, source: { name: 'sns' } });
}) as FromSns;
