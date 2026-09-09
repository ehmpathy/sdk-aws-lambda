import type { ApiGatewayResponse } from '../../../domain.objects/ApiGatewayResponse';
import type { ApiGatewayResponsePayload } from '../../../domain.objects/ApiGatewayResponsePayload';

/**
 * .what = the default output translator: what `invoke` returns becomes the wire payload
 *
 * .note = `status` defaults HERE, ahead of every middleware — middy's `normalizeHttpResponse`
 *         applies `statusCode ??= 500`, so a later default would put a server-fault on the wire
 *         for a handler that meant 200
 *
 * .note = `body` is OMITTED, never `''` — the serializer would encode `''` into `'""'`. it is
 *         left as the DOMAIN value for the serializer to encode one step later, which is what
 *         lets a handler's own `Content-Type` carry bytes through untouched
 *
 *         ⚠️ the omission holds at the WIRE, not mid-chain: the serializer re-adds `body` as an
 *         own key with value `undefined`. benign, and visible in the unit snapshots
 */
export const asApiGatewayResponsePayload = <TBody>(input: {
  response: ApiGatewayResponse<TBody>;
}): ApiGatewayResponsePayload<TBody> => ({
  statusCode: input.response.status ?? 200,
  ...(input.response.headers ? { headers: input.response.headers } : {}),
  ...('body' in input.response ? { body: input.response.body } : {}),
});
