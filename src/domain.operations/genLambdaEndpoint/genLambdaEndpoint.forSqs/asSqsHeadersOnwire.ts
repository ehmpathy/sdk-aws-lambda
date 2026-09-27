import type { SQSMessageAttributes } from 'aws-lambda';

import type { SqsHeadersOnwire } from './SqsEventDecoded';

/**
 * .what = flattens sqs's per-value message-attribute wrapper into one name per value
 * .why = `headers` means "one name, one value" in every family this sdk serves, so an
 *        api-gateway handler and an sqs handler index the bag the same way. aws wraps each value
 *        in `{ stringValue?, binaryValue?, dataType }`, which is a codec detail rather than a
 *        second dimension of the bag (`domain.terms/headers.md`)
 *
 * .why `stringValue ?? binaryValue` and not `stringValue` alone = a `Binary` attribute carries
 *        its value at `binaryValue`, as aws's base64 string. to read only `stringValue` would
 *        make every binary attribute read as absent — a value the sender set, silently gone
 *        (`rule.forbid.failhide`)
 *
 * .why the keys are not lowercased, where the api-gateway twin folds them = rfc 9110 §5.1 makes
 *        http field names case-insensitive; sqs attribute names are case-sensitive, so `OrderId`
 *        and `orderId` are two distinct attributes a sender may set together, and a fold would
 *        merge them and drop one (`rule.forbid.defended-exceptions` — an axis of the protocol)
 *
 * .note = the base64 is handed over undecoded. this bag's value type is `string | undefined`, and
 *         a decoded binary is bytes; to decode here would widen every header value to
 *         `string | Buffer` or lose the bytes to a lossy utf-8 round-trip. the caller decodes what
 *         they know is binary, and `dataType` says which — at `_.raw.messageAttributes`
 * .note = it also absorbs the absent bag. `SQSRecord.messageAttributes` is declared required, yet
 *         a hand-built fixture or a future vendor shape may omit it, and a transformer that
 *         returns a bag either way deletes the guard from its caller
 */
export const asSqsHeadersOnwire = (input: {
  messageAttributes: SQSMessageAttributes | undefined;
}): SqsHeadersOnwire => {
  if (!input.messageAttributes) return {};

  return Object.fromEntries(
    Object.entries(input.messageAttributes).map(([name, attribute]) => [
      name,
      attribute.stringValue ?? attribute.binaryValue,
    ]),
  );
};
