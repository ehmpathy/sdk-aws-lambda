import type { ApiGatewayResponsePayload } from '../domain.objects/ApiGatewayResponsePayload';

/**
 * .what = the trail exid, which is a fresh uuid on every invocation
 * .why = a 500 body carries it as `correlationId`, so an unmasked snapshot would churn on
 *        every run. the exid's PRESENCE is the contract worth a snapshot; its value is not
 *
 * .note = masked rather than dropped, so the snapshot still shows that a correlationId
 *         reached the payload — an omission would hide the very field a 500 owes its caller
 */
const EXID_VOLATILE = /exid:[0-9a-f-]{36}/g;

/**
 * .what = projects a lambda response payload into a snapshot-stable shape
 * .why = the unit grain tests the SAME shapes the acceptance grain does (204, 308, xml), so
 *        it owes the same denylist discipline. `asWireSnapshot` closed this at the http grain
 *        and its sibling here closes it at the payload grain
 *        (rule.require.snapshots-deny-volatile-not-allow-expected)
 *
 * .note = this DENIES the volatile exid rather than ALLOWS the expected fields, on purpose.
 *         the 13 allowlist snapshots this replaces each hand-picked `{ statusCode, body }` or
 *         a named header or two, so `headers` was invisible to all of them — which is exactly
 *         how a `Content-Type: application/json` on a body-less 204 survived seven review
 *         rounds at the acceptance grain before a denylist caught it on its first run
 *
 * .note = `body` stays a RAW string rather than parsed. the wire bytes are the subject, and a
 *         parse would erase the one distinction cases 11-13 exist to prove: an ABSENT body
 *         reads differently from `''`, and `''` reads differently from `'""'`
 *
 * .why not one projection shared with `asWireSnapshot` = the two subjects differ in the ways
 *        that matter. an http response always carries a body string and lowercases its header
 *        names; a payload may omit `body` entirely and keeps the sdk's own header casing. one
 *        function over both would need a reconcile step that erases absent-vs-empty — the very
 *        distinction each grain exists to measure
 *
 * .note = the mask is applied by CONDITIONAL SPREAD rather than by `body?.replace(...)`, which
 *         would read shorter and behave identically today. the two diverge if the encoder ever
 *         stops emitting the key at all: `?.` would re-add `body: undefined` and hide that
 *         change, which is the allowlist failure mode in miniature. so the projection adds no
 *         key the payload did not already carry
 */
export const asPayloadSnapshot = (input: {
  payload: ApiGatewayResponsePayload;
}): ApiGatewayResponsePayload => ({
  ...input.payload,
  ...(input.payload.body === undefined
    ? {}
    : { body: input.payload.body.replace(EXID_VOLATILE, 'exid:[masked]') }),
});
