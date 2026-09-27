import type { ApiGatewayResponseOnwire } from '../domain.objects/ApiGatewayResponseOnwire';

/**
 * .what = the trail exid, which is a fresh uuid on every invocation
 * .why = a 500 body carries it as `correlationId`, so an unmasked snapshot would churn on
 *        every run. the exid's PRESENCE is the contract worth a snapshot; its value is not
 *
 * .note = masked rather than dropped, so the snapshot still shows that a correlationId
 *         reached the caller — an omission would hide the very field a 500 owes them
 */
const EXID_VOLATILE = /exid:[0-9a-f-]{36}/g;

/**
 * .what = projects an `ApiGatewayResponseOnwire` into a snapshot-stable shape
 * .why = the unit grain tests the SAME shapes the acceptance grain does (204, 308, xml), so
 *        it owes the same denylist discipline. `asHttpResponseSnapshot` closed this at the http grain
 *        and its peer here closes it at the lambda-response grain
 *        (rule.require.snapshots-deny-volatile-not-allow-expected)
 *
 * .note = the parameter is `wire`, never `payload`: `payload` names the BODY and naught
 *         else, and this value is a whole wire form (`domain.terms/payload.md`)
 *
 * .note = this DENIES the volatile exid rather than ALLOWS the expected fields, on purpose.
 *         an allowlist that hand-picks `{ statusCode, body }` leaves `headers` invisible — the
 *         blind spot that hides a `Content-Type: application/json` on a body-less 204
 *
 * .note = `body` stays a RAW string rather than parsed. the wire bytes are the subject, and a
 *         parse would erase the one distinction cases 11-13 exist to prove: an ABSENT body
 *         reads differently from `''`, and `''` reads differently from `'""'`
 *
 * .why not one projection shared with `asHttpResponseSnapshot` = the two subjects differ in the
 *        ways that matter. an http response always carries a body string and lowercases its
 *        header names; a response wire may omit `body` entirely and keeps the sdk's own header
 *        letter-case. one function over both would need a reconcile step that erases
 *        absent-vs-empty — the very distinction each grain exists to measure
 *
 * .note = the mask is applied by CONDITIONAL SPREAD rather than by `body?.replace(...)`, which
 *         would read shorter and behave identically today. the two diverge if the encoder ever
 *         stops emitting the key at all: `?.` would re-add `body: undefined` and hide that
 *         change, which is the allowlist failure mode in miniature. so the projection adds no
 *         key the wire did not already carry
 */
export const asResponseOnwireSnapshot = (input: {
  wire: ApiGatewayResponseOnwire;
}): ApiGatewayResponseOnwire => ({
  ...input.wire,
  ...(input.wire.body === undefined
    ? {}
    : { body: input.wire.body.replace(EXID_VOLATILE, 'exid:[masked]') }),
});
