import type { ApiGatewayResponse } from '../../../domain.objects/ApiGatewayResponse';
import type { ApiGatewayResponseOnwire } from '../../../domain.objects/ApiGatewayResponseOnwire';

/**
 * .what = the default output translator: what `invoke` returns becomes the response wire
 *
 * .note = `status` defaults here, ahead of every middleware — middy's `normalizeHttpResponse`
 *         applies `statusCode ??= 500`, so a later default would put a server-fault on the wire
 *         for a handler that meant 200
 *
 * .note = this is the one line where the body changes its name. `payload` is the sdk's word for
 *         a body in both directions; `body` is aws's key on the wire result. the rename happens
 *         here and nowhere else, so no other file holds both senses at once
 *
 * .note = the body is omitted, never `''` — the serializer would encode `''` into `'""'`. it is
 *         left as the domain value for the serializer to encode one step later, which is what
 *         lets a handler's own `Content-Type` carry bytes through untouched. the omission holds
 *         at the wire rather than mid-chain: the serializer re-adds `body` as an own key with
 *         value `undefined`, which is benign and visible in the unit snapshots
 */
export const asApiGatewayResponseOnwire = <TPayload>(input: {
  response: ApiGatewayResponse<TPayload>;
}): ApiGatewayResponseOnwire<TPayload> => ({
  statusCode: input.response.status ?? 200,
  ...(input.response.headers ? { headers: input.response.headers } : {}),
  ...('payload' in input.response ? { body: input.response.payload } : {}),
});
