/**
 * .what = the headers to drop — a timestamp and three node socket details, each of which would
 *         churn the snapshot on a clock tick or a node upgrade
 *
 * .note = a denylist, never an allowlist. an allowlist cannot show a header a later change
 *         starts to emit, which is the one regression a snapshot exists to surface
 *
 * .note = these snapshots carry lowercase header names while `asResponseOnwireSnapshot`'s carry
 *         the sdk's own letter-case. that is two different values, not two views of one: node
 *         lowercases every header it parses off the wire. to reconcile them would make one
 *         snapshot lie, and the difference is how a reader learns their `Content-Type` arrives
 *         as `content-type`
 *
 * .note = the case-fold this repo applies (`asHeaderKeysLowercased`) is inbound only — it folds
 *         the keys a handler reads. a response header the sdk emits keeps the case the handler
 *         wrote, which is why the two grains differ after that fold
 */
const HEADERS_OF_TRANSPORT: string[] = [
  'connection',
  'date',
  'keep-alive',
  'transfer-encoding',
];

/**
 * .what = the trail exid, a fresh uuid per invocation, carried in a 500 body as `correlationId`
 * .note = masked rather than dropped — its presence is the contract worth a snapshot, and an
 *         omission would hide the very field a 500 owes its caller
 */
const EXID_VOLATILE = /exid:[0-9a-f-]{36}/g;

/**
 * .what = projects an http response — the bytes `fetch` read off the socket — into a
 *         snapshot-stable shape
 *
 * .why `Http` and not `Onwire` = `Onwire` alone names neither grain, since
 *        `ApiGatewayResponseOnwire` is a declared type: a bare qualifier would put
 *        `OnwireResponse` (http) beside `ResponseOnwire` (lambda) — the same two words in
 *        opposite order for two different values, in one package. a near-homograph is worse
 *        than a synonym, since a reader who mis-reads it never notices
 *        (`rule.forbid.ambiguous-labels`)
 *
 * .note = the bare word `wire` is fine as the parameter. the collision is the compound, never
 *         the word — and this value genuinely is the wire: the bytes as they arrived.
 *         `asResponseOnwireSnapshot` names the handler's return, which is not
 *
 * .why its peer `asResponseOnwireSnapshot` is a separate function = the two subjects differ where
 *        it matters. an http response always carries a body string and lowercases its header
 *        names; a response wire may omit `body` entirely and keeps the sdk's own letter-case.
 *        one function over both would need a reconcile step that erases absent-vs-empty — the
 *        very distinction each grain exists to measure
 */
export const asHttpResponseSnapshot = (input: {
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
