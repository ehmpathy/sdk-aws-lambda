import type { SNSMessageAttributes } from 'aws-lambda';

import type { SnsHeadersOnwire } from './SnsEventRecords';

/**
 * .what = flattens sns's per-value message-attribute wrapper into one name per value
 * .why = `headers` means "one name, one value" in every family this sdk serves. aws wraps each
 *        value as `{ Type, Value }`, a codec detail rather than a second dimension of the bag
 *        (`domain.terms/headers.md`)
 *
 * .note = keys verbatim: sns attribute names are case-sensitive, so the api-gateway fold does not
 *         travel here (`rule.forbid.defended-exceptions` — an axis of the protocol)
 * .note = a `Binary` attribute's `Value` is aws's base64 string, handed over undecoded, as at sqs.
 *         `Type` says which — at `_.raw.Sns.MessageAttributes`
 * .note = an absent bag reads `null`, and the caller maps a hand-built fixture's omitted
 *         `MessageAttributes` onto it at the wire boundary
 */
export const asSnsHeadersOnwire = (input: {
  messageAttributes: SNSMessageAttributes | null;
}): SnsHeadersOnwire => {
  if (!input.messageAttributes) return {};

  return Object.fromEntries(
    Object.entries(input.messageAttributes).map(([name, attribute]) => [
      name,
      attribute.Value,
    ]),
  );
};
