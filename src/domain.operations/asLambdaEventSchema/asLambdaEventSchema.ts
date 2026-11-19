import { fromKinesis } from './asLambdaEventSchema.fromKinesis';
import { fromSns } from './asLambdaEventSchema.fromSns';
import { fromSqs } from './asLambdaEventSchema.fromSqs';

/**
 * .what = the zod schema of the event an event source delivers, optionally with the schema of
 *         the payload inside it
 * .why = the validate direction of the event-source axis. `asLambdaEvent.from$Source` builds an
 *        envelope; `asLambdaEventSchema.from$Source` validates one (`define.lambda-event-source`).
 *        every record source pairs a `genLambdaEndpoint.for$Source` with a `from$Source` here, in
 *        one shape (`rule.require.event-source-symmetry`)
 *
 * | source | the payload slot | decode before `payload` |
 * |--------|------------------|-------------------------|
 * | **sqs** | `Records[].body` | json parse (or none, under `deserialize: { payload: false }`) |
 * | **sns** | `Records[].Sns.Message` | json parse (or none) |
 * | **kinesis** | `Records[].kinesis.data` | base64 → utf8, then json parse (or none) |
 *
 * ⚠️ **to serve a record source, prefer its endpoint family.** under `forAsk`, one refused record
 *    refuses the whole batch, and the batch is acknowledged. `genLambdaEndpoint.forSqs.*`,
 *    `forSns`, and `forKinesis.*` validate each record alone and acknowledge a refused record
 *    alone. these schemas serve a test fixture, a tumble window, and a handler that must see the
 *    whole envelope
 *
 * ⚠️ **there is no `fromApiGateway`, on a declared axis.** `genLambdaEndpoint.forApiGateway`
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
  fromSqs,
};
