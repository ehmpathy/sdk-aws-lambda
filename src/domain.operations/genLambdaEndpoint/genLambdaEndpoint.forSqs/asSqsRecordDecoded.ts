import type { SQSRecord } from 'aws-lambda';

import { asSqsHeadersOnwire } from './asSqsHeadersOnwire';
import type { SqsRecordDecoded } from './SqsEventDecoded';

/**
 * .what = parses a json message body into an object
 * .why = sqs hands the body over as a string; most handlers want the object
 *
 * .note = a body that is not json is returned as the string rather than refused — a plain-text
 *         or csv producer is a legitimate sender, and its own schema (or `z.any()`) is where
 *         that shape gets judged. the same call the api-gateway twin makes, for the same reason
 *
 * .why no base64 arm, where the api-gateway twin has one = sqs carries no `isBase64Encoded` flag
 *         and its body is always a utf-8 string; binary rides in a message attribute, with its own
 *         `dataType`. the arm is absent because the wire fact it reads is absent
 *         (`rule.forbid.defended-exceptions`)
 *
 * .why this is not shared with the api-gateway twin's parser = two usages, and the signatures
 *         differ by the base64 flag above. that is below the rule of three, and an abstraction
 *         that takes an always-false flag from one of its two callers is a worse shape than the
 *         duplicate (`rule.prefer.wet-over-dry`). a third transport earns the lift
 */
const asParsedSqsBody = (input: {
  body: string | null | undefined;
}): unknown => {
  if (!input.body) return null;

  try {
    return JSON.parse(input.body);
  } catch (error) {
    /**
     * .what = allowlists the ONE error a non-json body can raise, and rethrows every other
     * .why = a bare `catch` would swallow a TypeError from a real defect, and the swallowed
     *        value would reach the handler as plain text (`rule.forbid.failhide`).
     *        `SyntaxError` is the only class `JSON.parse` throws for malformed input, per
     *        ecma-262 §25.5.1, so the allowlist is exhaustive rather than a guess
     */
    if (!(error instanceof SyntaxError)) throw error;

    return input.body;
  }
};

/**
 * .what = what `deserialize` means when a caller declares none — one declaration, read by this
 *         transformer and by both `forSqs` variants' config
 *         (`rule.forbid.parallel-codepaths`)
 * .why payload = json is the common case, and a caller who wants the raw string opts out by
 *         value: `deserialize: { payload: false }`
 *
 * .why a second declaration, where the api-gateway family already exports one = to import that
 *         one would bind this family's default to a peer family's. the two agree today and
 *         neither owes the other that agreement forever — a shared constant would make a
 *         divergence a break rather than an edit (`rule.prefer.wet-over-dry`)
 */
export const DESERIALIZE_DEFAULT: { payload: boolean } = { payload: true };

/**
 * .what = decodes one sqs message into the shape a handler reads
 * .why = the two variants differ in how they hand over records, never in how a record is decoded,
 *        so one transformer serves both and a new slot lands in one place
 *        (`rule.forbid.parallel-codepaths`)
 */
export const asSqsRecordDecoded = (
  input: { wire: SQSRecord },
  options?: { deserialize: { payload: boolean } },
): SqsRecordDecoded => {
  const deserialize = options?.deserialize ?? DESERIALIZE_DEFAULT;

  return {
    id: input.wire.messageId,

    /**
     * .what = the attributes the sender set, one name per value, keys VERBATIM
     * .note = sqs attribute names are case-sensitive, so the api-gateway case-fold does not
     *         travel here — see `asSqsHeadersOnwire`
     */
    headers: asSqsHeadersOnwire({
      messageAttributes: input.wire.messageAttributes,
    }),

    /**
     * .what = the body, parsed. VALIDATED later, in place — the input validator replaces this
     *         slot with the schema's output before `logic` runs
     * .why = so `payload` is the validated value at the only moment a handler can read it,
     *        which is what lets its type state the caller's shape over `unknown`
     */
    payload: deserialize.payload
      ? asParsedSqsBody({ body: input.wire.body })
      : input.wire.body,

    _: { raw: input.wire },
  };
};
