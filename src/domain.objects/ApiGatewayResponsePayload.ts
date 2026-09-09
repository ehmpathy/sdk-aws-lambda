import type { APIGatewayProxyResult } from 'aws-lambda';

/**
 * .what = the wire payload api gateway receives back
 * .why = names the `outputAfter` point — what lands on the wire, after the output
 *        translator has run. by here the body is a `string`, whatever domain type it
 *        held before, so its contents are opaque
 *
 * .why = the sdk adds no field to aws's shape; it adds a NAME, so a consumer can say
 *        "the bytes on the wire" and a translator can target it. the extant code had no
 *        term for this value, which is exactly why its encode sat hardcoded
 *
 * .note = `body` is OPTIONAL here, where aws declares it required. a body-less response
 *         (a 204, a 308) must reach the wire with the key ABSENT, never as `''` — the
 *         response serializer runs after the encode and would turn an empty string into
 *         `'""'`. api gateway reads an absent body as no body, so absence is the correct
 *         wire form and this type says so rather than leave a cast to hide it
 *
 * .note = `TBody` is PARAMETERIZED because the body is encoded one step later than the
 *         output translator runs, so this shape occurs twice in the chain:
 *
 *           ApiGatewayResponsePayload<TBody>   <- `outputAfter`, what the translator yields
 *                    ↓ the response serializer — an sdk-internal step, not a model point
 *           ApiGatewayResponsePayload          <- what aws receives; the body is bytes
 *
 *         it defaults to `string` so the bare name reads as the wire shape. the serializer
 *         sits OUTSIDE the four points, mirror to the trail read which sits before them
 */
export type ApiGatewayResponsePayload<TBody = string> = Omit<
  APIGatewayProxyResult,
  'body'
> & {
  body?: TBody;
};
