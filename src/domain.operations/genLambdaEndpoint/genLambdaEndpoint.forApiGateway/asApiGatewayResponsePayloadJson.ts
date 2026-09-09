import type { ApiGatewayResponsePayload } from '../../../domain.objects/ApiGatewayResponsePayload';

/**
 * .what = the wire payload for a body this family must encode ITSELF, as json
 * .why = three middleware entries short-circuit the chain — the 400 builder, the 500 builder,
 *        and the introspection reply — and a short-circuit BYPASSES the response serializer,
 *        so each owes the wire an already-encoded body plus its own `Content-Type`. all three
 *        route through here; a fourth short-circuit owes the same
 *
 * .note = this is the SIBLING of `asApiGatewayResponsePayload`, never a replacement. the two
 *         differ on exactly one axis — WHO encodes the body:
 *           - `asApiGatewayResponsePayload` leaves the body a DOMAIN value, for the serializer
 *             to encode one step later. that is the handler's path
 *           - THIS one encodes here, because no serializer step follows a short-circuit
 *
 * .note = the `Content-Type` is stamped unconditionally, which is also what makes the encode
 *         safe to do here: `genContentTypeCoherenceMiddleware` demands a body and a
 *         content-type agree, and `httpResponseSerializer` skips a response that already
 *         declares one — so a second encode cannot double-wrap this body
 *
 * ⚠️ .note = the test doubles that restate this shape stay independent ON PURPOSE. a test that
 *         imported this transformer could no longer prove this transformer's shape
 */
export const asApiGatewayResponsePayloadJson = (input: {
  status: number;
  body: unknown;
}): ApiGatewayResponsePayload => ({
  statusCode: input.status,
  body: JSON.stringify(input.body),
  headers: { 'Content-Type': 'application/json' },
});
