/**
 * .what = the headers to DROP — a timestamp and three node socket details, each of which would
 *         churn the snapshot on a clock tick or a node upgrade
 *
 * ⚠️ .note = a DENYLIST, never an allowlist. an allowlist cannot show a header a later change
 *         starts to emit, which is the one regression a snapshot exists to surface
 *
 * ⚠️ .note = these snapshots carry LOWERCASE header names while the payload-grain snapshots
 *         carry the sdk's own letter-case. that is two DIFFERENT values, not two renderings of
 *         one: node lowercases every header it parses off the wire. to reconcile them would
 *         make one snapshot lie, and the difference is how a reader learns their `Content-Type`
 *         arrives as `content-type`
 */
const HEADERS_OF_TRANSPORT: string[] = [
  'connection',
  'date',
  'keep-alive',
  'transfer-encoding',
];

/**
 * .what = the trail exid, a fresh uuid per invocation, carried in a 500 body as `correlationId`
 * .note = MASKED rather than dropped — its presence is the contract worth a snapshot, and an
 *         omission would hide the very field a 500 owes its caller
 */
const EXID_VOLATILE = /exid:[0-9a-f-]{36}/g;

export const asWireSnapshot = (input: {
  wire: {
    status: number;
    headers: Record<string, string>;
    text: string;
  };
}): {
  status: number;
  headers: Record<string, string>;
  text: string;
} => ({
  status: input.wire.status,
  headers: Object.fromEntries(
    Object.entries(input.wire.headers).filter(
      ([key]) => !HEADERS_OF_TRANSPORT.includes(key.toLowerCase()),
    ),
  ),
  text: input.wire.text.replace(EXID_VOLATILE, 'exid:[masked]'),
});
