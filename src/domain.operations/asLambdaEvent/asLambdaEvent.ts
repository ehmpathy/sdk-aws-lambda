import { fromApiGateway } from './asLambdaEvent.fromApiGateway';
import { fromKinesis } from './asLambdaEvent.fromKinesis';
import { fromS3 } from './asLambdaEvent.fromS3';
import { fromSns } from './asLambdaEvent.fromSns';
import { fromSqs } from './asLambdaEvent.fromSqs';

/**
 * .what = casts a payload into the envelope its event source delivers
 * .why = a lambda endpoint is woken by an EVENT SOURCE, and each source wraps the
 *        payload in its own envelope before the handler sees it. to run an
 *        endpoint against a source, a test must construct that envelope — and the
 *        envelope is aws-shaped, wide, and mostly irrelevant to the handler under
 *        test (define.lambda-event-source).
 *
 * | source | the envelope | the payload lives at |
 * |--------|--------------|----------------------|
 * | **ask** | none — the event IS the payload | the event itself |
 * | **apiGateway** | `{ body, headers, httpMethod, requestContext, … }` | `body`, as a json string |
 * | **sqs** | `{ Records: [{ body, … }] }` | `Records[].body`, as a json string |
 * | **sns** | `{ Records: [{ Sns: { Message, … } }] }` | `Records[].Sns.Message` |
 * | **kinesis** | `{ Records: [{ kinesis: { data, … } }] }` | `Records[].kinesis.data`, base64 |
 * | **s3** | `{ Records: [{ s3: { bucket, object, … } }] }` | the object ref — there is no payload |
 *
 * ## the name
 *
 * **`as`, because it is a cast, never a construction.** the operation takes a
 * payload and casts it into an envelope shape — no identity, no persistence, no
 * findsert — so the transformer prefix applies (`rule.require.get-set-gen-verbs`).
 *
 * **`from`, because it names provenance.** the lambda event, as it arrives *from*
 * sqs. ⚠️ `for` would invert the arrow: the event does not go to sqs, it comes
 * from it.
 *
 * ⚠️ **`$Slug` is taken.** in `define.lambda-endpoint-ubiqlang`, `slug` is the
 *    endpoint's serialized key (`svc-invoice-prep-getInvoice`), so `from$Slug`
 *    would read as *"from the endpoint slug"* and invert the sense
 *    (`rule.forbid.term.addition.ambiguous`).
 *
 * ⚠️ **there is no `fromAsk`, deliberately.** the ask source wraps naught — the
 *    event IS the payload — so a factory for it would be an identity function.
 *    a member that constructs no envelope, on an object whose whole purpose is to
 *    construct envelopes, would imply one exists. pass the event directly.
 *
 * @example
 * ```ts
 * const event = asLambdaEvent.fromSqs({ messages: [JSON.stringify(task)] });
 * const event = asLambdaEvent.fromApiGateway({ body, httpMethod: 'POST' });
 * ```
 */
export const asLambdaEvent = {
  fromApiGateway,
  fromKinesis,
  fromS3,
  fromSns,
  fromSqs,
};
