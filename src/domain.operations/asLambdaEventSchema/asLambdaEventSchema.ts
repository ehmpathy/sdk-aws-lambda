import { fromKinesis } from './asLambdaEventSchema.fromKinesis';
import { fromSns } from './asLambdaEventSchema.fromSns';

/**
 * .what = the zod schema of the event an event source delivers, optionally with the schema of
 *         the payload inside it
 * .why = the validate direction of the event-source axis. `asLambdaEvent.from$Source` builds an
 *        envelope; `asLambdaEventSchema.from$Source` validates one (`define.lambda-event-source`).
 *        it covers the sources whose payload no endpoint family already validates, so its list
 *        is a subset of `asLambdaEvent`'s, each absence on a stated axis below
 *
 * | source | the payload slot | decode before `payload` |
 * |--------|------------------|-------------------------|
 * | **sns** | `Records[].Sns.Message` | json parse (or none, under `deserialize: { payload: false }`) |
 * | **kinesis** | `Records[].kinesis.data` | base64 → utf8, then json parse (or none) |
 *
 * ⚠️ **there is no `fromSqs`, deliberately.** `genLambdaEndpoint.forSqs.{perRecord,perBatch}`
 *    already validates each record's body against `schema.input.payload`, and answers per
 *    message: a refused message is acknowledged alone, never with its batch. use it for sqs
 *
 * ⚠️ **there is no `fromApiGateway`, on the same axis.** `genLambdaEndpoint.forApiGateway`
 *    validates the request through its own `schema.input` pair (`headers`, `payload`)
 *
 * ⚠️ **there is no `fromS3`, for want of a payload.** an s3 notice carries a reference (bucket,
 *    key), never content, so it has no payload slot to decode, and no evidenced consumer yet
 *
 * ⚠️ **one zod in the tree.** the envelope is built with this sdk's zod and pipes into your
 *    `payload` schema. a schema from another zod copy or major is a compile-time type error, as
 *    at `forAsk`'s `schema.input`; the cure is `pnpm.overrides.zod` to one version
 *
 * @example
 * ```ts
 * genLambdaEndpoint.forAsk({
 *   schema: { input: asLambdaEventSchema.fromSns({ payload: schemaOfNotice }), output: z.void() },
 *   invoke: async ({ payload }) => handle(payload.Records[0]!.Sns.Message),
 * });
 * ```
 */
export const asLambdaEventSchema = {
  fromKinesis,
  fromSns,
};
